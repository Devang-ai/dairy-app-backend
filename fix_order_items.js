const db = require('./src/config/db');

async function fixOrderItems() {
    const connection = await db.getConnection();
    try {
        console.log('Checking order_items schema...');
        const [cols] = await connection.query('DESCRIBE order_items');
        const colNames = cols.map(c => c.Field);
        const colInfo = {};
        cols.forEach(c => { colInfo[c.Field] = c; });
        
        console.log('Current columns:', colNames);
        console.log('Details:');
        cols.forEach(c => console.log(` - ${c.Field}: ${c.Type}, Null=${c.Null}, Default=${c.Default}`));

        // Fix 1: Make variant_id nullable (manual products don't have real variant IDs)
        if (colNames.includes('variant_id') && colInfo['variant_id'].Null === 'NO') {
            console.log('\nFixing variant_id: making nullable...');
            await connection.query('ALTER TABLE order_items MODIFY COLUMN variant_id INT NULL');
            console.log('✅ variant_id is now nullable');
        } else if (!colNames.includes('variant_id')) {
            console.log('\nAdding variant_id as nullable...');
            await connection.query('ALTER TABLE order_items ADD COLUMN variant_id INT NULL');
            console.log('✅ variant_id added');
        } else {
            console.log('\nvariant_id is already nullable, skipping.');
        }

        // Fix 2: Make unit_price nullable or drop it (replaced by final_price in wholesale model)
        if (colNames.includes('unit_price') && colInfo['unit_price'].Null === 'NO') {
            console.log('\nFixing unit_price: making nullable with default 0...');
            await connection.query('ALTER TABLE order_items MODIFY COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL');
            console.log('✅ unit_price is now nullable');
        } else if (!colNames.includes('unit_price')) {
            console.log('\nunit_price column does not exist, skipping.');
        } else {
            console.log('\nunit_price is already nullable, skipping.');
        }

        // Fix 3: Ensure final_price column exists
        if (!colNames.includes('final_price')) {
            console.log('\nAdding final_price column...');
            await connection.query('ALTER TABLE order_items ADD COLUMN final_price DECIMAL(10,2) NULL DEFAULT NULL');
            console.log('✅ final_price column added');
        } else {
            console.log('\nfinal_price already exists, skipping.');
        }

        // Fix 4: Ensure quantity supports decimals (for kg/gm)
        if (colNames.includes('quantity') && colInfo['quantity'].Type === 'int') {
            console.log('\nFixing quantity: changing from INT to DECIMAL(10,3) for kg support...');
            await connection.query('ALTER TABLE order_items MODIFY COLUMN quantity DECIMAL(10,3) NOT NULL');
            console.log('✅ quantity is now DECIMAL(10,3)');
        } else {
            console.log('\nquantity type is OK:', colInfo['quantity']?.Type);
        }

        // Verify
        console.log('\n--- Final Schema ---');
        const [finalCols] = await connection.query('DESCRIBE order_items');
        finalCols.forEach(c => console.log(` - ${c.Field}: ${c.Type}, Null=${c.Null}`));

        console.log('\n✅ Migration complete! Order placement should work now.');
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
    } finally {
        connection.release();
        process.exit(0);
    }
}

fixOrderItems();
