const express = require('express');
const db = require('../db');

const router = express.Router();

// ====== API to Convert Repair to Invoice ======
router.post('/convert-repair', async (req, res) => {
  const repair = req.body;

  try {
    // 1. Get the last invoice number
    const [lastInvoiceResult] = await db.query(
      'SELECT invoice_number FROM repair_details ORDER BY invoice_number DESC LIMIT 1'
    );

    let nextInvoiceNumber = 'SMJ001';

    if (lastInvoiceResult.length > 0 && lastInvoiceResult[0].invoice_number) {
      const last = lastInvoiceResult[0].invoice_number.slice(3);
      const next = parseInt(last, 10) + 1;
      nextInvoiceNumber = `SMJ${String(next).padStart(3, '0')}`;
    }

    // 2. Format date and time
    let currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let formattedDate = new Date(repair.date).toLocaleDateString('en-GB');
    formattedDate = formattedDate.split('/').reverse().join('-');

    // 3. Insert into repair_details
    await db.query(
      `INSERT INTO repair_details (
        invoice_number, order_number, customer_id, account_name, mobile, email, address1, address2, city,
        sub_category, product_name, metal_type, purity, category, gross_weight, qty, total_price, net_amount,
        net_bill_amount, bal_amt, invoice, transaction_status, time, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        repair.item,
        repair.item,
        repair.metal_type,
        repair.purity,
        repair.category,
        repair.gross_weight,
        repair.pcs,
        repair.total_amt,
        repair.total_amt,
        repair.total_amt,
        repair.total_amt,
        'Converted',
        'ConvertedRepairInvoice',
        currentTime,
        formattedDate
      ]
    );

    // 4. Update repair status in `repairs` table
    await db.query(
      'UPDATE repairs SET invoice = ?, status = ?, invoice_number = ? WHERE repair_id = ?',
      ['Converted', 'Delivered to Customer', nextInvoiceNumber, repair.repair_id]
    );

    res.json({ success: true, invoiceNumber: nextInvoiceNumber });
  } catch (error) {
    console.error('Convert Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ====== API to Get Repair Invoice by Order Number ======
router.get('/get-repair-invoice/:order_number', async (req, res) => {
  const { order_number } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT * FROM repair_details WHERE order_number = ?',
      [order_number]
    );

    if (rows.length > 0) {
      res.json({ success: true, invoice: rows[0] });
    } else {
      res.json({ success: false, message: 'Invoice not found' });
    }
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
