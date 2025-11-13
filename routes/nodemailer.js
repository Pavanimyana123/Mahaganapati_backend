const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'vangalatharun2001@gmail.com',
    pass: 'zcja yyad cvgx bsyk'
  },
  tls: {
    rejectUnauthorized: false
  }
});

const ADMIN_EMAIL = 'vangalatharun2001@gmail.com';

module.exports = {
  transporter,
  ADMIN_EMAIL
};