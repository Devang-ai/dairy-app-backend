const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function importSchema() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    };

    try {
        const sqlPath = path.join(__dirname, '..', 'docs', 'db_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL server.');

        await connection.query('CREATE DATABASE IF NOT EXISTS dairy_db');
        await connection.query('USE dairy_db');
        
        await connection.query(sql);

        console.log('Schema imported successfully!');
        await connection.end();
        process.exit(0);
    } catch (error) {
        console.error('Error importing schema:', error);
        process.exit(1);
    }
}

importSchema();
