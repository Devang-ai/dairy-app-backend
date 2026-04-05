const db = require('./src/config/db');
const fs = require('fs');

async function audit() {
    try {
        const [orders] = await db.execute('DESCRIBE orders');
        fs.writeFileSync('schema_final.txt', JSON.stringify(orders, null, 2));
        
        const [recent] = await db.execute('SELECT * FROM orders ORDER BY id DESC LIMIT 5');
        fs.writeFileSync('orders_final.txt', JSON.stringify(recent, null, 2));
        
        process.exit(0);
    } catch (err) {
        fs.writeFileSync('error_final.txt', err.message);
        process.exit(1);
    }
}

audit();
