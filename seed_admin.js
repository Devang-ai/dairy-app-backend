const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || ''
    };

    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL server.');

        await connection.query('CREATE DATABASE IF NOT EXISTS dairy_db');
        await connection.query('USE dairy_db');
        
        await connection.query(`CREATE TABLE IF NOT EXISTS routes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await connection.query(`CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            role ENUM('admin', 'user') DEFAULT 'user',
            route_id INT,
            contact VARCHAR(20),
            address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
        )`);

        const username = '1234567890';
        const password = 'admin123';
        const role = 'admin';

        const [rows] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            console.log('Admin user already exists.');
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            await connection.execute(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                [username, hashedPassword, role]
            );
            console.log('Admin user created successfully!');
        }
        
        await connection.end();
        console.log('Done!');
    } catch (error) {
        console.error('Error seeding admin user:', error);
    }
}

seed();
