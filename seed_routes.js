const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedRoutes() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'dairy_db'
    });

    console.log('Connecting to database...');

    try {
        // Create table if it doesn't exist
        await connection.query(`
            CREATE TABLE IF NOT EXISTS routes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL
            )
        `);
        console.log('Routes table ensured');

        // Check if routes already exist
        const [rows] = await connection.query('SELECT COUNT(*) as count FROM routes');
        
        if (rows[0].count === 0) {
            const routes = [
                'Route-1',
                'Route-2',
                'Route-3',
                'Route-4',
                'Route-5',
                'Route-6'
            ];

            for (const route of routes) {
                await connection.query('INSERT INTO routes (name) VALUES (?)', [route]);
            }
            console.log('Successfully seeded ' + routes.length + ' routes');
        } else {
            console.log('Routes already exist, count: ' + rows[0].count);
        }

    } catch (error) {
        console.error('Error seeding routes:', error.message);
    } finally {
        await connection.end();
        console.log('Database connection closed');
    }
}

seedRoutes();
