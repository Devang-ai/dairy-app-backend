const db = require('./src/config/db');

async function check() {
    try {
        console.log('>>> Connecting to DB...');
        const [rows] = await db.execute('DESCRIBE products');
        console.log('--- PRODUCTS TABLE COLUMNS ---');
        rows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));
        
        const [userRows] = await db.execute('DESCRIBE users');
        console.log('\n--- USERS TABLE COLUMNS ---');
        userRows.forEach(r => console.log(`- ${r.Field} (${r.Type})`));

        console.log('\n>>> Check complete.');
        process.exit(0);
    } catch (e) {
        console.error('!!! ERROR:', e.message);
        process.exit(1);
    }
}

check();
