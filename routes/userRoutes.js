const express = require('express');
const router = express.Router();
const db = require('../db');

// Create user
router.post('/users', async (req, res) => {
  const { user_name, email, phone_number, role, password, retype_password } = req.body;
  if (password !== retype_password) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  try {
    const query = `
      INSERT INTO users (user_name, email, phone_number, role, password, retype_password)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(query, [user_name, email, phone_number, role, password, retype_password]);
    res.status(201).json({ message: 'User created successfully', userId: result.insertId });
  } catch (err) {
    console.error('Error inserting user:', err.message);
    res.status(500).json({ message: 'Error inserting user' });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM users');
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching users:', err.message);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Get user by ID
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [results] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(results[0]);
  } catch (err) {
    console.error('Error fetching user:', err.message);
    res.status(500).json({ message: 'Error fetching user' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  const { id } = req.params;
  const { user_name, email, phone_number, role } = req.body;

  try {
    const [result] = await db.query(
      'UPDATE users SET user_name = ?, email = ?, phone_number = ?, role = ? WHERE id = ?',
      [user_name, email, phone_number, role, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err.message);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

module.exports = router;
