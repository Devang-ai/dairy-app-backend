const db = require('./src/config/db');

async function migrate() {
    try {
        console.log('Running Migration...');
        // Add business_date if it doesn't exist
        try {
            await db.execute('ALTER TABLE orders ADD COLUMN business_date DATE NOT NULL AFTER user_id');
            console.log('Added business_date column');
        } catch (e) {
            console.log('business_date column might already exist');
        }

        // Add route_id if it doesn't exist
        try {
            await db.execute('ALTER TABLE orders ADD COLUMN route_id INT AFTER user_id');
            console.log('Added route_id column');
        } catch (e) {
            console.log('route_id column might already exist');
        }

        // Populate route_id and business_date for old orders
        await db.execute('UPDATE orders o JOIN users u ON o.user_id = u.id SET o.route_id = u.route_id WHERE o.route_id IS NULL');
        console.log('Populated route_id for old orders');
        
        await db.execute('UPDATE orders SET business_date = DATE_SUB(delivery_date, INTERVAL 1 DAY) WHERE business_date IS NULL');
        console.log('Populated business_date for old orders');
        
        console.log('Migration Complete');
        process.exit(0);
    } catch (err) {
        console.error('Migration Failed:', err);
        process.exit(1);
    }
}

migrate();
