const express = require("express");
const db = require("../db"); // Your existing db.js
const router = express.Router();


// Get last invoice number
router.get("/lastInvoiceNumber", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT invoice_number FROM sale_details WHERE invoice_number LIKE 'INV%' ORDER BY id DESC");
    if (rows.length > 0) {
      const invNumbers = rows
        .map(r => r.invoice_number)
        .filter(inv => inv.startsWith("INV"))
        .map(inv => parseInt(inv.slice(3), 10));
      const lastInvoiceNumber = Math.max(...invNumbers);
      const nextInvoiceNumber = `INV${String(lastInvoiceNumber + 1).padStart(3, "0")}`;
      res.json({ lastInvoiceNumber: nextInvoiceNumber });
    } else {
      res.json({ lastInvoiceNumber: "INV001" });
    }
  } catch (err) {
    console.error("Error fetching last invoice number:", err);
    res.status(500).json({ error: "Failed to fetch last invoice number" });
  }
});

// Get last order number
router.get("/lastOrderNumber", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT order_number FROM sale_details WHERE order_number LIKE 'ORD%' ORDER BY id DESC");
    if (rows.length > 0) {
      const ordNumbers = rows
        .map(r => r.order_number)
        .filter(ord => ord.startsWith("ORD"))
        .map(ord => parseInt(ord.slice(3), 10));
      const lastOrderNumber = Math.max(...ordNumbers);
      const nextOrderNumber = `ORD${String(lastOrderNumber + 1).padStart(3, "0")}`;
      res.json({ lastOrderNumber: nextOrderNumber });
    } else {
      res.json({ lastOrderNumber: "ORD001" });
    }
  } catch (err) {
    console.error("Error fetching last order number:", err);
    res.status(500).json({ error: "Failed to fetch last order number" });
  }
});

// Convert order to invoice
router.post("/convert-order", async (req, res) => {
  const { order_number } = req.body;
  if (!order_number) return res.status(400).json({ success: false, message: "order_number is required" });

  try {
    const [orderDetails] = await db.query("SELECT * FROM sale_details WHERE order_number = ?", [order_number]);
    if (!orderDetails.length) return res.status(404).json({ success: false, message: "Order not found" });

    const [lastInvoiceRows] = await db.query("SELECT invoice_number FROM sale_details ORDER BY invoice_number DESC LIMIT 1");
    let nextInvoiceNumber = "INV001";
    if (lastInvoiceRows.length > 0 && lastInvoiceRows[0].invoice_number) {
      const invNum = parseInt(lastInvoiceRows[0].invoice_number.slice(3), 10) + 1;
      nextInvoiceNumber = `INV${String(invNum).padStart(3, "0")}`;
    }

    await db.query(
      "UPDATE sale_details SET invoice_number = ?, invoice = 'Converted' WHERE order_number = ?",
      [nextInvoiceNumber, order_number]
    );

    const insertPromises = orderDetails.map(order => {
      const values = [
        order.customer_id, order.mobile, order.account_name, order.email, order.address1, order.address2, order.city,
        order.pincode, order.state, order.state_code, order.aadhar_card, order.gst_in, order.pan_card, order.terms, order.date,
        nextInvoiceNumber, order.code, order.product_id, order.opentag_id, order.metal, order.product_name, order.metal_type,
        order.design_name, order.purity, order.category, order.sub_category, order.gross_weight, order.stone_weight,
        order.weight_bw, order.stone_price, order.va_on, order.va_percent, order.wastage_weight, order.total_weight_av,
        order.mc_on, order.mc_per_gram, order.making_charges, order.disscount_percentage, order.disscount, order.rate,
        order.rate_amt, order.tax_percent, order.tax_amt, order.total_price, order.cash_amount, order.card_amount,
        order.card_amt, order.chq, order.chq_amt, order.online, order.online_amt, "ConvertedInvoice", order.qty,
        order.product_image, order.taxable_amount, order.tax_amount, order.net_amount, order.old_exchange_amt,
        order.scheme_amt, order.receipts_amt, order.bal_after_receipts, order.bal_amt, order.net_bill_amount,
        order.paid_amt, order.order_number, "Converted", order.customerImage
      ];
      return db.query(
        `INSERT INTO sale_details (
          customer_id, mobile, account_name, email, address1, address2, city, 
          pincode, state, state_code, aadhar_card, gst_in, pan_card, terms, date,
          invoice_number, code, product_id, opentag_id, metal, product_name, metal_type,
          design_name, purity, category, sub_category, gross_weight, stone_weight,
          weight_bw, stone_price, va_on, va_percent, wastage_weight, total_weight_av,
          mc_on, mc_per_gram, making_charges, disscount_percentage, disscount, rate,
          rate_amt, tax_percent, tax_amt, total_price, cash_amount, card_amount,
          card_amt, chq, chq_amt, online, online_amt, transaction_status, qty,
          product_image, taxable_amount, tax_amount, net_amount, old_exchange_amt,
          scheme_amt, receipts_amt, bal_after_receipts, bal_amt, net_bill_amount,
          paid_amt, order_number, invoice, customerImage
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
      );
    });

    await Promise.all(insertPromises);
    res.json({ success: true, message: "Orders converted successfully", invoice_number: nextInvoiceNumber });
  } catch (err) {
    console.error("Error converting order:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get invoice by order number
router.get("/invoice/:order_number", async (req, res) => {
  const { order_number } = req.params;
  if (!order_number) return res.status(400).json({ success: false, message: "order_number is required" });

  try {
    const [invoice] = await db.query("SELECT * FROM sale_details WHERE order_number = ?", [order_number]);
    if (!invoice.length) return res.status(404).json({ success: false, message: "Invoice not found for this order number" });

    res.json({ success: true, data: invoice[0] });
  } catch (err) {
    console.error("Error fetching invoice:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update repair status
router.put("/update-repair-status/:id", async (req, res) => {
  const { id } = req.params;
  const { sale_status } = req.body;
  if (!sale_status) return res.status(400).json({ success: false, message: "sale_status is required" });

  try {
    await db.query("UPDATE sale_details SET sale_status = ? WHERE id = ?", [sale_status, id]);
    res.status(200).json({ message: "Status updated successfully" });
  } catch (err) {
    console.error("Error updating repair status:", err);
    res.status(500).json({ error: "Error updating status" });
  }
});

module.exports = router;
