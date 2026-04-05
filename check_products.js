const db = require('./src/config/db');

async function check() {
    try {
        const [columns] = await db.execute('DESCRIBE products');
        console.log('--- PRODUCTS TABLE COLUMNS ---');
        columns.forEach(c => console.log(`${c.Field} (${c.Type}) - Null: ${c.Null}, Key: ${c.Key}`));
        console.log('------------------------------');
    } catch (error) {
        console.error('ERROR CHECKING SCHEMA:', error.message);
    } finally {
        process.exit();
    }
}

check();
