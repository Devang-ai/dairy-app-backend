const db = require('./src/config/db');

async function debug() {
    try {
        console.log('--- ALL USERS ---');
        const [users] = await db.execute('SELECT id, username, full_name, route_id FROM users');
        console.table(users);

        console.log('\n--- ALL ORDERS ---');
        const [orders] = await db.execute('SELECT id, user_id, delivery_date, created_at FROM orders ORDER BY id DESC');
        console.table(orders);

        const now = new Date();
        console.log(`\n--- SERVER CURRENT TIME: ${now.toString()} ---`);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
