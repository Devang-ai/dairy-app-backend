const db = require('./src/config/db');

async function migrate() {
    const connection = await db.getConnection();
    try {
        console.log('=== Starting Full Schema Migration ===\n');

        // ── ORDERS TABLE ──────────────────────────────────────────────────
        const [orderCols] = await connection.query('DESCRIBE orders');
        const orderColNames = orderCols.map(c => c.Field);
        const orderColInfo = {};
        orderCols.forEach(c => { orderColInfo[c.Field] = c; });

        console.log('Orders Table - Current columns:', orderColNames.join(', '));

        // 1. Make total_amount nullable (admin sets it later)
        if (orderColInfo['total_amount'] && orderColInfo['total_amount'].Null === 'NO') {
            await connection.query('ALTER TABLE orders MODIFY COLUMN total_amount DECIMAL(10,2) NULL DEFAULT NULL');
            console.log('✅ orders.total_amount → nullable');
        } else {
            console.log('   orders.total_amount already nullable');
        }

        // 2. Add route_id if missing
        if (!orderColNames.includes('route_id')) {
            await connection.query('ALTER TABLE orders ADD COLUMN route_id INT NULL AFTER user_id');
            console.log('✅ orders.route_id → added');
        } else {
            console.log('   orders.route_id already exists');
        }

        // 3. Add business_date if missing
        if (!orderColNames.includes('business_date')) {
            await connection.query('ALTER TABLE orders ADD COLUMN business_date DATE NULL AFTER route_id');
            console.log('✅ orders.business_date → added');
        } else {
            console.log('   orders.business_date already exists');
        }

        // 4. Fix status ENUM to match backend usage (Pending/Processing/Delivered/Cancelled)
        await connection.query(`ALTER TABLE orders MODIFY COLUMN status ENUM('Pending','Processing','Delivered','Cancelled','pending','completed','cancelled') DEFAULT 'Pending'`);
        console.log('✅ orders.status ENUM → updated');

        // ── ORDER_ITEMS TABLE ─────────────────────────────────────────────
        const [itemCols] = await connection.query('DESCRIBE order_items');
        const itemColNames = itemCols.map(c => c.Field);
        const itemColInfo = {};
        itemCols.forEach(c => { itemColInfo[c.Field] = c; });

        console.log('\nOrder_Items Table - Current columns:', itemColNames.join(', '));

        // 5. Make variant_id nullable (manual products have no real variant)
        if (itemColNames.includes('variant_id') && itemColInfo['variant_id'].Null === 'NO') {
            await connection.query('ALTER TABLE order_items MODIFY COLUMN variant_id INT NULL DEFAULT NULL');
            console.log('✅ order_items.variant_id → nullable');
        } else if (!itemColNames.includes('variant_id')) {
            await connection.query('ALTER TABLE order_items ADD COLUMN variant_id INT NULL DEFAULT NULL');
            console.log('✅ order_items.variant_id → added as nullable');
        } else {
            console.log('   order_items.variant_id already nullable');
        }

        // 6. Make unit_price nullable (admin finalizes price later)
        if (itemColNames.includes('unit_price') && itemColInfo['unit_price'].Null === 'NO') {
            await connection.query('ALTER TABLE order_items MODIFY COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL');
            console.log('✅ order_items.unit_price → nullable (admin sets later)');
        } else if (!itemColNames.includes('unit_price')) {
            console.log('   order_items.unit_price does not exist, skipping');
        } else {
            console.log('   order_items.unit_price already nullable');
        }

        // 7. Add final_price if missing (the actual price admin sets)
        if (!itemColNames.includes('final_price')) {
            await connection.query('ALTER TABLE order_items ADD COLUMN final_price DECIMAL(10,2) NULL DEFAULT NULL');
            console.log('✅ order_items.final_price → added');
        } else {
            console.log('   order_items.final_price already exists');
        }

        // 8. Make quantity support decimals for kg/gm (DECIMAL instead of INT)
        if (itemColNames.includes('quantity') && itemColInfo['quantity'].Type.toLowerCase().startsWith('int')) {
            await connection.query('ALTER TABLE order_items MODIFY COLUMN quantity DECIMAL(10,3) NOT NULL');
            console.log('✅ order_items.quantity → changed to DECIMAL(10,3) for kg support');
        } else {
            console.log('   order_items.quantity already supports decimals:', itemColInfo['quantity']?.Type);
        }

        // ── VERIFY ────────────────────────────────────────────────────────
        console.log('\n=== Final Schema ===');
        const [finalOrders] = await connection.query('DESCRIBE orders');
        console.log('\nORDERS:');
        finalOrders.forEach(c => console.log(`  ${c.Field.padEnd(20)} ${c.Type.padEnd(20)} NULL=${c.Null}`));

        const [finalItems] = await connection.query('DESCRIBE order_items');
        console.log('\nORDER_ITEMS:');
        finalItems.forEach(c => console.log(`  ${c.Field.padEnd(20)} ${c.Type.padEnd(20)} NULL=${c.Null}`));

        console.log('\n✅ Migration complete! Restart the backend server.');
    } catch (err) {
        console.error('❌ Migration error:', err.message);
    } finally {
        connection.release();
        process.exit(0);
    }
}

migrate();
