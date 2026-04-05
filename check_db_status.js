const db = require('./src/config/db');
const fs = require('fs');

async function check() {
    let output = '';
    try {
        const [tables] = await db.query('SHOW TABLES');
        output += 'Tables: ' + JSON.stringify(tables) + '\n';
        
        try {
            const [cols] = await db.query('DESCRIBE routes');
            output += 'Routes columns: ' + JSON.stringify(cols) + '\n';
        } catch (e) {
            output += 'Routes table error: ' + e.message + '\n';
        }
    } catch (e) {
        output += 'General error: ' + e.message + '\n';
    } finally {
        fs.writeFileSync('db_status.txt', output);
        process.exit();
    }
}
check();
