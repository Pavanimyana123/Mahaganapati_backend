const express = require('express');
const db = require('./../db'); // your db.js
const router = express.Router();

router.post('/post/taxslabs', async (req, res) => {
  const { TaxSlabID, TaxSlabName, TaxationType, SGSTPercentage, CGSTPercentage, IGSTPercentage, TaxCategory } = req.body;

  if (!TaxSlabID || !TaxSlabName || !TaxationType || SGSTPercentage === undefined || CGSTPercentage === undefined || IGSTPercentage === undefined || !TaxCategory) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const sql = `
    INSERT INTO taxslabs (TaxSlabID, TaxSlabName, TaxationType, SGSTPercentage, CGSTPercentage, IGSTPercentage, TaxCategory)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [TaxSlabID, TaxSlabName, TaxationType, SGSTPercentage, CGSTPercentage, IGSTPercentage, TaxCategory];

  try {
    const [result] = await db.query(sql, values);
    res.status(201).json({ message: 'Tax slab added successfully.', insertId: result.insertId });
  } catch (err) {
    console.error('Error inserting tax slab:', err);
    res.status(500).json({ message: 'Failed to add tax slab.', error: err });
  }
});

router.get('/get/taxslabs', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM taxslabs');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching tax slabs:', err);
    res.status(500).json({ message: 'Failed to retrieve tax slabs.', error: err });
  }
});

router.get('/get/taxslabs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM taxslabs WHERE TaxSlabID = ?', [id]);
    if (results.length === 0) return res.status(404).json({ message: 'Tax slab not found.' });
    res.status(200).json(results[0]);
  } catch (err) {
    console.error('Error fetching tax slab:', err);
    res.status(500).json({ message: 'Failed to retrieve tax slab.', error: err });
  }
});

module.exports = router;
