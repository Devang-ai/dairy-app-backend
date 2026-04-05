const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  try {
    const con = await mysql.createConnection({
        host: process.env.DB_HOST, 
        user: process.env.DB_USER, 
        database: process.env.DB_NAME, 
        password: process.env.DB_PASSWORD || ''
    });
    const [rows] = await con.query("SELECT username FROM users WHERE role='admin'");
    console.log("Admins:");
    console.log(rows);
    process.exit();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
check();
