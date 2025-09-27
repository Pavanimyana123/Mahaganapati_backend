const express = require('express');
const db = require('../db'); // Import the MySQL connection pool

const router = express.Router();

// Login API
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Validate request body
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    // Query database for user by email
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    const user = rows[0];

    // **NOTE:** This is a plain text password check, insecure for production
    if (password !== user.password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Successful login
    return res.status(200).json({
      success: true,
      role: user.role,
      userId: user.id,
      fullName: user.user_name, // Ensure column name matches your DB
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;
