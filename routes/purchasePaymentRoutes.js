const express = require('express');
const db = require('../db');

const router = express.Router();

const updateRateCutsTable = async (rate_cut_id, paid_wt, paid_amt) => {
  try {
    // Update paid_wt
    await db.query(
      `UPDATE ratecuts 
       SET paid_wt = paid_wt + ? 
       WHERE rate_cut_id = ?`,
      [paid_wt, rate_cut_id]
    );

    // Update bal_wt
    await db.query(
      `UPDATE ratecuts 
       SET bal_wt = rate_cut_wt - paid_wt 
       WHERE rate_cut_id = ?`,
      [rate_cut_id]
    );

    // Update paid_amount (ensure NULL treated as 0)
    await db.query(
      `UPDATE ratecuts 
       SET paid_amount = COALESCE(paid_amount, 0) + ? 
       WHERE rate_cut_id = ?`,
      [paid_amt, rate_cut_id]
    );

    // Update balance_amount
    await db.query(
      `UPDATE ratecuts 
       SET balance_amount = rate_cut_amt - paid_amount 
       WHERE rate_cut_id = ?`,
      [rate_cut_id]
    );
  } catch (error) {
    console.error('Error updating ratecuts table:', error);
    throw error;
  }
};

router.post('/purchasePayments', async (req, res) => {
  const {
    date,
    mode,
    cheque_number,
    payment_no,
    account_name,
    invoice,
    category,
    rate_cut,
    total_wt,
    paid_wt,
    bal_wt,
    total_amt,
    paid_amt,
    bal_amt,
    paid_by,
    remarks,
    rate_cut_id
  } = req.body;

  try {
    // Validate required fields
    if (!date || !invoice || !category || !total_amt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert purchase payment
    const insertQuery = `
      INSERT INTO purchasePayments 
      (date, mode, cheque_number, payment_no, account_name, invoice, category, rate_cut, total_wt, paid_wt, bal_wt,
       total_amt, paid_amt, bal_amt, paid_by, remarks, rate_cut_id, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `;

    const values = [
      date,
      mode,
      cheque_number,
      payment_no,
      account_name,
      invoice,
      category,
      rate_cut ? parseFloat(rate_cut) : 0,
      total_wt ? parseFloat(total_wt) : 0,
      paid_wt ? parseFloat(paid_wt) : 0,
      bal_wt ? parseFloat(bal_wt) : 0,
      total_amt ? parseFloat(total_amt) : 0,
      paid_amt ? parseFloat(paid_amt) : 0,
      bal_amt ? parseFloat(bal_amt) : 0,
      paid_by,
      remarks,
      rate_cut_id
    ];

    const [result] = await db.query(insertQuery, values);

    // Update related ratecuts record
    await updateRateCutsTable(rate_cut_id, paid_wt, paid_amt);

    res.status(201).json({
      message: 'Purchase payment added successfully',
      paymentId: result.insertId
    });
  } catch (error) {
    console.error('Error inserting purchase payment:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/purchase-payments', async (req, res) => {
  try {
    const [payments] = await db.query(
      `SELECT * FROM purchasePayments ORDER BY created_at DESC`
    );
    res.status(200).json(payments);
  } catch (error) {
    console.error('Error fetching purchase payments:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get("/lastPaymentNumber", async (req, res) => {
    try {
        const query = "SELECT payment_no FROM purchasepayments WHERE payment_no LIKE 'PAY%' ORDER BY id DESC";
        const [result] = await db.execute(query);

        if (result.length > 0) {
            const payNumbers = result
                .map(row => row.payment_no)
                .filter(payment => payment && payment.startsWith("PAY"))
                .map(payment => parseInt(payment.slice(3), 10));

            const lastPaymentNumber = payNumbers.length > 0 ? Math.max(...payNumbers) : 0;
            const nextPaymentNumber = `PAY${String(lastPaymentNumber + 1).padStart(3, "0")}`;

            res.json({ lastPaymentNumber: nextPaymentNumber });
        } else {
            res.json({ lastPaymentNumber: "PAY001" });
        }
    } catch (err) {
        console.error("Error fetching last payment number:", err);
        res.status(500).json({ error: "Failed to fetch last payment number" });
    }
});

router.get("/payment-account-names", async (req, res) => {
    try {
        const accountGroups = [
            "Expenses (Direct/Mfg.)",
            "Expenses (Indirect/Admn.)",
            "SUPPLIERS",
            "CUSTOMERS",
        ];

        const query = `
            SELECT account_name, mobile
            FROM account_details
            WHERE account_group IN (?, ?, ?, ?)
        `;
        
        const [results] = await db.execute(query, accountGroups);
        res.json(results);
    } catch (err) {
        console.error("Error fetching payment account names: ", err);
        res.status(500).send({ error: "Database query error" });
    }
});

module.exports = router;
