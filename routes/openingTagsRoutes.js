const express = require('express');
const router = express.Router();
const moment = require('moment');
const db = require("../db");


// Helper function to sanitize values
const sanitizeValue = (value, defaultValue = 0) => {
  return value === "" || value === null || value === undefined ? defaultValue : value;
};

// Create opening tag
router.post('/post/opening-tags-entry', async (req, res) => {
  try {
    const {
      tag_id,
      product_id,
      account_name,
      invoice,
      Pricing,
      cut,
      color,
      clarity,
      subcategory_id,
      sub_category,
      design_master,
      Prefix = "",
      category = "",
      Purity = "",
      metal_type = "",
      PCode_BarCode = "",
      Gross_Weight = 0,
      Stones_Weight = 0,
      deduct_st_Wt = 0,
      Stones_Price = 0,
      WastageWeight,
      HUID_No = "N/A",
      Wastage_On,
      Wastage_Percentage = 0,
      msp_Wastage_Percentage = 0,
      msp_WastageWeight = 0,
      Weight_BW = 0,
      MC_Per_Gram = 0,
      Making_Charges_On = 0,
      TotalWeight_AW = 0,
      Making_Charges = 0,
      Status = "Available",
      Source = "",
      Stock_Point = "",
      pieace_cost = "",
      Design_Master = "",
      product_Name = "",
      making_on = "",
      selling_price = "",
      dropdown = "",
      qr_status = "No",
      stone_price_per_carat = 0,
      pur_rate_cut = 0,
      pur_Purity = 0,
      pur_purityPercentage = 0,
      pur_Gross_Weight = 0,
      pur_Stones_Weight = 0,
      pur_deduct_st_Wt = 0,
      pur_stone_price_per_carat = 0,
      pur_Stones_Price = 0,
      pur_Weight_BW = 0,
      pur_Making_Charges_On = "",
      pur_MC_Per_Gram = 0,
      pur_Making_Charges = 0,
      pur_Wastage_On = "",
      pur_Wastage_Percentage = 0,
      pur_WastageWeight = 0,
      pur_TotalWeight_AW = 0,
      size,
      tag_weight,
      pcs,
      image,
      tax_percent,
      mrp_price,
      total_pcs_cost,
      printing_purity
    } = req.body;

    const productImage = req.file ? req.file.filename : null;

    const data = {
      tag_id,
      product_id,
      account_name,
      invoice,
      Pricing,
      cut,
      color,
      clarity,
      subcategory_id,
      sub_category,
      design_master,
      Prefix,
      category,
      Purity,
      metal_type,
      PCode_BarCode,
      Gross_Weight: sanitizeValue(Gross_Weight),
      Stones_Weight: sanitizeValue(Stones_Weight),
      deduct_st_Wt: sanitizeValue(deduct_st_Wt),
      Stones_Price: sanitizeValue(Stones_Price),
      WastageWeight: sanitizeValue(WastageWeight),
      HUID_No,
      Wastage_On,
      Wastage_Percentage: sanitizeValue(Wastage_Percentage),
      msp_Wastage_Percentage : sanitizeValue(msp_Wastage_Percentage),
      msp_WastageWeight : sanitizeValue(msp_WastageWeight),
      Weight_BW: sanitizeValue(Weight_BW),
      MC_Per_Gram: sanitizeValue(MC_Per_Gram),
      Making_Charges_On: sanitizeValue(Making_Charges_On),
      TotalWeight_AW: sanitizeValue(TotalWeight_AW),
      Making_Charges: sanitizeValue(Making_Charges),
      Status,
      Source,
      Stock_Point,
      pieace_cost: sanitizeValue(pieace_cost),
      product_Name,
      making_on,
      selling_price: sanitizeValue(selling_price),
      dropdown,
      qr_status,
      productImage,
      stone_price_per_carat: sanitizeValue(stone_price_per_carat),
      pur_rate_cut: sanitizeValue(pur_rate_cut),
      pur_Purity: sanitizeValue(pur_Purity),
      pur_purityPercentage: sanitizeValue(pur_purityPercentage),
      pur_Gross_Weight: sanitizeValue(pur_Gross_Weight),
      pur_Stones_Weight: sanitizeValue(pur_Stones_Weight),
      pur_deduct_st_Wt: sanitizeValue(pur_deduct_st_Wt),
      pur_stone_price_per_carat: sanitizeValue(pur_stone_price_per_carat),
      pur_Stones_Price: sanitizeValue(pur_Stones_Price),
      pur_Weight_BW: sanitizeValue(pur_Weight_BW),
      pur_Making_Charges_On: sanitizeValue(pur_Making_Charges_On),
      pur_MC_Per_Gram: sanitizeValue(pur_MC_Per_Gram),
      pur_Making_Charges: sanitizeValue(pur_Making_Charges),
      pur_Wastage_On: sanitizeValue(pur_Wastage_On),
      pur_Wastage_Percentage: sanitizeValue(pur_Wastage_Percentage),
      pur_WastageWeight: sanitizeValue(pur_WastageWeight),
      pur_TotalWeight_AW: sanitizeValue(pur_TotalWeight_AW),
      size: sanitizeValue(size),
      tag_weight: sanitizeValue(tag_weight),
      pcs: sanitizeValue(pcs),
      image,
      tax_percent: sanitizeValue(tax_percent),
      mrp_price: sanitizeValue(mrp_price),
      total_pcs_cost: sanitizeValue(total_pcs_cost),
      printing_purity: sanitizeValue(printing_purity),
    };

    // Check for existing PCode_BarCode with the same Prefix
    const checkSql = "SELECT PCode_BarCode FROM opening_tags_entry WHERE PCode_BarCode LIKE ? ORDER BY PCode_BarCode DESC LIMIT 1";
    const prefixPattern = data.Prefix + "%";
    
    const [checkResult] = await db.execute(checkSql, [prefixPattern]);

    let startNumber = 1;
    if (checkResult.length > 0) {
      const lastCode = checkResult[0].PCode_BarCode;
      const lastNumber = parseInt(lastCode.replace(data.Prefix, ""), 10);
      startNumber = lastNumber + 1;
    }

    const insertEntries = [];
    for (let i = 0; i < data.pcs; i++) {
      const newPCode_BarCode = `${data.Prefix}${String(startNumber + i).padStart(3, '0')}`;
      const newData = { ...data, PCode_BarCode: newPCode_BarCode, pcs: 1 };
      insertEntries.push(newData);
    }

    const sql = `INSERT INTO opening_tags_entry (
      tag_id, product_id, account_name, invoice, Pricing, cut, color, clarity, subcategory_id, 
      sub_category, design_master, Prefix, category, Purity, metal_type, PCode_BarCode, Gross_Weight, 
      Stones_Weight, deduct_st_Wt, Stones_Price, WastageWeight, HUID_No, Wastage_On, Wastage_Percentage,msp_Wastage_Percentage,msp_WastageWeight,
      Weight_BW, MC_Per_Gram, Making_Charges_On, TotalWeight_AW, Making_Charges, Status, Source, 
      Stock_Point, pieace_cost, product_Name, making_on, selling_price, dropdown, qr_status, 
      stone_price_per_carat, pur_Gross_Weight, pur_Stones_Weight, pur_deduct_st_Wt, pur_stone_price_per_carat, 
      pur_Stones_Price, pur_Weight_BW, pur_Making_Charges_On, pur_MC_Per_Gram, pur_Making_Charges, 
      pur_Wastage_On, pur_Wastage_Percentage, pur_WastageWeight, pur_TotalWeight_AW, tag_weight, size, 
      pcs, image, tax_percent, mrp_price, total_pcs_cost, pur_rate_cut, pur_Purity, pur_purityPercentage, 
      printing_purity
    ) VALUES ?`;

    const values = insertEntries.map(entry => [
      entry.tag_id, entry.product_id, entry.account_name, entry.invoice, entry.Pricing, entry.cut, 
      entry.color, entry.clarity, entry.subcategory_id, entry.sub_category, entry.design_master, 
      entry.Prefix, entry.category, entry.Purity, entry.metal_type, entry.PCode_BarCode, 
      entry.Gross_Weight, entry.Stones_Weight, entry.deduct_st_Wt, entry.Stones_Price, 
      entry.WastageWeight, entry.HUID_No, entry.Wastage_On, entry.Wastage_Percentage, entry.msp_Wastage_Percentage,entry.msp_WastageWeight,
      entry.Weight_BW, entry.MC_Per_Gram, entry.Making_Charges_On, entry.TotalWeight_AW, 
      entry.Making_Charges, entry.Status, entry.Source, entry.Stock_Point, entry.pieace_cost, 
      entry.product_Name, entry.making_on, entry.selling_price, entry.dropdown, entry.qr_status, 
      entry.stone_price_per_carat, entry.pur_Gross_Weight, entry.pur_Stones_Weight, 
      entry.pur_deduct_st_Wt, entry.pur_stone_price_per_carat, entry.pur_Stones_Price, 
      entry.pur_Weight_BW, entry.pur_Making_Charges_On, entry.pur_MC_Per_Gram, entry.pur_Making_Charges, 
      entry.pur_Wastage_On, entry.pur_Wastage_Percentage, entry.pur_WastageWeight, entry.pur_TotalWeight_AW, 
      entry.tag_weight, entry.size, entry.pcs, entry.image, entry.tax_percent, entry.mrp_price, 
      entry.total_pcs_cost, entry.pur_rate_cut, entry.pur_Purity, entry.pur_purityPercentage, 
      entry.printing_purity
    ]);

    const [result] = await db.query(sql, [values]);

    // Update the updated_values_table after successful insertion
    const updateSql = `UPDATE updated_values_table
      SET bal_pcs = bal_pcs - ?, 
          bal_gross_weight = bal_gross_weight - ?
      WHERE product_id = ? AND tag_id = ?`;

    await db.execute(updateSql, [data.pcs, data.Gross_Weight, data.product_id, data.tag_id]);

    res.status(200).json({ message: "Data inserted successfully", result });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database insertion failed", details: err });
  }
});

// Get all opening tags
router.get('/get/opening-tags-entry', async (req, res) => {
  try {
    const sql = `SELECT * FROM opening_tags_entry`;
    const [result] = await db.execute(sql);
    
    if (result.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }
    
    res.status(200).json({ message: "Data retrieved successfully", result });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database query failed", details: err });
  }
});

// Update opening tag
router.put('/update/opening-tags-entry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let updatedData = req.body;

    // Handle empty strings for fields that expect decimals
    if (updatedData.Making_Charges === '') {
      updatedData.Making_Charges = null;
    }

    // Convert 'added_at' field to MySQL-compatible format if it exists
    if (updatedData.added_at) {
      updatedData.added_at = moment(updatedData.added_at).format('YYYY-MM-DD HH:mm:ss');
    }

    // Step 1: Fetch the current `product_id` and `Gross_Weight` from `opening_tags_entry`
    const getOpeningTagQuery = `SELECT product_id, tag_id, Gross_Weight FROM opening_tags_entry WHERE opentag_id = ?`;
    const [result] = await db.execute(getOpeningTagQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    const { product_id, tag_id, Gross_Weight: oldGrossWeight } = result[0];
    const newGrossWeight = updatedData.Gross_Weight;

    // Step 2: Update `updated_values_table`
    const updateValuesQuery = `UPDATE updated_values_table 
      SET bal_gross_weight = bal_gross_weight + ? - ? 
      WHERE product_id = ? AND tag_id = ?`;

    await db.execute(updateValuesQuery, [oldGrossWeight, newGrossWeight, product_id, tag_id]);

    // Step 3: Update `opening_tags_entry` with new values
    const sql = `UPDATE opening_tags_entry SET ? WHERE opentag_id = ?`;
    const [updateResult] = await db.query(sql, [updatedData, id]);
    
    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Record not found" });
    }
    
    res.status(200).json({ message: "Data updated successfully" });
  } catch (err) {
    console.error("Database error updating opening tag:", err);
    res.status(500).json({ error: "Database update failed", details: err });
  }
});

// Delete opening tag
router.delete('/delete/opening-tags-entry/:opentag_id', async (req, res) => {
  try {
    const { opentag_id } = req.params;
    const id = parseInt(opentag_id, 10);

    if (!id || isNaN(id)) {
      return res.status(400).json({ error: "Invalid ID received" });
    }

    // Fetch record to get `tag_id`, `product_id`, and `Gross_Weight`
    const getOpeningTagQuery = `SELECT product_id, tag_id, Gross_Weight FROM opening_tags_entry WHERE opentag_id = ?`;
    const [result] = await db.execute(getOpeningTagQuery, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ message: "Record not found" });
    }

    const { product_id, tag_id, Gross_Weight } = result[0];
    const formattedTagId = typeof tag_id === "number" ? tag_id.toString() : tag_id;
    const formattedProductId = parseInt(product_id, 10);

    if (isNaN(formattedProductId)) {
      return res.status(400).json({ error: "Invalid product_id" });
    }

    // Update `updated_values_table`
    const updateValuesQuery = `UPDATE updated_values_table 
      SET bal_gross_weight = bal_gross_weight + ?, bal_pcs = bal_pcs + 1 
      WHERE product_id = ? AND tag_id = CAST(? AS CHAR)`;

    await db.execute(updateValuesQuery, [Gross_Weight, formattedProductId, formattedTagId]);

    // Delete from `opening_tags_entry`
    const deleteQuery = `DELETE FROM opening_tags_entry WHERE opentag_id = ?`;
    const [deleteResult] = await db.execute(deleteQuery, [id]);
    
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: "No record found to delete" });
    }

    res.status(200).json({ message: "Opening tag deleted successfully" });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database error while deleting opening tag", details: err });
  }
});

// Create subcategory
router.post('/post/subcategory', async (req, res) => {
  try {
    const { category_id, sub_category_name, category, prefix, metal_type, purity, selling_purity, printing_purity } = req.body;
    
    const query = 'INSERT INTO subcategory (category_id, sub_category_name, category, prefix, metal_type, purity, selling_purity, printing_purity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const [results] = await db.execute(query, [category_id, sub_category_name, category, prefix, metal_type, purity, selling_purity, printing_purity]);
    
    res.status(201).json({ message: 'Subcategory created successfully', subcategory_id: results.insertId });
  } catch (err) {
    console.error('Error inserting data:', err);
    res.status(500).json({ message: 'Error inserting data' });
  }
});

// Get all subcategories
router.get('/get/subcategories', async (req, res) => {
  try {
    const query = 'SELECT * FROM subcategory';
    const [results] = await db.execute(query);
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ message: 'Error fetching data' });
  }
});

// Get subcategory by ID
router.get('/get/subcategory/:id', async (req, res) => {
  try {
    const subcategoryId = req.params.id;
    const query = 'SELECT * FROM subcategory WHERE subcategory_id = ?';
    const [results] = await db.execute(query, [subcategoryId]);
    
    if (results.length === 0) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    
    res.status(200).json(results[0]);
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).json({ message: 'Error fetching data' });
  }
});

// Get last PCode
router.get('/last-pbarcode', async (req, res) => {
  try {
    const query = "SELECT rbarcode FROM product WHERE rbarcode LIKE '0%' ORDER BY subcategory_id DESC";
    const [result] = await db.execute(query);

    if (result && result.length > 0) {
      const PCode_BarCode = result
        .map(row => row.rbarcode)
        .filter(product => product && product.startsWith("0"))
        .map(product => parseInt(product.slice(2), 10))
        .filter(number => !isNaN(number));

      if (PCode_BarCode.length > 0) {
        const lastPCode_BarCode = Math.max(...PCode_BarCode);
        const nextPCode_BarCode = `0${String(lastPCode_BarCode + 1).padStart(3, "0")}`;
        return res.json({ lastPCode_BarCode: nextPCode_BarCode });
      }
    }

    res.json({ lastPCode_BarCode: "001" });
  } catch (err) {
    console.error("Error fetching last PCode_BarCode:", err);
    res.status(500).json({ error: "Failed to fetch last PCode_BarCode" });
  }
});

// Get next PCode BarCode
router.get('/getNextPCodeBarCode', async (req, res) => {
  try {
    const { prefix } = req.query;

    if (!prefix) {
      return res.status(400).json({ error: "Prefix is required" });
    }

    const sql = `SELECT PCode_BarCode FROM opening_tags_entry WHERE Prefix = ? ORDER BY PCode_BarCode DESC LIMIT 1`;
    const [results] = await db.execute(sql, [prefix]);

    let nextCode;
    if (results.length > 0) {
      const lastCode = results[0].PCode_BarCode;
      const numericPart = parseInt(lastCode.slice(prefix.length)) || 0;
      nextCode = `${prefix}${String(numericPart + 1).padStart(3, '0')}`;
    } else {
      nextCode = `${prefix}001`;
    }

    res.status(200).json({ nextPCodeBarCode: nextCode });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: "Database query failed", details: err });
  }
});

module.exports = router;