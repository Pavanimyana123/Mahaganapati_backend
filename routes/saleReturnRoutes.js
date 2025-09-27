const express = require('express');
const db = require('../db');
const router = express.Router();


// Update repair details
router.post('/updateRepairDetails', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ message: "Invalid updates data" });
    }

    for (const update of updates) {
      if (!update.id || !update.status) {
        return res.status(400).json({ message: "Each update must contain id and status" });
      }
      
      await db.execute(
        "UPDATE repair_details SET status = ? WHERE id = ?",
        [update.status, update.id]
      );
    }
    
    res.status(200).json({ message: "Repair details updated successfully!" });
  } catch (error) {
    console.error("Error updating repair details:", error);
    res.status(500).json({ message: "Failed to update repair details.", error: error.message });
  }
});

// Update open tags
router.post('/updateOpenTags', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ message: "Invalid updates data" });
    }

    for (const update of updates) {
      if (!update.PCode_BarCode || !update.Status) {
        return res.status(400).json({ message: "Each update must contain PCode_BarCode and Status" });
      }
      
      await db.execute(
        "UPDATE opening_tags_entry SET Status = ? WHERE PCode_BarCode = ?",
        [update.Status, update.PCode_BarCode]
      );
    }
    
    res.status(200).json({ message: "Open tags updated successfully!" });
  } catch (error) {
    console.error("Error updating open tags:", error);
    res.status(500).json({ message: "Failed to update open tags.", error: error.message });
  }
});

// Add available entry
router.post('/addAvailableEntry', async (req, res) => {
  try {
    const { codes } = req.body;
    
    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({ message: "Invalid codes data" });
    }

    for (const code of codes) {
      if (!code) {
        console.warn("Skipping empty code");
        continue;
      }

      // Fetch the entry for the given code
      const [results] = await db.execute(
        "SELECT * FROM opening_tags_entry WHERE PCode_BarCode = ?",
        [code]
      );

      if (results.length === 0) {
        console.warn(`No matched entries found for code: ${code}`);
        continue;
      }

      const matchedEntry = results[0];
      const prefix = matchedEntry.Prefix;

      // Query the highest PCode_BarCode for the same prefix
      const [maxResult] = await db.execute(
        "SELECT MAX(PCode_BarCode) AS max_code FROM opening_tags_entry WHERE PCode_BarCode LIKE ?",
        [prefix + '%']
      );

      const maxCode = maxResult[0].max_code;
      let newCode = prefix + '001'; // Default new code if no max code found

      if (maxCode) {
        const numberRegex = /(\d+)$/;
        const match = maxCode.match(numberRegex);
        if (match && match[1]) {
          // Increment the numeric part of the PCode_BarCode
          const newNumber = (parseInt(match[1], 10) + 1).toString().padStart(3, '0');
          newCode = prefix + newNumber;
        }
      }

      // Insert the new entry with the newly generated PCode_BarCode
      await db.execute(
        `INSERT INTO opening_tags_entry (
          product_id, 
          subcategory_id, 
          sub_category, 
          Pricing, 
          Tag_ID, 
          Prefix, 
          category, 
          Purity, 
          metal_type, 
          PCode_BarCode, 
          Gross_Weight, 
          Stones_Weight, 
          Stones_Price, 
          WastageWeight, 
          HUID_No, 
          Wastage_On, 
          Wastage_Percentage, 
          Weight_BW, 
          MC_Per_Gram, 
          Making_Charges_On, 
          TotalWeight_AW, 
          Making_Charges, 
          Status, 
          Source, 
          Stock_Point, 
          making_on, 
          dropdown, 
          selling_price, 
          design_master, 
          product_Name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          matchedEntry.product_id,
          matchedEntry.subcategory_id,
          matchedEntry.sub_category,
          matchedEntry.Pricing,
          matchedEntry.Tag_ID,
          matchedEntry.Prefix,
          matchedEntry.category,
          matchedEntry.Purity,
          matchedEntry.metal_type,
          newCode,
          matchedEntry.Gross_Weight,
          matchedEntry.Stones_Weight,
          matchedEntry.Stones_Price,
          matchedEntry.WastageWeight,
          matchedEntry.HUID_No,
          matchedEntry.Wastage_On,
          matchedEntry.Wastage_Percentage,
          matchedEntry.Weight_BW,
          matchedEntry.MC_Per_Gram,
          matchedEntry.Making_Charges_On,
          matchedEntry.TotalWeight_AW,
          matchedEntry.Making_Charges,
          "Available",
          matchedEntry.Source,
          matchedEntry.Stock_Point,
          matchedEntry.making_on,
          matchedEntry.dropdown,
          matchedEntry.selling_price,
          matchedEntry.design_master,
          matchedEntry.product_Name
        ]
      );

      console.log(`Entry successfully added for code ${newCode}`);
    }

    res.status(200).json({ message: "Entries with status 'Available' added successfully!" });
  } catch (error) {
    console.error("Error adding available entries:", error);
    res.status(500).json({ message: "Failed to add available entries.", error: error.message });
  }
});

// Update product
router.post('/updateProduct', async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({ message: "Invalid updates data" });
    }

    for (const update of updates) {
      if (!update.product_id) {
        console.warn("Skipping update without product_id");
        continue;
      }

      const { product_id, qty = 0, gross_weight = 0 } = update;

      // Fetch current product data
      const [results] = await db.execute(
        "SELECT salereturn_qty, salereturn_weight FROM product WHERE product_id = ?",
        [product_id]
      );

      if (results.length === 0) {
        console.warn(`Product with ID ${product_id} not found`);
        continue;
      }

      const product = results[0];

      // Ensure numeric values, handling null cases properly
      const currentQty = Number(product.salereturn_qty) || 0;
      const currentWeight = Number(product.salereturn_weight) || 0;
      const newQty = currentQty + (Number(qty) || 0);
      const newWeight = currentWeight + (Number(gross_weight) || 0);

      // Update product with new values
      await db.execute(
        "UPDATE product SET salereturn_qty = ?, salereturn_weight = ? WHERE product_id = ?",
        [newQty, newWeight.toFixed(2), product_id]
      );
    }

    res.status(200).json({ message: "Product updated successfully!" });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Failed to update product.", error: error.message });
  }
});


module.exports = router;