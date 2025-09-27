const express = require('express');
const db = require('../db');
const router = express.Router();

// Add a new product stone detail
router.post('/post/addProductstonedetails', async (req, res) => {
  try {
    const { subproductname, weight, c_weight, ratepergram, amount, totalweight, totalprice, cut, color, clarity } = req.body;

    // Validate required fields
    if (!subproductname || weight === null || weight === undefined || ratepergram === null || ratepergram === undefined || amount === null || amount === undefined || totalweight === null || totalweight === undefined || totalprice === null || totalprice === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const query = `
      INSERT INTO productstockentry_stone_details (subproductname, weight, c_weight, ratepergram, amount, totalweight, totalprice, cut, color, clarity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await db.execute(query, [
      subproductname, 
      weight, 
      c_weight, 
      ratepergram, 
      amount, 
      totalweight, 
      totalprice, 
      cut, 
      color, 
      clarity
    ]);

    res.status(200).json({ 
      message: "Data inserted successfully", 
      result: {
        insertId: result.insertId,
        affectedRows: result.affectedRows
      }
    });
  } catch (error) {
    console.error("Error inserting data:", error);
    res.status(500).json({ error: "Failed to insert data", details: error.message });
  }
});

// Fetch all product stone details
router.get('/get/getProductstonedetails', async (req, res) => {
  try {
    const query = 'SELECT * FROM productstockentry_stone_details';
    const [results] = await db.execute(query);
    
    res.status(200).json({ 
      message: "Data fetched successfully",
      products: results 
    });
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
});

// Update a product stone detail
router.put('/put/updateProductstonedetails/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subproductname, weight, c_weight, amount, ratepergram, totalweight, totalprice, cut, color, clarity } = req.body;

    // Validate ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const query = `
      UPDATE productstockentry_stone_details 
      SET subproductname = ?, weight = ?, c_weight = ?, ratepergram = ?, amount = ?,
          totalweight = ?, totalprice = ?, cut = ?, color = ?, clarity = ?
      WHERE id = ?
    `;
    
    const [result] = await db.execute(query, [
      subproductname, 
      weight, 
      c_weight, 
      ratepergram, 
      amount, 
      totalweight, 
      totalprice, 
      cut, 
      color, 
      clarity, 
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ 
      message: 'Product updated successfully',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error updating data:', error.message);
    res.status(500).json({ error: 'Failed to update data', details: error.message });
  }
});

// Delete a product stone detail
router.delete('/delete/deleteProductstonedetails/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const query = 'DELETE FROM productstockentry_stone_details WHERE id = ?';
    const [result] = await db.execute(query, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.status(200).json({ 
      message: 'Product deleted successfully',
      affectedRows: result.affectedRows
    });
  } catch (error) {
    console.error('Error deleting data:', error.message);
    res.status(500).json({ error: 'Failed to delete data', details: error.message });
  }
});


module.exports = router;