const db = require('./src/config/db');

async function check() {
    try {
        const [tables] = await db.query('SHOW TABLES');
        console.log('Tables:', tables.map(t => Object.values(t)[0]));
        
        for (const t of tables) {
            const tableName = Object.values(t)[0];
            const [cols] = await db.query(`DESCRIBE ${tableName}`);
            console.log(`\nTable: ${tableName}`);
            console.log(cols.map(c => `${c.Field} (${c.Type})`));
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
check();
