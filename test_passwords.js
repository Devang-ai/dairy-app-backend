require('dotenv').config();
const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function testPassword() {
    try {
        const [users] = await db.query('SELECT id, username, password FROM users ORDER BY id DESC LIMIT 5');
        console.log('--- Last 5 Users ---');
        console.table(users.map(u => ({
            id: u.id, 
            username: u.username, 
            passwordLength: u.password ? u.password.length : 0,
            isBcryptFormat: u.password ? u.password.startsWith('$2a$') || u.password.startsWith('$2b$') : false,
            rawPassword: u.password.substring(0, 15) // Just show first 15 chars for debugging
        })));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

testPassword();
