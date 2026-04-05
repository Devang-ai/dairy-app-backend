const db = require('./src/config/db');
const fs = require('fs');

async function fix() {
    let log = '';
    try {
        log += 'Starting migration...\n';
        const [cols] = await db.query('DESCRIBE products');
        const names = cols.map(c => c.Field);
        log += 'Columns: ' + names.join(', ') + '\n';
        
        if (!names.includes('is_available')) {
            log += 'Adding is_available...\n';
            await db.query('ALTER TABLE products ADD COLUMN is_available TINYINT(1) DEFAULT 1');
            log += '✅ Success: is_available added\n';
        } else {
            log += 'ℹ️ Already exists\n';
        }
    } catch (e) {
        log += '❌ ERROR: ' + e.message + '\n';
        // Try direct alter if describe failed for some reason
        try {
            await db.query('ALTER TABLE products ADD COLUMN is_available TINYINT(1) DEFAULT 1');
            log += '✅ Success on second try\n';
        } catch (e2) {
             log += '❌ Second try failed: ' + e2.message + '\n';
        }
    } finally {
        fs.writeFileSync('migration_log.txt', log);
        process.exit();
    }
}
fix();
