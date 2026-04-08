const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkConnection() {
    console.log('--- Production Readness Check ---');
    console.log('DB_HOST:', process.env.DB_HOST || 'NOT SET');
    console.log('DB_USER:', process.env.DB_USER || 'NOT SET');
    console.log('DB_NAME:', process.env.DB_NAME || 'NOT SET');
    console.log('PORT:', process.env.PORT || '5000 (default)');

    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
            ssl: process.env.DB_HOST && process.env.DB_HOST.includes('tidbcloud.com') ? {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true
            } : null
        });

        const [rows] = await pool.query('SELECT 1 + 1 AS solution');
        console.log('✅ Database Connection Successful! Solution:', rows[0].solution);
        
        const [tables] = await pool.query('SHOW TABLES');
        console.log(`✅ Found ${tables.length} tables in database.`);
        
        await pool.end();
    } catch (error) {
        console.error('❌ Database Connection Failed!');
        console.error('Error details:', error.message);
        console.log('\nTIP: If you are running this locally, ensure your local MySQL is running.');
        console.log('TIP: If this is on Render, ensure you have set these environment variables in the Render Dashboard.');
    }
}

checkConnection();
