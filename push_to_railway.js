const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function pushToRailway() {
    // Priority: Command line arg > .env RAILWAY_MYSQL_URL > local .env
    const connectionString = process.argv[2] || process.env.RAILWAY_MYSQL_URL;

    if (!connectionString) {
        console.error('❌ ERROR: No connection URL provided!');
        console.log('Usage: node push_to_railway.js "mysql://user:pass@host:port/dbname"');
        process.exit(1);
    }

    console.log('🚀 Connecting to Database...');
    let connection;
    try {
        // TiDB Cloud requires SSL
        const connectionOptions = {
            uri: connectionString,
            ssl: connectionString.includes('tidbcloud.com') ? {
                minVersion: 'TLSv1.2',
                rejectUnauthorized: true
            } : null
        };

        connection = await mysql.createConnection(connectionString.includes('tidbcloud.com') ? connectionOptions : connectionString);
        console.log('✅ Connected successfully!');

        // 1. Read Schema
        const schemaPath = path.join(__dirname, 'production_schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('📝 Executing Schema...');
        // mysql2 doesn't support multiple statements in one query by default for security, 
        // so we split by semicolon (carefully)
        const statements = schemaSql
            .split(/;\s*$/m)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            await connection.query(statement);
        }
        console.log('✅ Tables created successfully!');

        // 2. Seed Admin User
        const adminUser = '1234567890';
        const adminPass = 'admin123';
        console.log(`👤 Checking Admin User (${adminUser})...`);

        const [rows] = await connection.execute('SELECT * FROM users WHERE username = ?', [adminUser]);
        if (rows.length > 0) {
            console.log('ℹ️ Admin already exists. Updating password to "admin123" just in case...');
            const hashed = await bcrypt.hash(adminPass, 10);
            await connection.execute('UPDATE users SET password = ?, role = "admin" WHERE username = ?', [hashed, adminUser]);
        } else {
            console.log('✨ Creating new Admin user...');
            const hashed = await bcrypt.hash(adminPass, 10);
            await connection.execute(
                'INSERT INTO users (username, password, role) VALUES (?, ?, "admin")',
                [adminUser, hashed]
            );
        }
        console.log('✅ Admin credentials are now: 1234567890 / admin123');

        console.log('\n🌟 DATABASE MIGRATION COMPLETE!');
        console.log('You can now see your tables in the Railway "Data" tab.');
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error.message);
    } finally {
        if (connection) await connection.end();
        process.exit(0);
    }
}

pushToRailway();
