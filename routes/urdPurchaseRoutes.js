const express = require('express');
const db = require('../db'); // promise-based MySQL connection
const router = express.Router();

router.post('/save-purchase', async (req, res) => {
  try {
    const { customerDetails, items } = req.body;
    if (!customerDetails || !items || items.length === 0) {
      return res.status(400).json({ error: 'Missing customer details or items.' });
    }

    // Insert each item
    for (const item of items) {
      const query = `
        INSERT INTO urd_purchase_details 
        (customer_id, account_name, mobile, email, address1, address2, city, state, state_code, aadhar_card, gst_in, 
         pan_card, date, urdpurchase_number, product_id, product_name, metal, purity, hsn_code, gross, dust, touch_percent, 
         ml_percent, eqt_wt, remarks, rate, total_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
        customerDetails.customer_id,
        customerDetails.account_name,
        customerDetails.mobile,
        customerDetails.email,
        customerDetails.address1,
        customerDetails.address2,
        customerDetails.city,
        customerDetails.state,
        customerDetails.state_code,
        customerDetails.aadhar_card,
        customerDetails.gst_in,
        customerDetails.pan_card,
        customerDetails.date,
        customerDetails.urdpurchase_number,
        item.product_id,
        item.product_name,
        item.metal,
        item.purity,
        item.hsn_code,
        item.gross,
        item.dust,
        item.touch_percent,
        item.ml_percent,
        item.eqt_wt,
        item.remarks,
        item.rate,
        item.total_amount,
      ];

      await db.query(query, values);
    }

    res.status(201).json({ message: 'Purchase saved successfully' });
  } catch (err) {
    console.error('Error saving URD purchase:', err);
    res.status(500).json({ error: 'Failed to save purchase', details: err });
  }
});

router.get('/get-purchases', async (req, res) => {
  try {
    const query = `
      SELECT * FROM urd_purchase_details
      ORDER BY date DESC
    `;
    const [rows] = await db.query(query);
    if (rows.length === 0) return res.status(404).json({ message: 'No URD purchases found.' });
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching URD purchases:', err);
    res.status(500).json({ message: 'Failed to fetch URD purchases', error: err });
  }
});

router.get('/lastURDPurchaseNumber', async (req, res) => {
  try {
    const query = `SELECT urdpurchase_number FROM urd_purchase_details WHERE urdpurchase_number LIKE 'URD%' ORDER BY id DESC LIMIT 1`;
    const [rows] = await db.query(query);

    let nextNumber = 'URD001';
    if (rows.length > 0) {
      const lastNumber = parseInt(rows[0].urdpurchase_number.slice(3), 10);
      nextNumber = `URD${String(lastNumber + 1).padStart(3, '0')}`;
    }

    res.json({ lastURDPurchaseNumber: nextNumber });
  } catch (err) {
    console.error('Error fetching last URD purchase number:', err);
    res.status(500).json({ message: 'Failed to fetch last purchase number', error: err });
  }
});

router.put('/api/urd-purchase/:urdPurchaseNumber', async (req, res) => {
  try {
    const { urdPurchaseNumber } = req.params;
    const data = req.body;

    let query = 'UPDATE urd_purchase_details SET ';
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      updates.push(`${key} = ?`);
      values.push(value);
    }

    if (updates.length === 0) return res.status(400).json({ message: 'No fields to update' });

    query += updates.join(', ') + ' WHERE urdpurchase_number = ?';
    values.push(urdPurchaseNumber);

    const [result] = await db.query(query, values);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Purchase record not found' });

    res.status(200).json({ message: 'Purchase updated successfully', result });
  } catch (err) {
    console.error('Error updating URD purchase:', err);
    res.status(500).json({ message: 'Failed to update purchase', error: err });
  }
});

router.delete('/delete/:urdpurchase_number', async (req, res) => {
  try {
    const { urdpurchase_number } = req.params;

    const query = 'DELETE FROM urd_purchase_details WHERE urdpurchase_number = ?';
    const [result] = await db.query(query, [urdpurchase_number]);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'URD purchase not found.' });

    res.status(200).json({ message: 'URD purchase deleted successfully.' });
  } catch (err) {
    console.error('Error deleting URD purchase:', err);
    res.status(500).json({ message: 'Failed to delete URD purchase', error: err });
  }
});

module.exports = router;
