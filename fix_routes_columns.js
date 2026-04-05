const db = require('./src/config/db');

async function fix() {
    try {
        console.log('Checking routes table columns...');
        const [cols] = await db.query('DESCRIBE routes');
        const colNames = cols.map(c => c.Field);
        
        if (!colNames.includes('description')) {
            console.log('Adding "description" column to routes table...');
            await db.query('ALTER TABLE routes ADD COLUMN description TEXT NULL AFTER name');
            console.log('✅ Success: description column added.');
        } else {
            console.log('ℹ️ description column already exists.');
        }

        if (!colNames.includes('created_at')) {
            console.log('Adding "created_at" column to routes table...');
            await db.query('ALTER TABLE routes ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            console.log('✅ Success: created_at column added.');
        }

    } catch (error) {
        console.error('❌ Error fixing routes table:', error.message);
    } finally {
        process.exit();
    }
}

fix();
