const db = require('./src/config/db');

async function fix() {
    try {
        console.log('ALTERING TABLE...');
        await db.query('ALTER TABLE products ADD COLUMN is_available TINYINT(1) DEFAULT 1');
        console.log('SUCCESS');
    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        process.exit();
    }
}
fix();
