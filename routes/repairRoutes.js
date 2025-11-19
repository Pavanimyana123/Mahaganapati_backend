const express = require('express');
const db = require('../db'); // mysql2 promise connection
const router = express.Router();

router.post('/add/repairs', async (req, res) => {
  try {
    const data = req.body;
    // console.log("Requested body=", req.body);

    const sanitizeDecimal = (value, defaultValue = 0) => value === "" || value === null ? defaultValue : value;

    // Check if this should be an INSERT or UPDATE
    let existingRepair = null;

    // Only check for existing repair if repair_id is provided and not empty
    if (data.repair_id) {
      // Check by repair_id
      const checkSql = `SELECT repair_id FROM repairs WHERE repair_id = ?`;
      const [rows] = await db.query(checkSql, [data.repair_id]);
      existingRepair = rows[0];
    }
    if (existingRepair) {
      // UPDATE existing record
      const updateSql = `
        UPDATE repairs SET 
          customer_id = ?, account_name = ?, mobile = ?, email = ?, address1 = ?, address2 = ?, address3 = ?, city = ?,
          staff = ?, delivery_date = ?, place = ?, metal = ?, counter = ?, entry_type = ?, date = ?,
          metal_type = ?, item = ?, tag_no = ?, description = ?, purity = ?, category = ?, sub_category = ?,
          gross_weight = ?, pcs = ?, estimated_dust = ?, estimated_amt = ?, extra_weight = ?, stone_value = ?,
          making_charge = ?, handling_charge = ?, total = ?, status = ?, image = ?, taxable_amt = ?, total_amt = ?
        WHERE repair_id = ?
      `;

      const values = [
        data.customer_id, data.account_name, data.mobile, data.email, data.address1, data.address2, data.address3, data.city,
        data.staff, data.delivery_date, data.place, data.metal, data.counter, data.entry_type, data.date,
        data.metal_type, data.item, data.tag_no, data.description, data.purity, data.category, data.sub_category,
        sanitizeDecimal(data.gross_weight), sanitizeDecimal(data.pcs), sanitizeDecimal(data.estimated_dust), sanitizeDecimal(data.estimated_amt),
        sanitizeDecimal(data.extra_weight), sanitizeDecimal(data.stone_value), sanitizeDecimal(data.making_charge),
        sanitizeDecimal(data.handling_charge), sanitizeDecimal(data.total), data.status, data.image,
        sanitizeDecimal(data.taxable_amt), sanitizeDecimal(data.total_amt),
        existingRepair.repair_id
      ];

      const [result] = await db.query(updateSql, values);
      res.status(200).json({ message: 'Repair entry updated successfully', repairId: existingRepair.repair_id });

    } else {
      // INSERT new record - generate new repair_no if needed
      let repairNo = data.repair_no;
      
      // If repair_no is empty or we want to force a new number, generate one
      if (!repairNo || repairNo.trim() === "") {
        // Generate new repair_no logic here
        repairNo = await generateNewRepairNo();
      }

      const insertSql = `
        INSERT INTO repairs (
          customer_id, account_name, mobile, email, address1, address2, address3, city, staff, delivery_date, 
          place, metal, counter, entry_type, repair_no, date, metal_type, item, 
          tag_no, description, purity, category, sub_category, gross_weight, pcs, estimated_dust, estimated_amt, 
          extra_weight, stone_value, making_charge, handling_charge, total, status, image, taxable_amt, total_amt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        data.customer_id, data.account_name, data.mobile, data.email, data.address1, data.address2, data.address3, data.city,
        data.staff, data.delivery_date, data.place, data.metal, data.counter, data.entry_type, repairNo, data.date,
        data.metal_type, data.item, data.tag_no, data.description, data.purity, data.category, data.sub_category,
        sanitizeDecimal(data.gross_weight), sanitizeDecimal(data.pcs), sanitizeDecimal(data.estimated_dust), sanitizeDecimal(data.estimated_amt),
        sanitizeDecimal(data.extra_weight), sanitizeDecimal(data.stone_value), sanitizeDecimal(data.making_charge),
        sanitizeDecimal(data.handling_charge), sanitizeDecimal(data.total), data.status, data.image,
        sanitizeDecimal(data.taxable_amt), sanitizeDecimal(data.total_amt)
      ];

      const [result] = await db.query(insertSql, values);
      res.status(201).json({ message: 'Repair entry added successfully', repairId: result.insertId });
    }

  } catch (error) {
    console.error('Error processing repair:', error);
    res.status(500).json({ error: 'Failed to process repair' });
  }
});

// Helper function to generate new repair number
async function generateNewRepairNo() {
  // Your logic to generate new repair number
  // Example: Get the latest repair_no and increment it
  const getLatestSql = `SELECT repair_no FROM repairs ORDER BY repair_id DESC LIMIT 1`;
  const [rows] = await db.query(getLatestSql);
  
  if (rows.length > 0) {
    const latestNo = rows[0].repair_no;
    // Extract number and increment
    const match = latestNo.match(/(\d+)$/);
    if (match) {
      const newNumber = parseInt(match[1]) + 1;
      return `RP${newNumber.toString().padStart(3, '0')}`;
    }
  }
  
  return 'RPN001'; // Default if no records exist
}

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

router.get('/get/repairs-by-repairno/:repair_no', async (req, res) => {
  try {
    const { repair_no } = req.params;

    const [repairs] = await db.query(`
      SELECT 
        repair_id,
        customer_id,
        account_name,
        mobile,
        email,
        address1,
        address2,
        address3,
        staff,
        DATE_FORMAT(delivery_date, '%Y-%m-%d') AS delivery_date,
        place,
        metal,
        counter,
        entry_type,
        DATE_FORMAT(date, '%Y-%m-%d') AS date,
        metal_type,
        item,
        tag_no,
        description,
        purity,
        category,
        sub_category,
        gross_weight,
        pcs,
        estimated_dust,
        estimated_amt,
        extra_weight,
        stone_value,
        making_charge,
        handling_charge,
        total,
        city,
        repair_no,
        status,
        created_at,
        image,
        gross_wt_after_repair,
        total_amt,
        taxable_amt,
        invoice,
        invoice_number,
        tax_percent,
        tax_amt,
        net_bill_amt
      FROM repairs 
      WHERE repair_no = ?
    `, [repair_no]);

    res.status(200).json(repairs);
  } catch (error) {
    console.error('Error fetching repairs by repair number:', error);
    res.status(500).json({ error: 'Failed to fetch repairs' });
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

// router.delete('/delete/repairs/:id', async (req, res) => {
//   try {
//     const [result] = await db.query('DELETE FROM repairs WHERE repair_id = ?', [req.params.id]);
//     if (result.affectedRows === 0) return res.status(404).json({ message: 'Repair entry not found' });
//     res.status(200).json({ message: 'Repair entry deleted successfully' });
//   } catch (error) {
//     console.error('Error deleting repair:', error);
//     res.status(500).json({ error: 'Failed to delete repair' });
//   }
// });

// router.delete('/repairs', async (req, res) => {
//   try {
//     const { repair_no } = req.body;

//     // Check if repair_no is provided
//     if (!repair_no) {
//       return res.status(400).json({ error: 'Repair number is required for deletion' });
//     }

//     // First, check if the repair exists and get some details for confirmation
//     const checkSql = 'SELECT repair_no, account_name FROM repairs WHERE repair_no = ? LIMIT 1';
//     const [checkResult] = await db.query(checkSql, [repair_no]);

//     if (checkResult.length === 0) {
//       return res.status(404).json({ error: 'Repair entry not found' });
//     }

//     // Delete all entries with the given repair_no
//     const deleteSql = 'DELETE FROM repairs WHERE repair_no = ?';
//     const [result] = await db.query(deleteSql, [repair_no]);

//     if (result.affectedRows === 0) {
//       return res.status(404).json({ error: 'No repair entries found to delete' });
//     }

//     res.status(200).json({
//       message: `Successfully deleted ${result.affectedRows} repair entry/entries`,
//       repair_no: repair_no,
//       affectedRows: result.affectedRows
//     });

//   } catch (error) {
//     console.error('Error deleting repair:', error);
//     res.status(500).json({ error: 'Failed to delete repair entry' });
//   }
// });

router.get('/lastRPNNumber', async (req, res) => {
  try {
    const [results] = await db.query("SELECT repair_no FROM repairs WHERE repair_no LIKE 'RP%' ORDER BY repair_no DESC LIMIT 1");
    let nextRPNNumber = 'RP001';
    if (results.length > 0) {
      const lastNumber = parseInt(results[0].repair_no.slice(3), 10);
      nextRPNNumber = `RP${String(lastNumber + 1).padStart(3, '0')}`;
    }
    res.status(200).json({ lastRPNNumber: nextRPNNumber });
  } catch (error) {
    console.error('Error fetching last RP number:', error);
    res.status(500).json({ error: 'Failed to fetch last RP number' });
  }
});

module.exports = router;
