const db = require('./src/config/db');

async function check() {
    try {
        const [rows] = await db.execute('SELECT id, user_id, delivery_date, created_at FROM orders ORDER BY created_at DESC LIMIT 10');
        console.log('--- Recent Orders ---');
        console.table(rows);
        
        const testDate = '2026-03-31';
        const [filtered] = await db.execute("SELECT id, delivery_date FROM orders WHERE delivery_date = DATE_ADD(?, INTERVAL 1 DAY)", [testDate]);
        console.log(`--- Filtering for Accounting Date ${testDate} (Expects 2026-04-01) ---`);
        console.table(filtered);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
