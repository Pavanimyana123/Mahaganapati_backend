const express = require('express');
const db = require('../db'); // Database connection
const router = express.Router();


const convertTo24HourTime = (timeStr) => {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes, seconds] = time.split(':').map(Number);

  if (modifier === 'PM' && hours !== 12) {
    hours += 12;
  } else if (modifier === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};


router.post('/post/rates', async (req, res) => {
  const {
    rate_date,
    rate_time,
    rate_16crt,
    rate_18crt,
    rate_22crt,
    rate_24crt,
    silver_rate,
  } = req.body;

  // Validate required fields
  if (!rate_date || !rate_time || !rate_16crt || !rate_18crt || !rate_22crt || !rate_24crt || !silver_rate) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Convert rate_time to 24-hour format
    const formattedRateTime = convertTo24HourTime(rate_time);

    // Prepare rate data
    const rateData = [
      rate_date,
      formattedRateTime,
      rate_16crt,
      rate_18crt,
      rate_22crt,
      rate_24crt,
      silver_rate
    ];

    // Insert into `rates` table
    const [insertResult] = await db.query(
      `INSERT INTO rates (rate_date, rate_time, rate_16crt, rate_18crt, rate_22crt, rate_24crt, silver_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      rateData
    );

    // Update `current_rates` table
    const [updateResult] = await db.query(
      `UPDATE current_rates
       SET rate_date = ?, rate_time = ?, rate_16crt = ?, rate_18crt = ?, rate_22crt = ?, rate_24crt = ?, silver_rate = ?
       WHERE current_rates_id = 1`,
      rateData
    );

    // If no rows updated, insert a new record
    if (updateResult.affectedRows === 0) {
      const [insertCurrentResult] = await db.query(
        `INSERT INTO current_rates (rate_date, rate_time, rate_16crt, rate_18crt, rate_22crt, rate_24crt, silver_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        rateData
      );

      return res.status(200).json({
        message: 'Data successfully added to rates and current_rates',
        ratesInsertId: insertResult.insertId,
        currentRatesInsertId: insertCurrentResult.insertId,
      });
    }

    // If update was successful
    res.status(200).json({
      message: 'Data successfully added to rates and updated current_rates',
      ratesInsertId: insertResult.insertId,
    });

  } catch (error) {
    console.error('Error processing rates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/get/current-rates', async (req, res) => {
  try {
    const [result] = await db.query('SELECT * FROM current_rates WHERE current_rates_id = 1');

    if (result.length === 0) {
      return res.status(404).json({ error: 'No data found in current_rates table' });
    }

    res.status(200).json(result[0]);
  } catch (error) {
    console.error('Error fetching current rates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/get/rates', async (req, res) => {
  try {
    const [result] = await db.query(
      'SELECT * FROM rates ORDER BY rate_date DESC, rate_time DESC'
    );

    if (result.length === 0) {
      return res.status(404).json({ error: 'No data found in rates table' });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
