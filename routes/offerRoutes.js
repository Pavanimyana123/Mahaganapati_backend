const express = require('express');
const db = require('../db');

const router = express.Router();

// 1. GET all offers
router.get('/offers', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM offerstable');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. GET single offer by ID
router.get('/offers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.query('SELECT * FROM offerstable WHERE offer_id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Error fetching offer by ID:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. CREATE or REPLACE offer (Always offer_id = 1)
router.post('/offers', async (req, res) => {
  const data = req.body;

  try {
    const sql = `
      REPLACE INTO offerstable 
      (offer_id, offer_name, discount_on, discount_on_rate, discount_percentage, discount_percent_fixed, valid_from, valid_to, offer_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      1, // Always fixed to 1
      data.offer_name,
      data.discount_on,
      data.discount_on_rate,
      data.discount_percentage,
      data.discount_percent_fixed,
      data.valid_from,
      data.valid_to,
      'Applied',
    ];

    await db.query(sql, values);
    res.json({ message: 'Offer created or updated successfully', offer_id: 1 });
  } catch (error) {
    console.error('Error creating or updating offer:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. UPDATE an existing offer
router.put('/offers/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const sql = `
      UPDATE offerstable
      SET offer_name = ?, discount_on = ?, discount_on_rate = ?, discount_percentage = ?, discount_percent_fixed = ?,
          valid_from = ?, valid_to = ?, offer_status = ?
      WHERE offer_id = ?
    `;
    const values = [
      data.offer_name,
      data.discount_on,
      data.discount_on_rate,
      data.discount_percentage,
      data.discount_percent_fixed,
      data.valid_from,
      data.valid_to,
      'Applied',
      id,
    ];

    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json({ message: 'Offer updated successfully' });
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. UPDATE only offer status
router.put('/offers/:id/status', async (req, res) => {
  const { id } = req.params;
  const { offer_status } = req.body;

  try {
    const sql = `
      UPDATE offerstable
      SET offer_status = ?
      WHERE offer_id = ?
    `;
    const [result] = await db.query(sql, [offer_status, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json({ message: 'Offer status updated successfully' });
  } catch (error) {
    console.error('Error updating offer status:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// 6. DELETE an offer
router.delete('/offers/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM offerstable WHERE offer_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
