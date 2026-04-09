const db = require('../src/config/db');

async function resetOrders() {
    console.log('>>> [Database] Starting Order Reset...');
    const connection = await db.getConnection();
    
    try {
        // Disable foreign key checks to allow truncation
        await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
        
        console.log('1. Clearing order_items...');
        await connection.execute('TRUNCATE TABLE order_items');
        
        console.log('2. Clearing orders and resetting ID to #1...');
        await connection.execute('TRUNCATE TABLE orders');
        
        // Re-enable foreign key checks
        await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        console.log('SUCCESS: Order count has been reset to #1. 🚀');
    } catch (error) {
        console.error('ERROR: Failed to reset orders:', error.message);
    } finally {
        connection.release();
        process.exit(0);
    }
}

resetOrders();
