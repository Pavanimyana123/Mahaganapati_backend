const express = require('express');
const db = require('./../db'); // promise-based mysql2 connection
const router = express.Router();

router.post('/subcategory', async (req, res) => {
  try {
    const { category_id, metal_type_id, metal_type, category, sub_category_name, pricing, prefix, purity, selling_purity, printing_purity } = req.body;

    const sql = `
      INSERT INTO subcategory 
      (category_id, metal_type_id, metal_type, category, sub_category_name, pricing, prefix, purity, selling_purity, printing_purity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(sql, [category_id, metal_type_id, metal_type, category, sub_category_name, pricing, prefix, purity, selling_purity, printing_purity]);
    res.status(201).json({ message: 'Subcategory created successfully', insertId: result.insertId });
  } catch (err) {
    console.error('Error creating subcategory:', err);
    res.status(500).json({ message: 'Failed to create subcategory', error: err });
  }
});

router.get('/subcategory', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM subcategory');
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching subcategories:', err);
    res.status(500).json({ message: 'Failed to fetch subcategories', error: err });
  }
});

router.get('/subcategory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query('SELECT * FROM subcategory WHERE subcategory_id = ?', [id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Subcategory not found' });
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error fetching subcategory:', err);
    res.status(500).json({ message: 'Failed to fetch subcategory', error: err });
  }
});

router.put('/subcategory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, metal_type_id, metal_type, category, sub_category_name, pricing, prefix, purity, selling_purity, printing_purity } = req.body;

    const sql = `
      UPDATE subcategory SET 
        category_id = ?, metal_type_id = ?, metal_type = ?, category = ?, sub_category_name = ?, 
        pricing = ?, prefix = ?, purity = ?, selling_purity = ?, printing_purity = ?
      WHERE subcategory_id = ?
    `;

    const [result] = await db.query(sql, [category_id, metal_type_id, metal_type, category, sub_category_name, pricing, prefix, purity, selling_purity, printing_purity, id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Subcategory not found' });
    res.status(200).json({ message: 'Subcategory updated successfully' });
  } catch (err) {
    console.error('Error updating subcategory:', err);
    res.status(500).json({ message: 'Failed to update subcategory', error: err });
  }
});

router.delete('/subcategory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM subcategory WHERE subcategory_id = ?', [id]);

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Subcategory not found' });
    res.status(200).json({ message: 'Subcategory deleted successfully' });
  } catch (err) {
    console.error('Error deleting subcategory:', err);
    res.status(500).json({ message: 'Failed to delete subcategory', error: err });
  }
});

module.exports = router;
