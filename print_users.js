require('dotenv').config();
const db = require('./src/config/db');

async function checkUsers() {
    try {
        const [users] = await db.query('SELECT * FROM users');
        console.log('--- ALL USERS IN DATABASE ---');
        console.log(JSON.stringify(users, null, 2));
    } catch (e) {
        console.error('Error fetching users:', e);
    } finally {
        process.exit();
    }
}

checkUsers();
