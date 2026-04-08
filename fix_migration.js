const mysql = require('mysql2/promise');
require('dotenv').config();

async function fix() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        console.log('>>> Checking products table columns...');
        const [columns] = await connection.execute('DESCRIBE products');
        const hasCategory = columns.some(c => c.Field === 'category');

        if (!hasCategory) {
            console.log('>>> Adding category column to products...');
            await connection.execute('ALTER TABLE products ADD COLUMN category VARCHAR(100) DEFAULT "All"');
            console.log('>>> Category column added.');
        } else {
            console.log('>>> Category column already exists.');
        }

        console.log('>>> Checking users table columns...');
        const [uColumns] = await connection.execute('DESCRIBE users');
        const hasAuthName = uColumns.some(c => c.Field === 'authorized_person_name');

        if (!hasAuthName) {
            console.log('>>> Adding authorized_person_name column to users...');
            await connection.execute('ALTER TABLE users ADD COLUMN authorized_person_name VARCHAR(255) DEFAULT NULL');
            console.log('>>> Authorized person name column added.');
        } else {
            console.log('>>> Authorized person name column already exists.');
        }

        console.log('>>> Migration fixed successfully.');
    } catch (e) {
        console.error('!!! Migration error:', e.message);
    } finally {
        await connection.end();
    }
}

fix();
