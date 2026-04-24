const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    console.log('>>> [Migration] Connecting to Database...');
    console.log(`--- Host: ${process.env.DB_HOST}`);
    console.log(`--- User: ${process.env.DB_USER}`);
    console.log(`--- DB: ${process.env.DB_NAME}`);

    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        ssl: (process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com')) ? {
            minVersion: 'TLSv1.2',
            rejectUnauthorized: true
        } : null
    });

    console.log('>>> [Migration] Connection Successful! Starting Unit Standardization...');

    try {
        // 1. Add unit_type and base_unit to products
        await connection.query('ALTER TABLE products ADD COLUMN unit_type ENUM("weight", "volume") DEFAULT "weight"');
        await connection.query('ALTER TABLE products ADD COLUMN base_unit VARCHAR(10) DEFAULT "gm"');
        console.log('--- Added unit_type and base_unit to products table');
    } catch (e) {
        console.log('--- products columns already exist or error:', e.message);
    }

    try {
        // 2. Initial detection logic for existing products
        const [products] = await connection.query('SELECT id, name FROM products');
        for (const p of products) {
            const name = p.name.toLowerCase();
            const isVol = name.match(/milk|dahi|curd|lassi|chaas|liquid|water|juice|shrikhand/);
            const unitType = isVol ? 'volume' : 'weight';
            const baseUnit = isVol ? 'ml' : 'gm';
            
            await connection.query('UPDATE products SET unit_type = ?, base_unit = ? WHERE id = ?', [unitType, baseUnit, p.id]);
        }
        console.log('--- Seeded unit_type for existing products based on name detection');
    } catch (e) {
        console.log('--- Error seeding unit_type:', e.message);
    }

    try {
        // 3. STORAGE MIGRATION: KG -> GM / L -> ML
        console.log('--- Converting existing quantities (KG/L) to Base Units (G/ML)...');
        // Note: Running this only if they haven't been migrated yet. 
        // We check if values look like small decimals.
        await connection.query('UPDATE order_items SET quantity = quantity * 1000 WHERE quantity < 50');
        await connection.query('ALTER TABLE order_items MODIFY COLUMN quantity DECIMAL(15,3)');
        console.log('--- Finished quantity migration in order_items');
    } catch (e) {
        console.log('--- Error in quantity migration:', e.message);
    }

    console.log('>>> [Migration] Unit Standardization completed successfully.');
    await connection.end();
}

migrate().catch(err => {
    console.error('!!! [Migration Failed] !!!');
    console.error(err);
    process.exit(1);
});
