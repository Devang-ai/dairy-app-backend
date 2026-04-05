require('dotenv').config();
const db = require('./src/config/db');

async function debugUser() {
    try {
        console.log('--- Checking DB Connectivity ---');
        const [rows] = await db.execute('SELECT 1');
        console.log('DB Connected.');

        console.log('--- Fetching All Users ---');
        const [users] = await db.execute('SELECT id, username, full_name, role FROM users');
        console.log('Users found:', users);
    } catch (error) {
        console.error('DEBUG ERROR:', error);
    } finally {
        process.exit();
    }
}

debugUser();
