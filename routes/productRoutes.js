const express = require('express');
const db = require('./../db'); // your db.js
const router = express.Router();


router.post('/post/products', async (req, res) => {
  const productData = req.body;
  const sanitizeInteger = (value, defaultValue = 0) => (value === "" || value === null ? defaultValue : value);

  const values = [
    productData.product_name, 
    productData.rbarcode,
    sanitizeInteger(productData.metal_type_id, null), 
    sanitizeInteger(productData.purity_id, null), 
    sanitizeInteger(productData.design_id, null), 
    productData.Category, 
    productData.design_master,
    productData.purity, 
    productData.item_prefix, 
    productData.short_name, 
    productData.sale_account_head,
    productData.purchase_account_head, 
    productData.tax_slab, 
    sanitizeInteger(productData.tax_slab_id, null),
    productData.hsn_code, 
    productData.maintain_tags, 
    sanitizeInteger(productData.op_qty, 0),
    sanitizeInteger(productData.op_value, 0), 
    sanitizeInteger(productData.op_weight, 0), 
    productData.huid_no
  ];

  const sql = `INSERT INTO product (
        product_name, rbarcode, metal_type_id, purity_id, design_id, Category, design_master, purity, item_prefix,
        short_name, sale_account_head, purchase_account_head, tax_slab, tax_slab_id,
        hsn_code, maintain_tags, op_qty, op_value, op_weight, huid_no
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  try {
    const [result] = await db.query(sql, values);
    res.status(201).json({ message: 'Product added successfully', product_id: result.insertId });
  } catch (err) {
    console.error('Error inserting product:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

router.get('/get/products', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM product');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

router.get('/get/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM product WHERE product_id = ?', [id]);
    if (results.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(results[0]);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

router.put('/put/products/:product_id', async (req, res) => {
  const { product_id } = req.params;
  const data = req.body;
  const sanitizeInteger = (value, defaultValue = 0) => (value === "" || value === null ? defaultValue : value);

  const values = [
    data.product_name, 
    data.rbarcode,
    data.Category, 
    data.design_master,
    data.purity, 
    data.item_prefix, 
    data.short_name, 
    data.sale_account_head, 
    data.purchase_account_head,
    data.tax_slab, 
    sanitizeInteger(data.tax_slab_id, null),
    data.hsn_code, 
    data.maintain_tags, 
    sanitizeInteger(data.op_qty, 0),
    sanitizeInteger(data.op_value, 0), 
    sanitizeInteger(data.op_weight, 0), 
    data.huid_no,
    product_id
  ];

  const sql = `UPDATE product 
               SET product_name = ?, rbarcode = ?, Category = ?, design_master = ?, purity = ?, 
                   item_prefix = ?, short_name = ?, sale_account_head = ?, purchase_account_head = ?, 
                   tax_slab = ?, tax_slab_id = ?, hsn_code = ?, maintain_tags = ?, 
                   op_qty = ?, op_value = ?, op_weight = ?, huid_no = ?
               WHERE product_id = ?`;

  try {
    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json({ message: 'Product updated successfully' });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

router.delete('/delete/products/:product_id', async (req, res) => {
  const { product_id } = req.params;
  try {
    const [result] = await db.query('DELETE FROM product WHERE product_id = ?', [product_id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ message: 'Database error', error: err });
  }
});

router.post('/api/check-and-insert', async (req, res) => {
  const { product_name, Category, purity, design_master } = req.body;

  if (!product_name || !Category || !purity) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  try {
    const [existingProducts] = await db.query(
      `SELECT * FROM product WHERE product_name = ? AND Category = ? AND purity = ?`,
      [product_name, Category, purity]
    );

    if (existingProducts.length > 0) {
      return res.json({ exists: true, message: 'Product already exists!' });
    }

    const [result] = await db.query(
      `INSERT INTO product (product_name, Category, design_master, purity) VALUES (?, ?, ?, ?)`,
      [product_name, Category, design_master, purity]
    );

    res.status(201).json({ exists: false, message: 'Product saved successfully!', product_id: result.insertId });
  } catch (err) {
    console.error('Error in product operation:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/last-rbarcode', async (req, res) => {
  try {
    const [result] = await db.query("SELECT rbarcode FROM product WHERE rbarcode LIKE 'RB%' ORDER BY product_id DESC");
    if (result.length > 0) {
      const rbNumbers = result.map(row => row.rbarcode)
        .filter(r => r && r.startsWith('RB'))
        .map(r => parseInt(r.slice(2), 10))
        .filter(n => !isNaN(n));

      const nextRb = rbNumbers.length > 0 ? `RB${String(Math.max(...rbNumbers) + 1).padStart(3, '0')}` : 'RB001';
      return res.json({ lastrbNumbers: nextRb });
    }
    res.json({ lastrbNumbers: 'RB001' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch last rbarcode' });
  }
});

router.get('/last-pbarcode', async (req, res) => {
  try {
    const [result] = await db.query("SELECT rbarcode FROM product WHERE rbarcode LIKE '0%' ORDER BY product_id DESC");
    if (result.length > 0) {
      const PCode_BarCode = result.map(row => row.rbarcode)
        .filter(r => r && r.startsWith('0'))
        .map(r => parseInt(r.slice(2), 10))
        .filter(n => !isNaN(n));

      const nextPCode = PCode_BarCode.length > 0 ? `0${String(Math.max(...PCode_BarCode) + 1).padStart(3, '0')}` : '001';
      return res.json({ lastPCode_BarCode: nextPCode });
    }
    res.json({ lastPCode_BarCode: '001' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch last PCode_BarCode' });
  }
});

module.exports = router;
