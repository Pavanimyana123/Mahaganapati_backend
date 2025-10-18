const express = require('express');
const db = require('../db'); // Import the MySQL connection pool

const router = express.Router();

// Login API
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = rows[0];

    if (password !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // ✅ Successful login — return all user details except password fields
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        user_name: user.user_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
        user_type_id: user.user_type_id,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});


module.exports = router;
