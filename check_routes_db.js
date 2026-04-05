require('dotenv').config();
const db = require('./src/config/db');
const User = require('./src/models/userModel');

async function checkRoutes() {
    try {
        const routes = await User.getAllRoutes();
        console.log('Routes in DB:', routes);
        if (routes.length === 0) {
            console.log('No routes found. Seeding...');
            const defaultRoutes = [
                'Route-1 Sg highway',
                'Route-2 Vadodra Highway',
                'Route-3 Old Ahemdabad',
                'Route-4 Rajkot'
            ];
            for (const name of defaultRoutes) {
                await db.query('INSERT INTO routes (name) VALUES (?)', [name]);
                console.log(`Seeded: ${name}`);
            }
            const newRoutes = await User.getAllRoutes();
            console.log('Routes after seeding:', newRoutes);
        }
    } catch (error) {
        console.error('Error checking routes:', error);
    } finally {
        process.exit();
    }
}

checkRoutes();
