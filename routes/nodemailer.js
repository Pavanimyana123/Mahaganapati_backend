const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'palankar1234@gmail.com',
    pass: 'uowb ymzc flyq vwhh'
  },
  tls: {
    rejectUnauthorized: false
  }
});

const ADMIN_EMAIL = 'palankar1234@gmail.com';

module.exports = {
  transporter,
  ADMIN_EMAIL
};