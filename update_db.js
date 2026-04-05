const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateDb() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'dairy_db'
    });

    try {
        await connection.query('ALTER TABLE users ADD COLUMN full_name VARCHAR(100) AFTER id');
        console.log('Added full_name to users table');
    } catch (e) {
        console.log('full_name column might already exist or error:', e.message);
    }

    try {
        // Standardize route names to Route-1, Route-2, etc. (Up to Route-6)
        const routes = [
            'Route-1',
            'Route-2',
            'Route-3',
            'Route-4',
            'Route-5',
            'Route-6'
        ];

        for (let i = 0; i < routes.length; i++) {
            const id = i + 1;
            const name = routes[i];
            
            // Check if route exists
            const [existing] = await connection.query('SELECT * FROM routes WHERE id = ?', [id]);
            
            if (existing.length > 0) {
                await connection.query('UPDATE routes SET name = ? WHERE id = ?', [name, id]);
            } else {
                await connection.query('INSERT INTO routes (id, name) VALUES (?, ?)', [id, name]);
            }
        }
        console.log('Successfully standardized routes 1-6');
    } catch(e) {
        console.log('Error updating routes:', e.message);
    }

    await connection.end();
}

updateDb();
