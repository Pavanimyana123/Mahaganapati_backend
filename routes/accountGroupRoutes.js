const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/accountsgroup', async (req, res) => {
  try {
    const [results] = await db.query('SELECT `AccountsGroupName` FROM `accountgroup`');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching accounts group names:', err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

router.post('/post/states', async (req, res) => {
  const { state_name, state_code } = req.body;

  if (!state_name || !state_code) {
    return res.status(400).json({ error: "State name and state code are required." });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO states (state_name, state_code) VALUES (?, ?)',
      [state_name, state_code]
    );
    res.status(201).json({ message: 'State added successfully.', state_id: result.insertId });
  } catch (err) {
    console.error('Error inserting state:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

router.get('/get/states', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM states');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching states:', err);
    res.status(500).json({ error: 'Database error.' });
  }
});

module.exports = router;
