const express = require('express');
const db = require('../db');

const router = express.Router();

// router.post('/convert-repair', async (req, res) => {
//   const repair = req.body;

//   try {
//     // 1. Get the last invoice number
//     const [lastInvoiceResult] = await db.query(
//       'SELECT invoice_number FROM sale_details ORDER BY invoice_number DESC LIMIT 1'
//     );

//     let nextInvoiceNumber = 'SMJ001';

//     if (lastInvoiceResult.length > 0 && lastInvoiceResult[0].invoice_number) {
//       const last = lastInvoiceResult[0].invoice_number.slice(3);
//       const next = parseInt(last, 10) + 1;
//       nextInvoiceNumber = `SMJ${String(next).padStart(3, '0')}`;
//     }

//     // 2. Calculate GST amounts
//     const totalAmt = parseFloat(repair.total_amt) || 0;
//     const taxPercent = 5; // 5% GST
//     const taxAmt = (totalAmt * taxPercent) / 100;
//     const netbillAmt = totalAmt + taxAmt;

//     // 3. Format date and time
//     let currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//     let formattedDate = new Date(repair.date).toLocaleDateString('en-GB');
//     formattedDate = formattedDate.split('/').reverse().join('-');

//     // 4. Insert into sale_details with GST fields
//     await db.query(
//       `INSERT INTO sale_details (
//         invoice_number, order_number, customer_id, account_name, mobile, email, address1, address2, city,
//         sub_category, product_name, metal_type, purity, category, gross_weight, qty, total_price, tax_percent, tax_amt, taxable_amount,
//         tax_amount, net_amount, net_bill_amount, bal_amt, invoice, transaction_status, time, date
//       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         nextInvoiceNumber,
//         repair.repair_no,
//         repair.customer_id,
//         repair.account_name,
//         repair.mobile,
//         repair.email,
//         repair.address1,
//         repair.address2,
//         repair.city,
//         repair.item,
//         repair.item,
//         repair.metal_type,
//         repair.purity,
//         repair.category,
//         repair.gross_weight,
//         repair.pcs,
//         totalAmt,
//         taxPercent,
//         taxAmt,
//         totalAmt,
//         taxAmt,
//         netbillAmt,
//         netbillAmt,
//         netbillAmt,
//         'Converted',
//         'ConvertedRepairInvoice',
//         currentTime,
//         formattedDate
//       ]
//     );

//     // 5. Update repair status and tax fields in `repairs` table
//     await db.query(
//       `UPDATE repairs SET 
//         invoice = ?, 
//         status = ?, 
//         invoice_number = ?,
//         tax_percent = ?,
//         tax_amt = ?,
//         net_bill_amt = ?
//       WHERE repair_id = ?`,
//       [
//         'Converted',
//         'Delivered to Customer',
//         nextInvoiceNumber,
//         taxPercent,
//         taxAmt,
//         netbillAmt,
//         repair.repair_id
//       ]
//     );

//     res.json({ success: true, invoiceNumber: nextInvoiceNumber });
//   } catch (error) {
//     console.error('Convert Error:', error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// });

// router.get('/get-repair-invoice/:order_number', async (req, res) => {
//   const { order_number } = req.params;

//   try {
//     const [rows] = await db.query(
//       'SELECT * FROM sale_details WHERE order_number = ?',
//       [order_number]
//     );

//     if (rows.length > 0) {
//       res.json({ success: true, invoice: rows[0] });
//     } else {
//       res.json({ success: false, message: 'Invoice not found' });
//     }
//   } catch (error) {
//     console.error('Fetch Error:', error);
//     res.status(500).json({ success: false, message: 'Server error' });
//   }
// });

router.post('/convert-repair', async (req, res) => {
  const repair = req.body;
  const repairGroup = req.body.repairGroup; // Pass the entire group for totals

  try {
    // 1. Get the last invoice number for this specific repair_no to maintain consistency
    const [lastInvoiceResult] = await db.query(
      `SELECT invoice_number FROM sale_details 
       WHERE order_number = ? 
       ORDER BY invoice_number DESC LIMIT 1`,
      [repair.repair_no]
    );

    let nextInvoiceNumber;

    if (lastInvoiceResult.length > 0 && lastInvoiceResult[0].invoice_number) {
      // Use existing invoice number for the same repair_no
      nextInvoiceNumber = lastInvoiceResult[0].invoice_number;
    } else {
      // Generate new invoice number
      const [lastInvoiceGeneral] = await db.query(
        'SELECT invoice_number FROM sale_details ORDER BY invoice_number DESC LIMIT 1'
      );

      if (lastInvoiceGeneral.length > 0 && lastInvoiceGeneral[0].invoice_number) {
        const last = lastInvoiceGeneral[0].invoice_number.slice(3);
        const next = parseInt(last, 10) + 1;
        nextInvoiceNumber = `SMJ${String(next).padStart(3, '0')}`;
      } else {
        nextInvoiceNumber = 'SMJ001';
      }
    }

    // 2. Calculate totals for the entire repair group (only for the first item)
    let totalTaxableAmt = 0;
    let totalTaxAmt = 0;
    let totalNetBillAmt = 0;
    const individualTaxableAmt = parseFloat(repair.total_amt) || 0;
    const taxPercent = 5; // 5% GST
    const individualTaxAmt = (individualTaxableAmt * taxPercent) / 100;

    if (repairGroup && repairGroup.items) {
      // Calculate totals from all items in the group
      totalTaxableAmt = repairGroup.items.reduce((sum, item) => sum + parseFloat(item.total_amt || 0), 0);
      const taxPercent = 5; // 5% GST
      totalTaxAmt = (totalTaxableAmt * taxPercent) / 100;
      totalNetBillAmt = totalTaxableAmt + totalTaxAmt;
    } else {
      // Fallback: calculate for single item
      totalTaxableAmt = parseFloat(repair.total_amt) || 0;
      const taxPercent = 5;
      totalTaxAmt = (totalTaxableAmt * taxPercent) / 100;
      totalNetBillAmt = totalTaxableAmt + totalTaxAmt;
    }

    // 3. Format date and time
    let currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let formattedDate = new Date(repair.date).toLocaleDateString('en-GB');
    formattedDate = formattedDate.split('/').reverse().join('-');

    // 4. Insert into sale_details with GST fields (using group totals for all items)
    await db.query(
      `INSERT INTO sale_details (
        invoice_number, order_number, customer_id, account_name, mobile, email, address1, address2, city,
        sub_category, product_name, metal_type, purity, category, gross_weight, qty, total_price, tax_percent, tax_amt, taxable_amount,
        tax_amount, net_amount, net_bill_amount, bal_amt, invoice, transaction_status, time, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nextInvoiceNumber,
        repair.repair_no,
        repair.customer_id,
        repair.account_name,
        repair.mobile,
        repair.email,
        repair.address1,
        repair.address2,
        repair.city,
        repair.sub_category,
        repair.sub_category,
        repair.metal_type,
        repair.purity,
        repair.category,
        repair.gross_weight,
        repair.pcs || 1,
        parseFloat(repair.total_amt || 0), // Individual item price
        5, // tax_percent
        individualTaxAmt, // Group tax amount
        totalTaxableAmt, // Group taxable amount
        totalTaxAmt, // Group tax amount
        totalNetBillAmt, // Group net amount
        totalNetBillAmt, // Group net bill amount
        totalNetBillAmt, // Group balance amount
        'Converted',
        'ConvertedRepairInvoice',
        currentTime,
        formattedDate
      ]
    );

    // 5. Update repair status and tax fields in `repairs` table for this specific item
    await db.query(
      `UPDATE repairs SET 
        invoice = ?, 
        status = ?, 
        invoice_number = ?,
        tax_percent = ?,
        tax_amt = ?,
        net_bill_amt = ?
      WHERE repair_id = ?`,
      [
        'Converted',
        'Delivered to Customer',
        nextInvoiceNumber,
        5, // tax_percent
        totalTaxAmt, // Group tax amount
        totalNetBillAmt, // Group net bill amount
        repair.repair_id
      ]
    );

    res.json({ success: true, invoiceNumber: nextInvoiceNumber });
  } catch (error) {
    console.error('Convert Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/get-repair-invoice-group/:repair_no', async (req, res) => {
  const { repair_no } = req.params;

  try {
    // Get all sale details for this repair group
    const [saleDetails] = await db.query(
      `SELECT * FROM sale_details WHERE order_number = ? ORDER BY created_at DESC`,
      [repair_no]
    );

    if (saleDetails.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Calculate totals for the entire group
    const totalTaxableAmount = saleDetails.reduce((sum, item) => sum + parseFloat(item.taxable_amount || 0), 0);
    const totalTaxAmount = saleDetails.reduce((sum, item) => sum + parseFloat(item.tax_amount || 0), 0);
    const totalNetAmount = saleDetails.reduce((sum, item) => sum + parseFloat(item.net_bill_amount || 0), 0);

    // Create grouped invoice data
    const invoiceData = {
      invoice_number: saleDetails[0].invoice_number, // Use first invoice number as main
      order_number: repair_no,
      account_name: saleDetails[0].account_name,
      mobile: saleDetails[0].mobile,
      email: saleDetails[0].email,
      address1: saleDetails[0].address1,
      address2: saleDetails[0].address2,
      city: saleDetails[0].city,
      date: saleDetails[0].date,
      items: saleDetails.map(item => ({
        product_name: item.product_name,
        metal_type: item.metal_type,
        gross_weight: item.gross_weight,
        total_price: item.total_price,
        taxable_amount: item.taxable_amount,
        tax_amt: item.tax_amt,
        tax_amount: item.tax_amount,
        net_bill_amount: item.net_bill_amount
      })),
      total_taxable_amount: totalTaxableAmount,
      total_tax_amount: totalTaxAmount,
      total_net_amount: totalNetAmount
    };

    res.json({ success: true, invoice: invoiceData });
  } catch (error) {
    console.error('Error fetching repair invoice group:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});



module.exports = router;
