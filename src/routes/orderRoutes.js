const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, orderController.placeOrder);
router.get('/', authMiddleware, orderController.getOrders);
router.get('/reports/monthly', authMiddleware, orderController.getMonthlyReport);
router.get('/:id/items', authMiddleware, orderController.getOrderDetails);
router.put('/:orderId/status', authMiddleware, orderController.updateOrderStatus);

// Admin pricing routes
router.put('/items/:itemId/price', authMiddleware, orderController.updateItemPrice);
router.put('/:orderId/prices', authMiddleware, orderController.updateOrderPrices);

module.exports = router;
