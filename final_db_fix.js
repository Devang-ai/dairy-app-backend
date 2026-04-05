const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'dairy_db'
    });

    try {
        console.log('Detecting Columns...');
        const [columns] = await connection.execute('DESCRIBE orders');
        const columnNames = columns.map(c => c.Field);
        console.log('Current Columns:', columnNames.join(', '));

        if (!columnNames.includes('business_date')) {
            console.log('Adding business_date...');
            await connection.execute('ALTER TABLE orders ADD COLUMN business_date DATE AFTER user_id');
        }
        
        if (!columnNames.includes('route_id')) {
            console.log('Adding route_id...');
            await connection.execute('ALTER TABLE orders ADD COLUMN route_id INT AFTER user_id');
        }

        console.log('Migration Successful!');
        process.exit(0);
    } catch (err) {
        console.error('Migration Failed:', err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

migrate();
