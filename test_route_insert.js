const db = require('./src/config/db');

async function test() {
    try {
        console.log('Testing route insert...');
        const [res] = await db.execute('INSERT INTO routes (name, description) VALUES (?, ?)', ['Test Route', 'Test Desc']);
        console.log('SUCCESS: Inserted ID', res.insertId);
        
        // Clean up
        await db.execute('DELETE FROM routes WHERE id = ?', [res.insertId]);
        console.log('SUCCESS: Cleaned up');
    } catch (error) {
        console.error('FAILED TO INSERT ROUTE:', error.message);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            console.log('Table "routes" DOES NOT EXIST. Attempting to create it now...');
            try {
                await db.execute(`
                    CREATE TABLE routes (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description TEXT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('Table "routes" created successfully. Please try saving again.');
            } catch (createError) {
                console.error('FAILED TO CREATE TABLE:', createError.message);
            }
        }
    } finally {
        process.exit();
    }
}

test();
