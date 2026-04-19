const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const routeController = require('../controllers/routeController');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const db = require('../config/db');

router.get('/stats', authMiddleware, isAdmin, adminController.getStats);
router.get('/test', adminController.testConnection);
router.get('/export/route', authMiddleware, isAdmin, adminController.exportRouteWise);
router.get('/export/route-xlsx', authMiddleware, isAdmin, adminController.exportRouteXLSX);
router.get('/export/monthly-xlsx', authMiddleware, isAdmin, adminController.exportMonthlyXLSX);
router.get('/export/user-monthly', authMiddleware, isAdmin, adminController.exportUserMonthly);
router.get('/users', authMiddleware, isAdmin, adminController.getUsers);
router.put('/users/:id', authMiddleware, isAdmin, adminController.updateUser);
router.delete('/users/:id', authMiddleware, isAdmin, adminController.deleteUser);

// Route Management
router.get('/routes', authMiddleware, isAdmin, routeController.getRoutes);
router.post('/routes', authMiddleware, isAdmin, routeController.createRoute);
router.put('/routes/:id', authMiddleware, isAdmin, routeController.updateRoute);
router.delete('/routes/:id', authMiddleware, isAdmin, routeController.deleteRoute);

// New image upload route
router.post('/upload', authMiddleware, isAdmin, upload.single('image'), adminController.uploadImage);

// One-time migration route — run once to fix schema, then remove
router.get('/run-migration', async (req, res) => {
    const connection = await db.getConnection();
    const log = [];
    try {
        const [orderCols] = await connection.query('DESCRIBE orders');
        const orderColNames = orderCols.map(c => c.Field);
        const orderColInfo = {};
        orderCols.forEach(c => { orderColInfo[c.Field] = c; });

        // Make total_amount nullable
        if (orderColInfo['total_amount'] && orderColInfo['total_amount'].Null === 'NO') {
            await connection.query('ALTER TABLE orders MODIFY COLUMN total_amount DECIMAL(10,2) NULL DEFAULT NULL');
            log.push('✅ orders.total_amount → nullable');
        } else { log.push('   orders.total_amount already OK'); }

        // Add route_id
        if (!orderColNames.includes('route_id')) {
            await connection.query('ALTER TABLE orders ADD COLUMN route_id INT NULL AFTER user_id');
            log.push('✅ orders.route_id → added');
        } else { log.push('   orders.route_id already exists'); }

        // Add business_date
        if (!orderColNames.includes('business_date')) {
            await connection.query('ALTER TABLE orders ADD COLUMN business_date DATE NULL AFTER route_id');
            log.push('✅ orders.business_date → added');
        } else { log.push('   orders.business_date already exists'); }

        // Fix status ENUM
        await connection.query(`ALTER TABLE orders MODIFY COLUMN status ENUM('Pending','Processing','Delivered','Cancelled') DEFAULT 'Pending'`);
        log.push('✅ orders.status ENUM → updated');

        const [itemCols] = await connection.query('DESCRIBE order_items');
        const itemColNames = itemCols.map(c => c.Field);
        const itemColInfo = {};
        itemCols.forEach(c => { itemColInfo[c.Field] = c; });

        // Make variant_id nullable
        if (itemColNames.includes('variant_id') && itemColInfo['variant_id'].Null === 'NO') {
            await connection.query('ALTER TABLE order_items MODIFY COLUMN variant_id INT NULL DEFAULT NULL');
            log.push('✅ order_items.variant_id → nullable');
        } else if (!itemColNames.includes('variant_id')) {
            await connection.query('ALTER TABLE order_items ADD COLUMN variant_id INT NULL DEFAULT NULL');
            log.push('✅ order_items.variant_id → added as nullable');
        } else { log.push('   order_items.variant_id already nullable'); }

        // Make unit_price nullable
        if (itemColNames.includes('unit_price') && itemColInfo['unit_price'].Null === 'NO') {
            await connection.query('ALTER TABLE order_items MODIFY COLUMN unit_price DECIMAL(10,2) NULL DEFAULT NULL');
            log.push('✅ order_items.unit_price → nullable');
        } else { log.push('   order_items.unit_price already OK or missing'); }

        // Add final_price
        if (!itemColNames.includes('final_price')) {
            await connection.query('ALTER TABLE order_items ADD COLUMN final_price DECIMAL(10,2) NULL DEFAULT NULL');
            log.push('✅ order_items.final_price → added');
        } else { log.push('   order_items.final_price already exists'); }

        // Quantity to DECIMAL
        if (itemColNames.includes('quantity') && itemColInfo['quantity'].Type.toLowerCase().startsWith('int')) {
            await connection.query('ALTER TABLE order_items MODIFY COLUMN quantity DECIMAL(10,3) NOT NULL');
            log.push('✅ order_items.quantity → DECIMAL(10,3)');
        } else { log.push('   order_items.quantity already decimal'); }

        // Add is_available to products
        const [prodCols] = await connection.query('DESCRIBE products');
        const prodColNames = prodCols.map(c => c.Field);
        if (!prodColNames.includes('is_available')) {
            await connection.query('ALTER TABLE products ADD COLUMN is_available TINYINT(1) DEFAULT 1');
            log.push('✅ products.is_available → added');
        } else { log.push('   products.is_available already exists'); }

        // Ensure routes table exists and has necessary columns
        const [tables] = await connection.query("SHOW TABLES LIKE 'routes'");
        if (tables.length === 0) {
            await connection.query(`
                CREATE TABLE routes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    description TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            log.push('✅ routes table → created');
        } else {
            const [routeCols] = await connection.query('DESCRIBE routes');
            const routeColNames = routeCols.map(c => c.Field);
            if (!routeColNames.includes('description')) {
                await connection.query('ALTER TABLE routes ADD COLUMN description TEXT NULL AFTER name');
                log.push('✅ routes.description → added');
            }
            if (!routeColNames.includes('created_at')) {
                await connection.query('ALTER TABLE routes ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
                log.push('✅ routes.created_at → added');
            }
        }
        log.push('✅ routes table → ensured');

        res.json({ success: true, log });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message, log });
    } finally {
        connection.release();
    }
});

module.exports = router;
