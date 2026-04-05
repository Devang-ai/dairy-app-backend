const db = require('./src/config/db');

async function migrate() {
    console.log('Step 1: Connecting to DB...');
    try {
        const [columns] = await db.query('DESCRIBE products');
        console.log('Step 2: Analysis complete. Column count:', columns.length);
        
        const columnNames = columns.map(c => c.Field);
        if (!columnNames.includes('is_available')) {
            console.log('Step 3: Column missing. Altering table...');
            await db.query('ALTER TABLE products ADD COLUMN is_available TINYINT(1) DEFAULT 1');
            console.log('✅ Success: is_available added');
        } else {
            console.log('ℹ️ Info: is_available already exists');
        }
    } catch (error) {
        console.error('❌ Error during migration:', error.message);
    } finally {
        console.log('Step 4: Exiting...');
        process.exit();
    }
}

migrate();
