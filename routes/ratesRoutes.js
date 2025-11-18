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

  if (!rate_date || !rate_time || !rate_16crt || !rate_18crt || !rate_22crt || !rate_24crt || !silver_rate) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const formattedRateTime = convertTo24HourTime(rate_time);

    const rateData = [
      rate_date,
      formattedRateTime,
      rate_16crt,
      rate_18crt,
      rate_22crt,
      rate_24crt,
      silver_rate
    ];

    // Save record in history table
    const [insertResult] = await db.query(
      `INSERT INTO rates (rate_date, rate_time, rate_16crt, rate_18crt, rate_22crt, rate_24crt, silver_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      rateData
    );

    // Check if any row exists in current_rates
    const [existing] = await db.query(`SELECT current_rates_id FROM current_rates LIMIT 1`);

    if (existing.length > 0) {
      // UPDATE existing row (no ID needed)
      const [updateResult] = await db.query(
        `UPDATE current_rates 
         SET rate_date = ?, rate_time = ?, rate_16crt = ?, rate_18crt = ?, rate_22crt = ?, rate_24crt = ?, silver_rate = ?
         WHERE current_rates_id = ?`,
        [...rateData, existing[0].current_rates_id]
      );

      return res.status(200).json({
        message: 'Updated existing current rate',
        ratesInsertId: insertResult.insertId
      });
    } else {
      // INSERT new row
      const [insertCurrent] = await db.query(
        `INSERT INTO current_rates (rate_date, rate_time, rate_16crt, rate_18crt, rate_22crt, rate_24crt, silver_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        rateData
      );

      return res.status(200).json({
        message: 'Inserted new current rate',
        ratesInsertId: insertResult.insertId,
        currentRatesInsertId: insertCurrent.insertId
      });
    }
  } catch (error) {
    console.error('Error processing rates:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



router.get('/get/current-rates', async (req, res) => {
  try {
    const [result] = await db.query(`SELECT * FROM current_rates LIMIT 1`);

    if (result.length === 0) {
      return res.status(404).json({ error: 'No current rates found' });
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
