const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    let connection;
    try {
        console.log('>>> Connecting to Database...');
        
        // Try localhost first, then 127.0.0.1
        const hosts = [process.env.DB_HOST || 'localhost', '127.0.0.1'];
        let success = false;

        for (const host of hosts) {
            try {
                console.log(`>>> Trying host: ${host}...`);
                connection = await mysql.createConnection({
                    host: host,
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    database: process.env.DB_NAME,
                    port: process.env.DB_PORT || 3306
                });
                console.log(`>>> Connected successfully to ${host}!`);
                success = true;
                break;
            } catch (err) {
                console.warn(`>>> Connection failed for ${host}: ${err.message}`);
            }
        }

        if (!success) {
            throw new Error('Could not connect to MySQL. Please ensure XAMPP/WAMP (MySQL) is running.');
        }

        console.log('>>> Starting Migration V2...');

        // Add columns (Checking if they exist first for compatibility)
        const [columns] = await connection.execute('DESCRIBE products');
        if (!columns.some(c => c.Field === 'category')) {
            console.log('>>> Adding category column to products...');
            await connection.execute("ALTER TABLE products ADD COLUMN category VARCHAR(100) DEFAULT 'All'");
        } else {
            console.log('>>> category column already exists.');
        }

        const [userCols] = await connection.execute('DESCRIBE users');
        if (!userCols.some(c => c.Field === 'authorized_person_name')) {
            console.log('>>> Adding authorized_person_name column to users...');
            await connection.execute("ALTER TABLE users ADD COLUMN authorized_person_name VARCHAR(255) DEFAULT NULL");
        } else {
            console.log('>>> authorized_person_name column already exists.');
        }

        console.log('>>> Migration V2 completed successfully!');
    } catch (error) {
        console.error('>>> Migration V2 failed:', error.message);
        console.log('\nTIP: Make sure your MySQL server is running in XAMPP/WAMP.');
    } finally {
        if (connection) await connection.end();
    }
}

migrate();
