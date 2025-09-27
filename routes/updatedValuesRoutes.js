// api/updatedValues.js
const express = require("express");
const db = require("../db"); // your db.js

const router = express.Router();


router.post("/add-entry", async (req, res) => {
  const { product_id, pcs, gross_weight, tag_id } = req.body;

  if (!product_id || !tag_id) {
    return res.status(400).json({ error: "Product ID and Tag ID are required" });
  }

  try {
    const [results] = await db.query(
      `SELECT pcs, gross_weight, bal_pcs, bal_gross_weight 
       FROM updated_values_table 
       WHERE tag_id = ? AND product_id = ?`,
      [tag_id, product_id]
    );

    let bal_pcs, bal_gross_weight;

    if (results.length > 0) {
      // Update existing record
      const existingData = results[0];

      const old_pcs = parseInt(existingData.pcs);
      const old_gross_weight = parseFloat(existingData.gross_weight);

      const current_bal_pcs = parseInt(existingData.bal_pcs) || old_pcs;
      const current_bal_gross_weight = parseFloat(existingData.bal_gross_weight) || old_gross_weight;

      const diff_pcs = pcs - old_pcs;
      const diff_gross_weight = gross_weight - old_gross_weight;

      bal_pcs = diff_pcs > 0 ? current_bal_pcs + diff_pcs : current_bal_pcs - Math.abs(diff_pcs);
      bal_gross_weight =
        diff_gross_weight > 0
          ? current_bal_gross_weight + diff_gross_weight
          : current_bal_gross_weight - Math.abs(diff_gross_weight);

      await db.query(
        `UPDATE updated_values_table
         SET pcs = ?, gross_weight = ?, bal_pcs = ?, bal_gross_weight = ?
         WHERE tag_id = ? AND product_id = ?`,
        [pcs, gross_weight, bal_pcs, bal_gross_weight, tag_id, product_id]
      );

      res.status(200).json({ message: "Entry updated successfully" });
    } else {
      // Insert new record
      bal_pcs = pcs;
      bal_gross_weight = gross_weight;

      const [insertResult] = await db.query(
        `INSERT INTO updated_values_table (product_id, pcs, gross_weight, bal_pcs, bal_gross_weight, tag_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [product_id, pcs, gross_weight, bal_pcs, bal_gross_weight, tag_id]
      );

      res.status(201).json({ message: "Entry added successfully", entryId: insertResult.insertId });
    }
  } catch (err) {
    console.error("Error adding/updating entry:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/entry/:productId/:tagId", async (req, res) => {
  const { productId, tagId } = req.params;

  if (!productId || !tagId) {
    return res.status(400).json({ error: "Product ID and Tag ID are required" });
  }

  try {
    const [results] = await db.query(
      "SELECT * FROM updated_values_table WHERE product_id = ? AND tag_id = ?",
      [productId, tagId]
    );

    if (results.length === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }

    res.status(200).json(results[0]);
  } catch (err) {
    console.error("Error fetching entry:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/max-tag-id", async (req, res) => {
  try {
    const [result] = await db.query("SELECT MAX(tag_id) AS maxTag FROM updated_values_table");
    const maxTag = result[0].maxTag || 0;
    res.json({ nextTagId: maxTag + 1 });
  } catch (err) {
    console.error("Error fetching max tag_id:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.delete("/delete/updatedvalues/:tag_id/:product_id", async (req, res) => {
  const { tag_id, product_id } = req.params;

  try {
    const [result] = await db.query(
      "DELETE FROM updated_values_table WHERE tag_id = ? AND product_id = ?",
      [tag_id, product_id]
    );

    if (result.affectedRows > 0) {
      res.status(200).json({ message: "Entry deleted successfully" });
    } else {
      res.status(404).json({ message: "Entry not found" });
    }
  } catch (err) {
    console.error("Error deleting entry:", err);
    res.status(500).json({ error: "Database error" });
  }
});

router.get("/get-balance/:product_id/:tag_id", async (req, res) => {
  const { product_id, tag_id } = req.params;

  if (!product_id || !tag_id) {
    return res.status(400).json({ error: "Product ID and Tag ID are required" });
  }

  try {
    const [results] = await db.query(
      `SELECT bal_pcs, bal_gross_weight 
       FROM updated_values_table 
       WHERE product_id = ? AND tag_id = ?`,
      [product_id, tag_id]
    );

    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ error: "No matching record found" });
    }
  } catch (err) {
    console.error("Error fetching balance:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;
