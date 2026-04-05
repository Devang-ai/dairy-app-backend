const db = require('./src/config/db');

async function ensure() {
    try {
        console.log('Ensuring routes table existence...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS routes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ SUCCESS: routes table is ready.');
    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error.message);
    } finally {
        process.exit();
    }
}

ensure();
