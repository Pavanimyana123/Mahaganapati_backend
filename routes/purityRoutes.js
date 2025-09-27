const express = require('express');
const db = require('../db'); 
const router = express.Router();

router.post('/purity', async (req, res) => {
  const { name, metal, purity_percentage, purity, urd_purity, old_purity_desc, cut_issue, skin_print } = req.body;

  const parsedPurityPercentage = purity_percentage && !isNaN(purity_percentage)
    ? parseFloat(purity_percentage)
    : null;

  try {
    const [result] = await db.query(`
      INSERT INTO purity (name, metal, purity_percentage, purity, urd_purity, old_purity_desc, cut_issue, skin_print)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, metal, parsedPurityPercentage, purity || null, urd_purity || null, old_purity_desc || null, cut_issue || null, skin_print || null]);

    res.status(201).json({ id: result.insertId, message: 'Purity record created' });
  } catch (err) {
    console.error('Error inserting purity record:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/purity', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM purity');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching purity records:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.get('/purity/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM purity WHERE purity_id = ?', [id]);
    if (results.length === 0) return res.status(404).json({ error: 'Record not found' });

    res.status(200).json(results[0]);
  } catch (err) {
    console.error('Error fetching purity by ID:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/purity/:id', async (req, res) => {
  const { id } = req.params;
  const { name, metal, purity_percentage, purity, urd_purity, old_purity_desc, cut_issue, skin_print } = req.body;

  try {
    const [result] = await db.query(`
      UPDATE purity SET
        name = ?, metal = ?, purity_percentage = ?, purity = ?, urd_purity = ?,  old_purity_desc = ?, cut_issue = ?, skin_print = ?
      WHERE purity_id = ?
    `, [name, metal, purity_percentage, purity, urd_purity,old_purity_desc, cut_issue, skin_print, id]);

    if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });

    res.status(200).json({ message: 'Purity record updated' });
  } catch (err) {
    console.error('Error updating purity record:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

router.delete('/purity/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM purity WHERE purity_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });

    res.status(200).json({ message: 'Purity record deleted' });
  } catch (err) {
    console.error('Error deleting purity record:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
