require('dotenv').config();
const db = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function debugPasswords() {
    try {
        const [users] = await db.query('SELECT * FROM users ORDER BY id DESC LIMIT 5');
        
        for (let user of users) {
            console.log(`\nUser: ${user.username} (ID: ${user.id})`);
            console.log(`Role: ${user.role}`);
            console.log(`Password Hash in DB:`, user.password);
            
            // Try to test what could be going wrong
            const testPass = '123456';
            const isMatch123456 = await bcrypt.compare(testPass, user.password);
            console.log(`Matches '123456'? ${isMatch123456}`);
            
            const isMatchUsername = await bcrypt.compare(user.username, user.password);
            console.log(`Matches phone number as password? ${isMatchUsername}`);
        }
    } catch (e) {
        console.error('Debug error:', e);
    } finally {
        process.exit(0);
    }
}

debugPasswords();
