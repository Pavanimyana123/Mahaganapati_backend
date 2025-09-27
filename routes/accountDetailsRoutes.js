const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'customer-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpeg, .jpg, .png, and .pdf formats are allowed!'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

const processImages = (req) => {
  if (!req.files || req.files.length === 0) return null;
  return req.files.map(file => file.filename).join(',');
};

router.post('/account-details', upload.array('images', 5), async (req, res) => {
  const data = req.body;
  const images = processImages(req);

  if (images) {
    data.images = images;
  }

  try {
    const sql = `
      INSERT INTO account_details (
        account_name, print_name, account_group, op_bal, metal_balance, dr_cr,
        address1, address2, city, pincode, state, state_code, phone, mobile,
        contact_person, email, birthday, anniversary, bank_account_no,
        bank_name, ifsc_code, branch, gst_in, aadhar_card, pan_card,
        religion, images
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const formatValue = (value) => (value === '' ? null : value);

    const values = [
      data.account_name, data.print_name, data.account_group, data.op_bal, data.metal_balance, data.dr_cr,
      data.address1, data.address2, data.city, data.pincode, data.state, data.state_code,
      data.phone, data.mobile, data.contact_person, data.email,
      formatValue(data.birthday), formatValue(data.anniversary),
      data.bank_account_no, data.bank_name, data.ifsc_code, data.branch,
      data.gst_in, data.aadhar_card, data.pan_card, data.religion,
      data.images || null
    ];

    const [result] = await db.query(sql, values);

    res.status(200).json({
      message: 'Account details inserted successfully',
      id: result.insertId,
      images: data.images
    });
  } catch (err) {
    // Cleanup uploaded files if DB insert fails
    if (images) {
      const uploadDir = path.join(__dirname, '../uploads/');
      images.split(',').forEach(img => {
        fs.unlinkSync(path.join(uploadDir, img));
      });
    }
    console.error('❌ Error inserting account details:', err.message);
    res.status(500).json({ message: 'Failed to insert data', error: err.message });
  }
});

router.get('/get/account-details', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM account_details');

    const processedResults = results.map(item => {
      if (item.images) {
        const imageArray = item.images.split(',');
        item.images = imageArray.map(img => ({
          filename: img,
          url: `${req.protocol}://${req.get('host')}/uploads/${img}`
        }));
      }
      return item;
    });

    res.status(200).json(processedResults);
  } catch (err) {
    console.error('❌ Error fetching account details:', err.message);
    res.status(500).json({ message: 'Failed to fetch data', error: err.message });
  }
});

router.get('/get/account-details/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('SELECT * FROM account_details WHERE account_id = ?', [id]);

    if (result.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const item = result[0];
    if (item.images) {
      const imageArray = item.images.split(',');
      item.images = imageArray.map(img => ({
        filename: img,
        url: `${req.protocol}://${req.get('host')}/uploads/${img}`
      }));
    }

    res.status(200).json(item);
  } catch (err) {
    console.error('❌ Error fetching account detail:', err.message);
    res.status(500).json({ message: 'Failed to fetch data', error: err.message });
  }
});

router.put('/edit/account-details/:id', upload.array('images', 5), async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const newImages = req.files ? req.files.map(file => file.filename) : [];

  try {
    // Fetch existing record
    const [existingRecord] = await db.query('SELECT * FROM account_details WHERE account_id = ?', [id]);
    if (existingRecord.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const existingImages = existingRecord[0].images ? existingRecord[0].images.split(',') : [];
    let imagesToKeep = existingImages;

    if (req.body.imagesToKeep) {
      const keepList = JSON.parse(req.body.imagesToKeep);
      imagesToKeep = existingImages.filter(img => keepList.includes(img));
    }

    // Combine images
    const finalImages = [...imagesToKeep, ...newImages];
    data.images = finalImages.join(',');

    // Update record
    const sql = `
      UPDATE account_details
      SET account_name = ?, print_name = ?, account_group = ?, op_bal = ?, metal_balance = ?, dr_cr = ?,
          address1 = ?, address2 = ?, city = ?, pincode = ?, state = ?, state_code = ?, phone = ?, mobile = ?, 
          contact_person = ?, email = ?, birthday = ?, anniversary = ?, bank_account_no = ?, bank_name = ?, 
          ifsc_code = ?, branch = ?, gst_in = ?, aadhar_card = ?, pan_card = ?, religion = ?, images = ?
      WHERE account_id = ?
    `;

    const formatValue = (value) => (value === '' ? null : value);

    const values = [
      data.account_name, data.print_name, data.account_group, data.op_bal, data.metal_balance, data.dr_cr,
      data.address1, data.address2, data.city, data.pincode, data.state, data.state_code,
      data.phone, data.mobile, data.contact_person, data.email,
      formatValue(data.birthday), formatValue(data.anniversary),
      data.bank_account_no, data.bank_name, data.ifsc_code, data.branch,
      data.gst_in, data.aadhar_card, data.pan_card, data.religion,
      data.images,
      id
    ];

    const [result] = await db.query(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Delete removed images from disk
    const imagesToDelete = existingImages.filter(img => !imagesToKeep.includes(img));
    const uploadDir = path.join(__dirname, '../uploads/');
    imagesToDelete.forEach(img => {
      try {
        fs.unlinkSync(path.join(uploadDir, img));
      } catch (e) {
        console.error('Error deleting image:', img, e);
      }
    });

    res.status(200).json({ message: 'Record updated successfully', images: data.images });
  } catch (err) {
    console.error('❌ Error updating account detail:', err.message);
    res.status(500).json({ message: 'Failed to update data', error: err.message });
  }
});

router.delete('/delete/account-details/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch record to delete images
    const [record] = await db.query('SELECT * FROM account_details WHERE account_id = ?', [id]);

    if (record.length === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const imagesToDelete = record[0].images ? record[0].images.split(',') : [];

    // Delete record
    const [result] = await db.query('DELETE FROM account_details WHERE account_id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Delete images from disk
    const uploadDir = path.join(__dirname, '../uploads/');
    imagesToDelete.forEach(img => {
      try {
        fs.unlinkSync(path.join(uploadDir, img));
      } catch (e) {
        console.error('Error deleting image:', img, e);
      }
    });

    res.status(200).json({ message: 'Record deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting account detail:', err.message);
    res.status(500).json({ message: 'Failed to delete data', error: err.message });
  }
});

module.exports = router;
