const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });
    
    const [orders] = await conn.query('SELECT COUNT(*) as c FROM orders');
    const [products] = await conn.query('SELECT COUNT(*) as c FROM products');
    
    console.log('Orders in DB:', orders[0].c);
    console.log('Products in DB:', products[0].c);
    await conn.end();
}
check();
