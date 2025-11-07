const express = require('express');
const db = require('../db'); // mysql2 promise connection
const router = express.Router();

router.post('/add/repairs', async (req, res) => {
  try {
    const data = req.body;

    // Helper function to handle empty or null numeric fields
    const sanitizeDecimal = (value, defaultValue = 0) =>
      value === "" || value === null ? defaultValue : Number(value);

    // ✅ Calculate derived values
    const gross_weight = sanitizeDecimal(data.gross_weight);
    const extra_weight = sanitizeDecimal(data.extra_weight);
    const estimated_dust = sanitizeDecimal(data.estimated_dust);
    const estimated_amt = sanitizeDecimal(data.estimated_amt);
    const making_charge = sanitizeDecimal(data.making_charge);

    const gross_wt_after_repair = gross_weight + extra_weight - estimated_dust;
    const total_amt = estimated_amt + making_charge;

    const sql = `
      INSERT INTO repairs (
        customer_id, account_name, mobile, email, address1, address2, address3, city, staff, delivery_date,
        place, metal, counter, entry_type, repair_no, date, metal_type, item,
        tag_no, description, purity, category, sub_category, gross_weight, pcs, estimated_dust, estimated_amt,
        extra_weight, stone_value, making_charge, handling_charge, total, status, image,
        gross_wt_after_repair, total_amt
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.customer_id,
      data.account_name,
      data.mobile,
      data.email,
      data.address1,
      data.address2,
      data.address3,
      data.city,
      data.staff,
      data.delivery_date,
      data.place,
      data.metal,
      data.counter,
      data.entry_type,
      data.repair_no,
      data.date,
      data.metal_type,
      data.item,
      data.tag_no,
      data.description,
      data.purity,
      data.category,
      data.sub_category,
      gross_weight,
      sanitizeDecimal(data.pcs),
      estimated_dust,
      estimated_amt,
      extra_weight,
      sanitizeDecimal(data.stone_value),
      making_charge,
      sanitizeDecimal(data.handling_charge),
      sanitizeDecimal(data.total),
      data.status,
      data.image,
      gross_wt_after_repair,
      total_amt
    ];

    const [result] = await db.query(sql, values);
    res.status(201).json({
      message: 'Repair entry added successfully',
      repairId: result.insertId
    });
  } catch (error) {
    console.error('Error inserting repair:', error);
    res.status(500).json({ error: 'Failed to add repair' });
  }
});


router.get('/get/repairs', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM repairs ORDER BY date DESC');
    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching repairs:', error);
    res.status(500).json({ error: 'Failed to fetch repairs' });
  }
});

router.get('/get/repairs/:id', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM repairs WHERE repair_id = ?', [req.params.id]);
    if (results.length === 0) return res.status(404).json({ message: 'Repair entry not found' });
    res.status(200).json(results[0]);
  } catch (error) {
    console.error('Error fetching repair:', error);
    res.status(500).json({ error: 'Failed to fetch repair' });
  }
});

router.put('/update/repairs/:id', async (req, res) => {
  try {
    const data = req.body;

    const sql = `
      UPDATE repairs SET 
        customer_id = ?, account_name = ?, mobile = ?, email = ?, address1 = ?, address2 = ?, address3 = ?, city = ?, 
        staff = ?, delivery_date = ?, place = ?, metal = ?, counter = ?, entry_type = ?, repair_no = ?, date = ?, metal_type = ?, item = ?, 
        tag_no = ?, description = ?, purity = ?, category = ?, sub_category = ?, gross_weight = ?, pcs = ?, estimated_dust = ?, estimated_amt = ?, 
        extra_weight = ?, stone_value = ?, making_charge = ?, handling_charge = ?, total = ?, status = ?, image = ?
      WHERE repair_id = ?
    `;

    const sanitizeDecimal = (value, defaultValue = 0) => value === "" || value === null ? defaultValue : value;

    const values = [
      data.customer_id, data.account_name, data.mobile, data.email, data.address1, data.address2, data.address3, data.city,
      data.staff, data.delivery_date, data.place, data.metal, data.counter, data.entry_type, data.repair_no, data.date, data.metal_type, data.item,
      data.tag_no, data.description, data.purity, data.category, data.sub_category, sanitizeDecimal(data.gross_weight),
      sanitizeDecimal(data.pcs), sanitizeDecimal(data.estimated_dust), sanitizeDecimal(data.estimated_amt),
      sanitizeDecimal(data.extra_weight), sanitizeDecimal(data.stone_value), sanitizeDecimal(data.making_charge),
      sanitizeDecimal(data.handling_charge), sanitizeDecimal(data.total), data.status, data.image, req.params.id
    ];

    const [result] = await db.query(sql, values);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Repair entry not found' });
    res.status(200).json({ message: 'Repair entry updated successfully' });

  } catch (error) {
    console.error('Error updating repair:', error);
    res.status(500).json({ error: 'Failed to update repair' });
  }
});

router.delete('/delete/repairs/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM repairs WHERE repair_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Repair entry not found' });
    res.status(200).json({ message: 'Repair entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting repair:', error);
    res.status(500).json({ error: 'Failed to delete repair' });
  }
});

router.get('/lastRPNNumber', async (req, res) => {
  try {
    const [results] = await db.query("SELECT repair_no FROM repairs WHERE repair_no LIKE 'RPN%' ORDER BY repair_no DESC LIMIT 1");
    let nextRPNNumber = 'RPN001';
    if (results.length > 0) {
      const lastNumber = parseInt(results[0].repair_no.slice(3), 10);
      nextRPNNumber = `RPN${String(lastNumber + 1).padStart(3, '0')}`;
    }
    res.status(200).json({ lastRPNNumber: nextRPNNumber });
  } catch (error) {
    console.error('Error fetching last RPN number:', error);
    res.status(500).json({ error: 'Failed to fetch last RPN number' });
  }
});

module.exports = router;
