const express = require("express");
const router = express.Router();
const db = require("../db"); // MySQL connection pool

// Insert or update the single record in WastageMaster
router.post("/save-wastage", async (req, res) => {
  const { mrp, msp } = req.body;

  if (mrp === undefined || msp === undefined) {
    return res.status(400).json({ error: "MRP and MSP are required." });
  }

  try {
    // Check if a record already exists
    const [rows] = await db.query("SELECT * FROM WastageMaster LIMIT 1");

    if (rows.length > 0) {
      // Update existing record
      const wastageId = rows[0].WastageID;
      await db.query(
        "UPDATE WastageMaster SET MRP = ?, MSP = ?, UpdatedAt = NOW() WHERE WastageID = ?",
        [mrp, msp, wastageId]
      );
      return res.json({ message: "Wastage details updated successfully." });
    } else {
      // Insert new record
      await db.query("INSERT INTO WastageMaster (MRP, MSP) VALUES (?, ?)", [mrp, msp]);
      return res.json({ message: "Wastage details added successfully." });
    }
  } catch (error) {
    console.error("Error saving wastage details:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/get-wastage", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM WastageMaster LIMIT 1");
    res.json(rows[0] || {});
  } catch (error) {
    console.error("Error fetching wastage:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;
