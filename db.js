const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost', 
  user: 'root', 
  password: '', 
  database: 'smj_jewellery',
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
    return;
  }
  console.log('Connected to MySQL database');
  connection.release();
});

module.exports = db;


