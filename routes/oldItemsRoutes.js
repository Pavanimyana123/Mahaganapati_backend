const express = require('express');
const db = require('../db'); // Import the MySQL connection pool

const router = express.Router();

// Add product to old items
router.post('/olditems', async (req, res) => {
  try {
    const {
      product, metal, purity, purityPercentage, hsn_code, gross, dust, ml_percent, 
      net_wt, remarks, rate, total_amount, total_old_amount, invoice_id
    } = req.body;

    const query = `
      INSERT INTO old_items 
      (product, metal, purity, purityPercentage, hsn_code, gross, dust, ml_percent, net_wt, remarks, rate, total_amount, total_old_amount, invoice_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.execute(query, [
      product, metal, purity, purityPercentage, hsn_code, gross, dust, ml_percent, 
      net_wt, remarks, rate, total_amount, total_old_amount, invoice_id
    ]);

    res.status(201).send({ id: result.insertId, message: 'Product added successfully' });
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).send('Error inserting data');
  }
});

// Get all old items
router.get('/get/olditems', async (req, res) => {
  try {
    const [results] = await db.execute('SELECT * FROM old_items');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error retrieving data:', err);
    res.status(500).send('Error retrieving data');
  }
});

// Get old items by invoice ID
router.get('/get/olditems/:invoice_id', async (req, res) => {
  try {
    const { invoice_id } = req.params;
    const [results] = await db.execute('SELECT * FROM old_items WHERE invoice_id = ?', [invoice_id]);
    res.status(200).json(results);
  } catch (err) {
    console.error('Error retrieving data by invoice ID:', err);
    res.status(500).send('Error retrieving data');
  }
});

module.exports = router;