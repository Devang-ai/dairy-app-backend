const db = require('./src/config/db');

async function debug() {
    try {
        console.log('--- Checking ALL Orders ---');
        const [allOrders] = await db.execute('SELECT COUNT(*) as total FROM orders');
        console.log('Total Orders in DB:', allOrders[0].total);

        console.log('\n--- Orders Breakdown by Delivery Date ---');
        const [dateBreakdown] = await db.execute('SELECT delivery_date, COUNT(*) as count FROM orders GROUP BY delivery_date');
        console.table(dateBreakdown);

        console.log('\n--- Orders Breakdown by Route ---');
        const [routeBreakdown] = await db.execute(`
            SELECT u.route_id, r.name as route_name, COUNT(o.id) as count 
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN routes r ON u.route_id = r.id
            GROUP BY u.route_id, r.name
        `);
        console.table(routeBreakdown);

        const testDate = '2026-03-31';
        console.log(`\n--- Searching for Delivery on 2026-04-01 (Accounting Date ${testDate}) ---`);
        const [filtered] = await db.execute(`
            SELECT o.id, u.full_name, r.name as route, o.delivery_date 
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN routes r ON u.route_id = r.id
            WHERE DATE(o.delivery_date) = '2026-04-01'
        `);
        console.table(filtered);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debug();
