const express = require('express');
const db = require("../db");
const router = express.Router();

// Helper functions
const formatNumericValue = (value) => (value === '' ? null : value);
const formatValue = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  return value;
};
const formatTaxSlab = (value) => (!value ? null : value.trim());

// Check if invoice exists
const checkInvoiceExists = async (id, invoice) => {
  const query = "SELECT COUNT(*) AS count FROM purchases WHERE id = ? AND invoice = ?";
  const [result] = await db.execute(query, [id, invoice]);
  return result[0].count > 0;
};

// Route to save purchase data
router.post('/post/purchase', async (req, res) => {
  const { formData, table_data } = req.body;

  try {
    if (!table_data || table_data.length === 0) {
      console.error("Error: Table data is empty.");
      return res.status(400).json({ message: "Table data is empty. Cannot proceed with purchase." });
    }

    // Initialize overall amounts
    let overall_taxableAmt = 0, overall_taxAmt = 0, overall_netAmt = 0, overall_hmCharges = 0;

    // Loop through table_data to calculate overall amounts
    table_data.forEach((row, index) => {
      overall_taxableAmt += (parseFloat(row.total_mc) || 0) + (parseFloat(row.total_amount) || 0) + (parseFloat(row.final_stone_amount) || 0);
      overall_taxAmt += parseFloat(row.tax_amt) || 0;
      overall_netAmt += parseFloat(row.net_amt) || 0;
      overall_hmCharges += parseFloat(row.hm_charges) || 0;
    });

    // Process each row separately
    await Promise.all(
      table_data.map(async (row, index) => {
        const { id, invoice } = row;
        const purchaseExists = await checkInvoiceExists(id, invoice);

        // Merge `formData` and `row` while adding overall calculated amounts
        const purchaseData = {
          ...formData,
          ...row,
          overall_taxableAmt,
          overall_taxAmt,
          overall_netAmt,
          overall_hmCharges
        };

        if (purchaseExists) {
          await updatePurchaseFunction(purchaseData);
        } else {
          const purchaseResult = await insertPurchase(purchaseData);
          const purchase_id = purchaseResult.insertId;

          if (row.stoneDetails && row.stoneDetails.length > 0) {
            await Promise.all(
              row.stoneDetails.map((stone, stoneIndex) => {
                return insertStoneDetails({
                  purchase_id,
                  ...stone
                });
              })
            );
          }
        }
      })
    );

    res.status(200).json({
      message: "Purchases processed successfully",
      overall_taxableAmt,
      overall_taxAmt,
      overall_netAmt,
      overall_hmCharges
    });
  } catch (error) {
    console.error("Error saving purchase:", error);
    res.status(500).json({ message: "Error saving purchase", error: error.message });
  }
});

// Get all purchases
router.get('/get/purchases', async (req, res) => {
  try {
    const query = 'SELECT * FROM purchases';
    const [results] = await db.execute(query);
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ message: 'Error fetching data.', error: err });
  }
});

// Delete purchase by ID
router.delete('/delete-purchases/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Get purchase details first
    const getPurchaseDetailsQuery = `
      SELECT product_id, pcs, gross_weight 
      FROM purchases 
      WHERE id = ?`;
    
    const [purchaseResults] = await db.execute(getPurchaseDetailsQuery, [id]);
    
    if (purchaseResults.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    const { product_id, pcs, gross_weight } = purchaseResults[0];

    // Update product quantities
    const updateProductQuery = `
      UPDATE product 
      SET 
        pur_qty = pur_qty - COALESCE(?, 0), 
        pur_weight = pur_weight - COALESCE(?, 0), 
        bal_qty = pur_qty - COALESCE(sale_qty, 0), 
        bal_weight = pur_weight - COALESCE(sale_weight, 0) 
      WHERE product_id = ?`;

    await db.execute(updateProductQuery, [pcs, gross_weight, product_id]);

    // Delete purchase
    const deletePurchaseQuery = `DELETE FROM purchases WHERE id = ?`;
    const [result] = await db.execute(deletePurchaseQuery, [id]);

    if (result.affectedRows > 0) {
      return res.status(200).json({ message: 'Purchase deleted and product updated successfully' });
    } else {
      return res.status(404).json({ message: 'Purchase not found' });
    }
  } catch (error) {
    console.error('Error processing deletion:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete purchase by invoice
router.delete('/deletepurchases/:invoice', async (req, res) => {
  const { invoice } = req.params;

  try {
    // Get all purchase details for this invoice
    const getPurchaseDetailsQuery = `
      SELECT product_id, pcs, gross_weight 
      FROM purchases 
      WHERE invoice = ?`;
    
    const [purchaseResults] = await db.execute(getPurchaseDetailsQuery, [invoice]);
    
    if (purchaseResults.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' });
    }

    // Update product quantities for each purchase
    const updateProductQuery = `
      UPDATE product 
      SET 
        pur_qty = pur_qty - COALESCE(?, 0), 
        pur_weight = pur_weight - COALESCE(?, 0), 
        bal_qty = pur_qty - COALESCE(sale_qty, 0), 
        bal_weight = pur_weight - COALESCE(sale_weight, 0) 
      WHERE product_id = ?`;

    for (const purchase of purchaseResults) {
      await db.execute(updateProductQuery, [purchase.pcs, purchase.gross_weight, purchase.product_id]);
    }

    // Delete all purchases with this invoice
    const deletePurchaseQuery = `DELETE FROM purchases WHERE invoice = ?`;
    const [result] = await db.execute(deletePurchaseQuery, [invoice]);

    if (result.affectedRows > 0) {
      return res.status(200).json({ message: 'Purchase Invoice deleted successfully' });
    } else {
      return res.status(404).json({ message: 'Purchase not found' });
    }
  } catch (error) {
    console.error('Error processing deletion:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get purchase by ID
router.get('/purchase/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'SELECT * FROM purchases WHERE id = ?';
    const [results] = await db.execute(query, [id]);
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Purchase not found' });
    }
    
    res.status(200).json(results[0]);
  } catch (error) {
    console.error('Error fetching purchase:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update purchase by ID
router.put('/purchases/:id', async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    const formatDate = (date) => {
      if (date) {
        return new Date(date).toISOString().slice(0, 19).replace("T", " ");
      }
      return null;
    };

    const formattedDate = formatDate(updatedData.date);
    const formattedBillDate = formatDate(updatedData.bill_date);
    const formattedDueDate = formatDate(updatedData.due_date);

    const query = `
      UPDATE purchases 
      SET 
        customer_id = ?, mobile = ?, account_name = ?, gst_in = ?, terms = ?, invoice = ?, 
        bill_no = ?, rate_cut = ?, date = ?, bill_date = ?, due_date = ?, category = ?, 
        cut = ?, color = ?, clarity = ?, paid_pure_weight = ?, balance_pure_weight = ?, 
        hsn_code = ?, rbarcode = ?, stone_weight = ?, net_weight = ?, hm_charges = ?, 
        other_charges = ?, charges = ?, purity = ?, metal_type = ?, pure_weight = ?, 
        rate = ?, total_amount = ?, paid_amount = ?, balance_amount = ?, 
        product_id = ?, pcs = ?, gross_weight = ?, balance_after_receipt = ? , Pricing = ? , remarks = ?
      WHERE id = ?
    `;

    const values = [
      updatedData.customer_id, updatedData.mobile, updatedData.account_name, updatedData.gst_in, updatedData.terms, updatedData.invoice,
      updatedData.bill_no, updatedData.rate_cut, formattedDate, formattedBillDate, formattedDueDate,
      updatedData.category, updatedData.cut, updatedData.color, updatedData.clarity, updatedData.paid_pure_weight, updatedData.balance_pure_weight,
      updatedData.hsn_code, updatedData.rbarcode, updatedData.stone_weight, updatedData.net_weight, updatedData.hm_charges,
      updatedData.other_charges, updatedData.charges, updatedData.purity, updatedData.metal_type, updatedData.pure_weight,
      updatedData.rate, updatedData.total_amount, updatedData.paid_amount, updatedData.balance_amount,
      updatedData.product_id, updatedData.pcs, updatedData.gross_weight, updatedData.balance_after_receipt, updatedData.Pricing, updatedData.remarks, id
    ];

    const [result] = await db.execute(query, values);

    if (result.affectedRows > 0) {
      res.status(200).json({ message: 'Purchase updated successfully.' });
    } else {
      res.status(404).json({ message: 'Purchase not found.' });
    }
  } catch (error) {
    console.error('Error updating purchase:', error);
    res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
});

// Get all unique purchase details
router.get("/get-unique-purchase-details", async (req, res) => {
  try {
    const sql = `
      SELECT * 
      FROM purchases r1
      WHERE r1.id = (
        SELECT MAX(r2.id) 
        FROM purchases r2
        WHERE r1.invoice = r2.invoice
      )
    `;
    const [results] = await db.execute(sql);
    res.json(results);
  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// Get repair details by invoice number
router.get("/get-purchase-details/:invoice", async (req, res) => {
  const { invoice } = req.params;

  if (!invoice) {
    return res.status(400).json({ message: "Invoice number is required" });
  }

  try {
    const sql = `
      SELECT 
        id, customer_id, mobile, account_name, gst_in, terms, invoice, bill_no, date, bill_date, due_date, Pricing, product_id, category, 
        metal_type, rbarcode, hsn_code,pcs, gross_weight, stone_weight, deduct_st_Wt, net_weight, purity, purityPercentage, pure_weight, wastage_on, wastage, 
        wastage_wt, Making_Charges_On, Making_Charges_Value, total_mc, total_pure_wt, paid_pure_weight, balance_pure_weight, rate, 
        total_amount, tax_slab, tax_amt, net_amt, rate_cut, rate_cut_wt, paid_amount, balance_amount, hm_charges, charges, remarks, 
        cut, color, clarity, carat_wt, stone_price, final_stone_amount, balance_after_receipt, balWt_after_payment, paid_amt, paid_wt, paid_by, bal_wt_amt,
        other_charges, Pricing, overall_taxableAmt, overall_taxAmt, overall_netAmt, overall_hmCharges, tag_id, discount_amt, final_amt, claim_remark
      FROM purchases
      WHERE invoice = ?
    `;
    
    const [results] = await db.execute(sql, [invoice]);
    
    if (results.length === 0) {
      return res.status(404).json({ message: "No data found for the given invoice number" });
    }

    const uniqueData = {
      customer_id: results[0].customer_id,
      mobile: results[0].mobile,
      account_name: results[0].account_name,
      gst_in: results[0].gst_in,
      terms: results[0].terms,
      invoice: results[0].invoice,
      bill_no: results[0].bill_no,
      date: results[0].date,
      bill_date: results[0].bill_date,
      due_date: results[0].due_date,
      Pricing: results[0].Pricing,
      overall_total_wt: results[0].overall_total_wt,
      overall_paid_wt: results[0].overall_paid_wt,
      overall_bal_wt: results[0].overall_bal_wt,
      overall_taxableAmt: results[0].overall_taxableAmt,
      overall_taxAmt: results[0].overall_taxAmt,
      overall_netAmt: results[0].overall_netAmt, 
      overall_hmCharges: results[0].overall_hmCharges
    };

    const repeatedData = results.map((row) => ({
      id: row.id,
      invoice: row.invoice,
      customer_id: row.customer_id,
      account_name: row.account_name,
      mobile: row.mobile,
      product_id: row.product_id,
      category: row.category,
      Pricing: row.Pricing,
      metal_type: row.metal_type,
      rbarcode: row.rbarcode,
      hsn_code: row.hsn_code,
      pcs: row.pcs,
      gross_weight: row.gross_weight,
      stone_weight: row.stone_weight,
      deduct_st_Wt: row.deduct_st_Wt,
      net_weight: row.net_weight,
      purity: row.purity,
      purityPercentage: row.purityPercentage,
      pure_weight: row.pure_weight,
      wastage_on: row.wastage_on,
      wastage: row.wastage,
      wastage_wt: row.wastage_wt,
      Making_Charges_On: row.Making_Charges_On,
      Making_Charges_Value: row.Making_Charges_Value,
      total_mc: row.total_mc,
      total_pure_wt: row.total_pure_wt,
      paid_pure_weight: row.paid_pure_weight,
      balance_pure_weight: row.balance_pure_weight,
      rate: row.rate,
      total_amount: row.total_amount,
      tax_slab: row.tax_slab,
      tax_amt: row.tax_amt,
      net_amt: row.net_amt,
      rate_cut: row.rate_cut,
      rate_cut_wt: row.rate_cut_wt,
      paid_amount: row.paid_amount,
      balance_amount: row.balance_amount,
      hm_charges: row.hm_charges,
      charges: row.charges,
      remarks: row.remarks,
      cut: row.cut,
      color: row.color,
      clarity: row.clarity,
      carat_wt: row.carat_wt,
      stone_price: row.stone_price,
      final_stone_amount: row.final_stone_amount,
      balance_after_receipt: row.balance_after_receipt,
      balWt_after_payment: row.balWt_after_payment,
      paid_amt: row.paid_amt,
      paid_wt: row.paid_wt,
      paid_by: row.paid_by,
      bal_wt_amt: row.bal_wt_amt,
      other_charges: row.other_charges,
      overall_taxableAmt: row.overall_taxableAmt,
      overall_taxAmt: row.overall_taxAmt,
      overall_netAmt: row.overall_netAmt, 
      overall_hmCharges: row.overall_hmCharges,
      tag_id: row.tag_id,
      discount_amt: row.discount_amt,
      final_amt: row.final_amt,
      claim_remark: row.claim_remark,
    }));

    res.json({ uniqueData, repeatedData });
  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// Get all repair details by invoice number
router.get("/purchase-details/:invoice", async (req, res) => {
  try {
    const { invoice } = req.params;

    if (!invoice) {
      return res.status(400).json({ message: "Invoice number is required" });
    }

    const sql = `SELECT * FROM purchases WHERE invoice = ?`;
    const [results] = await db.execute(sql, [invoice]);

    if (results.length === 0) {
      return res.status(404).json({ message: "No repair details found for the given invoice number" });
    }

    res.json(results);
  } catch (error) {
    console.error("Error processing request:", error.message);
    res.status(400).json({ message: "Invalid request" });
  }
});

// Update remark
router.post("/update-remark", async (req, res) => {
  const { productId, remark } = req.body;

  if (!productId || !remark) {
    return res.status(400).json({ message: "Product ID and Remark are required" });
  }

  try {
    const sql = "UPDATE purchases SET claim_remark = ? WHERE id = ?";
    const [result] = await db.execute(sql, [remark, productId]);
    res.json({ message: "Remark updated successfully", result });
  } catch (err) {
    res.status(500).json({ message: "Database Error", error: err });
  }
});

// Helper functions for purchase operations
const updatePurchaseFunction = async (formData) => {
  const updatePurchaseQuery = `
    UPDATE purchases SET
      customer_id = ?, mobile = ?, account_name = ?, gst_in = ?, terms = ?, invoice = ?, 
      bill_no = ?, date = ?, bill_date = ?, due_date = ?, Pricing = ?, product_id = ?, 
      category = ?, metal_type = ?, rbarcode = ?, hsn_code = ?, pcs = ?, 
      gross_weight = ?, stone_weight = ?, deduct_st_Wt = ?, net_weight = ?, 
      purity = ?, purityPercentage = ?, pure_weight = ?, wastage_on = ?, wastage = ?, wastage_wt = ?, 
      Making_Charges_On = ?, Making_Charges_Value = ?, total_mc = ?, total_pure_wt = ?, 
      paid_pure_weight = ?, balance_pure_weight = ?, rate = ?, total_amount = ?, 
      tax_slab = ?, tax_amt = ?, net_amt = ?, rate_cut = ?, rate_cut_wt = ?, rate_cut_amt = ?,
      paid_amount = ?, balance_amount = ?, hm_charges = ?, charges = ?, remarks = ?, 
      cut = ?, color = ?, clarity = ?, carat_wt = ?, stone_price = ?, 
      final_stone_amount = ?, balance_after_receipt = ?, balWt_after_payment = ?, 
      paid_by = ?, bal_wt_amt = ?, other_charges = ?, overall_taxableAmt = ?, 
      overall_taxAmt = ?, overall_netAmt = ?, overall_hmCharges = ?, tag_id = ?, discount_amt = ?, final_amt = ?
    WHERE invoice = ? AND id = ?
  `;

  const bal_wt_amt =
    (formData.balance_pure_weight > 0 ? formData.balance_pure_weight : 0) ||
    (formData.balance_amount > 0 ? formData.balance_amount : 0);

  let paid_by = null;
  if (formData.paid_pure_weight > 0 && formData.paid_amount > 0) {
    paid_by = "By Amount";
  } else if (formData.paid_pure_weight > 0) {
    paid_by = "By Weight";
  }

  const overall_taxableAmt = formatValue(formData.overall_taxableAmt);
  const overall_taxAmt = formatValue(formData.overall_taxAmt);
  const overall_netAmt = formatValue(formData.overall_netAmt);
  const overall_hmCharges = formatValue(formData.overall_hmCharges);

  const purchaseValues = [
    formatNumericValue(formData.customer_id),
    formatNumericValue(formData.mobile),
    formatNumericValue(formData.account_name),
    formatNumericValue(formData.gst_in),
    formatNumericValue(formData.terms),
    formatNumericValue(formData.invoice),
    formatNumericValue(formData.bill_no),
    formatNumericValue(formData.date),
    formatNumericValue(formData.bill_date),
    formatNumericValue(formData.due_date),
    formatNumericValue(formData.Pricing),
    formatNumericValue(formData.product_id),
    formatNumericValue(formData.category),
    formatNumericValue(formData.metal_type),
    formatNumericValue(formData.rbarcode),
    formatNumericValue(formData.hsn_code),
    formatNumericValue(formData.pcs),
    formatValue(formData.gross_weight),
    formatValue(formData.stone_weight),
    formatValue(formData.deduct_st_Wt),
    formatValue(formData.net_weight),
    formatNumericValue(formData.purity),
    formatNumericValue(formData.purityPercentage),
    formatNumericValue(formData.pure_weight),
    formatNumericValue(formData.wastage_on),
    formatNumericValue(formData.wastage),
    formatValue(formData.wastage_wt),
    formatNumericValue(formData.Making_Charges_On),
    formatNumericValue(formData.Making_Charges_Value),
    formatValue(formData.total_mc),
    formatValue(formData.total_pure_wt),
    formatValue(formData.paid_pure_weight),
    formatValue(formData.balance_pure_weight),
    formatValue(formData.rate),
    formatValue(formData.total_amount),
    formatTaxSlab(formData.tax_slab),
    formatValue(formData.tax_amt),
    formatValue(formData.net_amt),
    formatValue(formData.rate_cut),
    formatValue(formData.rate_cut_wt),
    formatValue(formData.rate_cut_amt),
    formatValue(formData.paid_amount),
    formatValue(formData.balance_amount),
    formatValue(formData.hm_charges),
    formatValue(formData.charges),
    formatValue(formData.remarks),
    formatValue(formData.cut),
    formatValue(formData.color),
    formatValue(formData.clarity),
    formatValue(formData.carat_wt),
    formatValue(formData.stone_price),
    formatValue(formData.final_stone_amount),
    formatValue(formData.balance_after_receipt),
    formatValue(formData.balWt_after_payment),
    formatValue(paid_by),
    formatValue(bal_wt_amt),
    formatValue(formData.other_charges),
    overall_taxableAmt,
    overall_taxAmt,
    overall_netAmt,
    overall_hmCharges,
    formatValue(formData.tag_id),
    formatValue(formData.discount_amt),
    formatValue(formData.final_amt),
    formatValue(formData.invoice),
    formatValue(formData.id)
  ];

  const [result] = await db.execute(updatePurchaseQuery, purchaseValues);

  if (result.affectedRows === 0) {
    console.warn(`Warning: No rows updated for invoice ${formData.invoice} and ID ${formData.id}. Check values.`);
  }

  const updateRateCutQuery = `
    UPDATE ratecuts SET 
      category = ?, total_pure_wt = ?, rate_cut_wt = ?, rate_cut = ?, rate_cut_amt = ?, 
      paid_amount = ?, balance_amount = ?, paid_wt = ?, bal_wt = ?, paid_by = ?
    WHERE purchase_id = ? AND invoice = ? AND total_pure_wt = ?
  `;

  const paidAmount = parseFloat(formData.paid_amount) || 0;
  const rateCut = parseFloat(formData.rate_cut) || 1;
  const rateCutWt = parseFloat(formData.rate_cut_wt) || 0;
  const paidWt = paidAmount > 0 && rateCut > 0 ? paidAmount / rateCut : 0;
  const balWt = rateCutWt - paidWt;
  const safeBalWt = isNaN(balWt) ? 0 : balWt;
  const paidBy = rateCutWt > 0 ? "By Amount" : "By Weight";

  const rateCutValues = [
    formatValue(formData.category), formatValue(formData.total_pure_wt), formatValue(formData.rate_cut_wt),
    formatValue(formData.rate_cut), formatValue(formData.rate_cut_amt), formatValue(formData.paid_amount),
    formatValue(formData.balance_amount), paidWt, safeBalWt, paidBy,
    formatValue(formData.id), formatValue(formData.invoice), formatValue(formData.total_pure_wt)
  ];

  await db.execute(updateRateCutQuery, rateCutValues);
  return { purchaseUpdate: result };
};

const insertPurchase = async (formData) => {
  const insertQuery = `
    INSERT INTO purchases (
      customer_id, mobile, account_name, gst_in, terms, invoice, bill_no, date, bill_date, due_date, Pricing, product_id, category, 
      metal_type, rbarcode, hsn_code, pcs, gross_weight, stone_weight, deduct_st_Wt, net_weight, purity, purityPercentage, pure_weight, wastage_on, wastage, 
      wastage_wt, Making_Charges_On, Making_Charges_Value, total_mc, total_pure_wt, paid_pure_weight, balance_pure_weight, rate, 
      total_amount, tax_slab, tax_amt, net_amt, rate_cut, rate_cut_wt, rate_cut_amt, paid_amount, balance_amount, hm_charges, charges, remarks, 
      cut, color, clarity, carat_wt, stone_price, final_stone_amount, balance_after_receipt, balWt_after_payment, paid_by, bal_wt_amt,
      other_charges, overall_taxableAmt, overall_taxAmt, overall_netAmt, overall_hmCharges, tag_id, discount_amt, final_amt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const insertRateCutQuery = `
    INSERT INTO rateCuts (
      purchase_id, invoice, category, total_pure_wt, rate_cut_wt, rate_cut, rate_cut_amt, paid_amount, balance_amount, paid_wt, bal_wt, paid_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const updateProductQuery = `
    UPDATE product
    SET 
      pur_qty = COALESCE(pur_qty, 0) + ?,
      pur_weight = COALESCE(pur_weight, 0) + ?
    WHERE product_id = ?
  `;

  const updateBalanceQuery = `
    UPDATE product
    SET 
      bal_qty = COALESCE(pur_qty, 0) - COALESCE(sale_qty, 0),
      bal_weight = COALESCE(pur_weight, 0) - COALESCE(sale_weight, 0)
    WHERE product_id = ?
  `;

  const bal_wt_amt =
    (formData.balance_pure_weight > 0 ? formData.balance_pure_weight : 0) ||
    (formData.balance_amount > 0 ? formData.balance_amount : 0);

  let paid_by = formData.rate_cut_wt > 0 ? "By Amount" : "By Weight";

  const overall_taxableAmt = formatValue(formData.overall_taxableAmt);
  const overall_taxAmt = formatValue(formData.overall_taxAmt);
  const overall_netAmt = formatValue(formData.overall_netAmt);
  const overall_hmCharges = formatValue(formData.overall_hmCharges);

  const values = [
    formatNumericValue(formData.customer_id),
    formatNumericValue(formData.mobile),
    formatNumericValue(formData.account_name),
    formatNumericValue(formData.gst_in),
    formatNumericValue(formData.terms),
    formatNumericValue(formData.invoice),
    formatNumericValue(formData.bill_no),
    formatNumericValue(formData.date),
    formatNumericValue(formData.bill_date),
    formatNumericValue(formData.due_date),
    formatNumericValue(formData.Pricing),
    formatNumericValue(formData.product_id),
    formatNumericValue(formData.category),
    formatNumericValue(formData.metal_type),
    formatNumericValue(formData.rbarcode),
    formatNumericValue(formData.hsn_code),
    formatNumericValue(formData.pcs),
    formatValue(formData.gross_weight),
    formatValue(formData.stone_weight),
    formatValue(formData.deduct_st_Wt),
    formatValue(formData.net_weight),
    formatNumericValue(formData.purity),
    formatNumericValue(formData.purityPercentage),
    formatNumericValue(formData.pure_weight),
    formatNumericValue(formData.wastage_on),
    formatNumericValue(formData.wastage),
    formatValue(formData.wastage_wt),
    formatNumericValue(formData.Making_Charges_On),
    formatNumericValue(formData.Making_Charges_Value),
    formatValue(formData.total_mc),
    formatValue(formData.total_pure_wt),
    formatValue(formData.paid_pure_weight),
    formatValue(formData.balance_pure_weight),
    formatValue(formData.rate),
    formatValue(formData.total_amount),
    formatTaxSlab(formData.tax_slab),
    formatValue(formData.tax_amt),
    formatValue(formData.net_amt),
    formatValue(formData.rate_cut),
    formatValue(formData.rate_cut_wt),
    formatValue(formData.rate_cut_amt),
    formatValue(formData.paid_amount),
    formatValue(formData.balance_amount),
    formatValue(formData.hm_charges),
    formatValue(formData.charges),
    formatValue(formData.remarks),
    formatValue(formData.cut),
    formatValue(formData.color),
    formatValue(formData.clarity),
    formatValue(formData.carat_wt),
    formatValue(formData.stone_price),
    formatValue(formData.final_stone_amount),
    formatValue(formData.balance_after_receipt),
    formatValue(formData.balWt_after_payment),
    formatValue(paid_by),
    formatValue(bal_wt_amt),
    formatValue(formData.other_charges),
    overall_taxableAmt,
    overall_taxAmt,
    overall_netAmt,
    overall_hmCharges,
    formatValue(formData.tag_id),
    formatValue(formData.discount_amt),
    formatValue(formData.final_amt),
  ];

  const [result] = await db.execute(insertQuery, values);
  const purchaseId = result.insertId;

  // If rate_cut_wt > 0, insert into rateCuts table
  if (parseFloat(formData.rate_cut_wt) > 0 || formData.Pricing === "By fixed") {
    const paidAmount = parseFloat(formData.paid_amount) || 0;
    const rateCut = parseFloat(formData.rate_cut) || 1;
    const rateCutWt = parseFloat(formData.rate_cut_wt) || 0;
    const rateCutAmt =
      formData.Pricing === "By fixed"
        ? parseFloat(formData.final_amt) || 0
        : parseFloat(formData.rate_cut_amt) || 0;

    const paidWt = paidAmount > 0 && rateCut > 0 ? paidAmount / rateCut : 0;
    const balWt = rateCutWt - paidWt;
    const safeBalWt = isNaN(balWt) ? 0 : balWt;
    const paidBy = formData.Pricing === "By fixed" ? "By Amount" : rateCutWt > 0 ? "By Amount" : "By Weight";

    const rateCutValues = [
      purchaseId,
      formatValue(formData.invoice),
      formatValue(formData.category),
      formatValue(formData.total_pure_wt),
      formatValue(formData.rate_cut_wt),
      formatValue(formData.rate_cut),
      formatValue(rateCutAmt),
      formatValue(formData.paid_amount),
      formatValue(formData.balance_amount),
      paidWt,
      safeBalWt,
      paidBy,
    ];

    await db.execute(insertRateCutQuery, rateCutValues);
  }

  await db.execute(updateProductQuery, [formData.pcs, formData.gross_weight, formData.product_id]);
  await db.execute(updateBalanceQuery, [formData.product_id]);

  return result;
};

const insertStoneDetails = async (stoneData) => {
  const query = `
    INSERT INTO stone_details (purchase_id, stoneName, cut, color, clarity, stoneWt, caratWt, stonePrice, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    stoneData.purchase_id,
    stoneData.stoneName,
    stoneData.cut,
    stoneData.color,
    stoneData.clarity,
    stoneData.stoneWt,
    stoneData.caratWt,
    stoneData.stonePrice,
    stoneData.amount,
  ];

  const [result] = await db.execute(query, values);
  return result;
};

module.exports = router;