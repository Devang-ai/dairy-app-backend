const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('>>> Starting Migration V2...');

    try {
        // Add authorized_person_name to users
        console.log('>>> Adding authorized_person_name to users table...');
        await connection.execute(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS authorized_person_name VARCHAR(255) DEFAULT NULL;
        `);

        // Add category to products
        console.log('>>> Adding category to products table...');
        await connection.execute(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'All';
        `);

        console.log('>>> Migration V2 completed successfully!');
    } catch (error) {
        console.error('>>> Migration V2 failed:', error.message);
    } finally {
        await connection.end();
    }
}

migrate();
