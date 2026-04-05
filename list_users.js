require('dotenv').config();
const db = require('./src/config/db');

async function listUsers() {
    try {
        const [rows] = await db.execute('SELECT id, username, full_name, role, route_id, contact FROM users');
        console.log('--- Registered Users ---');
        console.table(rows);
    } catch (error) {
        console.error('Error listing users:', error);
    } finally {
        process.exit();
    }
}

listUsers();
