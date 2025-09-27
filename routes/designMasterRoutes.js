const express = require('express');
const db = require('../db'); // your db.js
const router = express.Router();

router.post('/designmaster', async (req, res) => {
  const data = req.body;
  const formatValue = (value) => (value === "" ? null : value);

  try {
    const [result] = await db.query(`
      INSERT INTO designmaster (
        metal, short_id, item_type, design_item, design_name, wastage_percentage, making_charge,
        design_short_code, brand_category, mc_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.metal,
      data.short_id,
      data.item_type,
      data.design_item,
      data.design_name,
      formatValue(data.wastage_percentage),
      formatValue(data.making_charge),
      data.design_short_code,
      data.brand_category,
      data.mc_type
    ]);

    res.status(201).json({ id: result.insertId, message: 'DesignMaster record created' });
  } catch (err) {
    console.error('Error inserting designmaster record:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/designmaster', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM designmaster');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching designmaster records:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/designmaster/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM designmaster WHERE design_id = ?', [id]);
    if (results.length === 0) return res.status(404).json({ error: 'Record not found' });
    res.status(200).json(results[0]);
  } catch (err) {
    console.error('Error fetching designmaster by ID:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/designmaster/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const formatValue = (value) => (value === "" ? null : value);

  try {
    const [result] = await db.query(`
      UPDATE designmaster
      SET metal = ?, short_id = ?, item_type = ?, design_item = ?, design_name = ?,
          wastage_percentage = ?, making_charge = ?, design_short_code = ?, brand_category = ?, mc_type = ?
      WHERE design_id = ?
    `, [
      data.metal,
      data.short_id,
      data.item_type,
      data.design_item,
      data.design_name,
      formatValue(data.wastage_percentage),
      formatValue(data.making_charge),
      data.design_short_code,
      data.brand_category,
      data.mc_type,
      id
    ]);

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });

    res.status(200).json({ message: 'DesignMaster record updated' });
  } catch (err) {
    console.error('Error updating designmaster record:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/designmaster/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM designmaster WHERE design_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });

    res.status(200).json({ message: 'DesignMaster record deleted' });
  } catch (err) {
    console.error('Error deleting designmaster record:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
