require('dotenv').config();
const mysql = require('mysql2/promise');

async function probe() {
    console.log('>>> DB_HOST:', process.env.DB_HOST);
    try {
        const con = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });
        console.log('CONNECTED TO DB SUCCESS!');
        const [rows] = await con.execute('SELECT COUNT(*) as count FROM users');
        console.log('Users count:', rows[0].count);
        process.exit(0);
    } catch (e) {
        console.error('CONNECTION FAILED:', e.message);
        process.exit(1);
    }
}
probe();
