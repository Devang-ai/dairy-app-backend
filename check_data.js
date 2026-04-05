const db = require('./src/config/db');

async function check() {
    try {
        const [orders] = await db.execute('SELECT COUNT(*) as count FROM orders');
        const [products] = await db.execute('SELECT COUNT(*) as count FROM products');
        const [nullDateOrders] = await db.execute('SELECT COUNT(*) as count FROM orders WHERE business_date IS NULL');
        
        console.log('--- DATABASE STATUS ---');
        console.log('Total Orders:', orders[0].count);
        console.log('Total Products:', products[0].count);
        console.log('Orders with NULL Business Date:', nullDateOrders[0].count);
        
        if (nullDateOrders[0].count > 0) {
            console.log('WARNING: Some orders are hidden from the UI because they lack a business_date.');
        } else {
            console.log('SUCCESS: All orders have business_date populated.');
        }
    } catch (err) {
        console.error('Error checking DB:', err.message);
    } finally {
        process.exit(0);
    }
}

check();
