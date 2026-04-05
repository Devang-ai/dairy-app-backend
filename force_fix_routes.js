const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixRoutes() {
    console.log('>>> [START] Attempting Route Fix...');
    
    let connection;
    try {
        console.log('>>> Connecting to 127.0.0.1...');
        connection = await mysql.createConnection({
            host: '127.0.0.1', // Using IP instead of localhost
            user: 'root',
            password: '',
            database: 'dairy_db'
        });

        console.log('>>> [SUCCESS] Connected!');

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
            
            console.log(`>>> Processing ID ${id}: ${name}...`);
            
            // Explicitly UPDATE by ID
            const [result] = await connection.query('UPDATE routes SET name = ? WHERE id = ?', [name, id]);
            
            if (result.affectedRows === 0) {
                console.log(`>>> ID ${id} not found, inserting...`);
                await connection.query('INSERT INTO routes (id, name) VALUES (?, ?)', [id, name]);
            } else {
                console.log(`>>> ID ${id} updated.`);
            }
        }

        // Final check
        const [rows] = await connection.query('SELECT * FROM routes');
        console.log('>>> [FINAL DB STATE]:');
        rows.forEach(r => console.log(`    ID ${r.id}: ${r.name}`));

        console.log('>>> [FINISH] Route stabilization complete!');
    } catch (error) {
        console.error('>>> [ERROR] FAILED TO UPDATE DATABASE:', error.message);
        console.error(error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('>>> [INFO] Connection closed.');
        }
    }
}

fixRoutes();
