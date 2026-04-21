const db = require('../src/config/db');

async function migrate() {
    console.log('--- Database Migration: order_items ---');
    try {
        const [columns] = await db.execute('DESCRIBE order_items');
        const hasVariantId = columns.some(c => c.Field === 'variant_id');
        
        if (!hasVariantId) {
            console.log('Adding missing column: variant_id to order_items...');
            await db.execute('ALTER TABLE order_items ADD COLUMN variant_id INT DEFAULT 0 AFTER product_id');
            console.log('SUCCESS: variant_id column added.');
        } else {
            console.log('SKIP: variant_id column already exists.');
        }

        console.log('\nMigration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration FAILED:', error);
        process.exit(1);
    }
}

migrate();
