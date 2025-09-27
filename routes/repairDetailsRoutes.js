const express = require('express');
const db = require('../db'); // mysql2 promise connection
const router = express.Router();

router.post('/assign/repairdetails', async (req, res) => {
  try {
    const requestData = req.body; // Array of repair details
    if (!Array.isArray(requestData) || requestData.length === 0) {
      return res.status(400).json({ error: 'Request body must be a non-empty array' });
    }

    const repairIds = requestData.map(item => item.repair_id);

    // Bulk insert into assigned_repairdetails
    const insertQuery = `
      INSERT INTO assigned_repairdetails (repair_id, item_name, purity, qty, weight, rate_type, rate, amount)
      VALUES ?
    `;
    const values = requestData.map(item => [
      item.repair_id,
      item.item_name,
      item.purity,
      item.qty,
      item.weight,
      item.rate_type,
      item.rate,
      item.amount,
    ]);
    await db.query(insertQuery, [values]);

    // Update repair status in repairs table
    const updateStatusQuery = `
      UPDATE repairs
      SET status = 'Assign to Workshop'
      WHERE repair_id IN (?)
    `;
    await db.query(updateStatusQuery, [repairIds]);

    res.status(200).json({ message: 'Data stored and status updated successfully!' });

  } catch (error) {
    console.error('Error storing data:', error);
    res.status(500).json({ error: 'Failed to store data and update status' });
  }
});

router.get('/assigned-repairdetails', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM assigned_repairdetails');
    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching repair details:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

router.get('/assigned-repairdetails/:id', async (req, res) => {
  try {
    const [results] = await db.query(
      'SELECT * FROM assigned_repairdetails WHERE repair_id = ?',
      [req.params.id]
    );
    if (results.length === 0) return res.status(404).json({ message: 'No repair details found' });
    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching repair details:', error);
    res.status(500).json({ error: 'Failed to fetch repair details' });
  }
});

router.put('/assigned-repairdetails/:id', async (req, res) => {
  try {
    const { item_name, purity, qty, weight, rate_type, rate, amount } = req.body;
    const [result] = await db.query(
      `
      UPDATE assigned_repairdetails 
      SET item_name = ?, purity = ?, qty = ?, weight = ?, rate_type = ?, rate = ?, amount = ?
      WHERE id = ?
      `,
      [item_name, purity, qty, weight, rate_type, rate, amount, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Repair detail not found' });
    res.status(200).json({ message: 'Repair detail updated successfully' });
  } catch (error) {
    console.error('Error updating repair detail:', error);
    res.status(500).json({ error: 'Failed to update repair detail' });
  }
});

router.post('/update-status', async (req, res) => {
  try {
    const { repairId, status } = req.body;
    if (!repairId || !status) return res.status(400).json({ error: 'repairId and status are required' });

    const [result] = await db.query(
      'UPDATE repairs SET status = ? WHERE repair_id = ?',
      [status, repairId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Repair not found' });

    res.status(200).json({ message: 'Repair status updated successfully' });
  } catch (error) {
    console.error('Error updating repair status:', error);
    res.status(500).json({ error: 'Failed to update repair status' });
  }
});

router.delete('/assigned-repairdetails/:id', async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM assigned_repairdetails WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Repair record not found' });
    res.status(200).json({ message: 'Repair record deleted successfully' });
  } catch (error) {
    console.error('Error deleting repair detail:', error);
    res.status(500).json({ error: 'Failed to delete repair record' });
  }
});

module.exports = router;
