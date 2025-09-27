// api/rateCuts.js
const express = require("express");
const db = require("../db"); // MySQL connection pool
const router = express.Router();

/**
 * GET all rate cuts
 */
router.get("/rateCuts", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM rateCuts");
    res.status(200).json(rows);
  } catch (err) {
    console.error("Error fetching rateCuts:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * GET a single rate cut by ID
 */
router.get("/rateCuts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query("SELECT * FROM rateCuts WHERE rate_cut_id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Rate cut not found" });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error("Error fetching rateCut by ID:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/**
 * POST - Add a new rate cut and update purchase table
 */
router.post("/rateCuts", async (req, res) => {
  const formData = req.body;

  try {
    // Ensure numeric values or default to 0
    const paid_amount = formData.paid_amount ? parseFloat(formData.paid_amount) : 0;
    const balance_amount = formData.balance_amount ? parseFloat(formData.balance_amount) : 0;
    const rate_cut_wt = formData.rate_cut_wt ? parseFloat(formData.rate_cut_wt) : 0;
    const rate_cut = formData.rate_cut ? parseFloat(formData.rate_cut) : 0;

    // Calculate paid_wt and bal_wt safely
    const paid_wt = paid_amount && rate_cut ? paid_amount / rate_cut : 0;
    const bal_wt = rate_cut_wt - paid_wt;

    // Insert into rateCuts table
    const insertQuery = `
      INSERT INTO rateCuts 
      (purchase_id, invoice, category, total_pure_wt, rate_cut_wt, rate_cut, rate_cut_amt, paid_amount, balance_amount, paid_wt, bal_wt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [insertResult] = await db.query(insertQuery, [
      formData.purchase_id,
      formData.invoice,
      formData.category,
      parseFloat(formData.total_pure_wt) || 0,
      rate_cut_wt,
      rate_cut,
      parseFloat(formData.rate_cut_amt) || 0,
      paid_amount,
      balance_amount,
      paid_wt,
      bal_wt,
    ]);

    // Update purchases table
    const updatePurchaseQuery = `
      UPDATE purchases 
      SET paid_wt = COALESCE(paid_wt, 0) + ?, 
          balWt_after_payment = COALESCE(?, 0) - COALESCE(?, 0)
      WHERE id = ?
    `;

    await db.query(updatePurchaseQuery, [
      rate_cut_wt,
      parseFloat(formData.total_pure_wt) || 0,
      rate_cut_wt,
      formData.purchase_id,
    ]);

    res.status(200).json({
      message: "Rate cut details stored successfully and purchase updated.",
      insertId: insertResult.insertId,
    });
  } catch (error) {
    console.error("Error inserting rate cut:", error);
    res.status(500).json({ error: "Database error." });
  }
});

module.exports = router;
