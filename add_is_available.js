const db = require('./src/config/db');

async function migrate() {
    try {
        console.log('Adding is_available column to products table...');
        
        // Check if column exists first to avoid error
        const [columns] = await db.execute('DESCRIBE products');
        const columnNames = columns.map(c => c.Field);
        
        if (!columnNames.includes('is_available')) {
            await db.execute('ALTER TABLE products ADD COLUMN is_available TINYINT(1) DEFAULT 1 AFTER image_url');
            console.log('✅ Column is_available added successfully.');
        } else {
            console.log('ℹ️ Column is_available already exists.');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        process.exit();
    }
}

migrate();
