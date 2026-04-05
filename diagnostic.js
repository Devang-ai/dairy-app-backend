const db = require('./src/config/db');
const fs = require('fs');

async function diagnostic() {
    try {
        console.log('--- Orders Table Schema ---');
        const [orders] = await db.query('DESCRIBE orders');
        console.log(JSON.stringify(orders, null, 2));

        console.log('--- Order Items Table Schema ---');
        const [items] = await db.query('DESCRIBE order_items');
        console.log(JSON.stringify(items, null, 2));

        console.log('--- Recent Orders ---');
        const [recentOrders] = await db.query('SELECT * FROM orders ORDER BY id DESC LIMIT 1');
        console.log(JSON.stringify(recentOrders, null, 2));
        
        console.log('--- Recent Order Item ---');
        const [recentItem] = await db.query('SELECT * FROM order_items ORDER BY id DESC LIMIT 1');
        console.log(JSON.stringify(recentItem, null, 2));

        process.exit(0);
    } catch (err) {
        console.error('DIAGNOSTIC ERROR:', err.message);
        process.exit(1);
    }
}

diagnostic();
