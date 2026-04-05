const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middleware/authMiddleware');
const { isAdmin } = require('../middleware/authMiddleware');

// Public routes for users
router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

// Admin-only routes
router.post('/', authMiddleware, isAdmin, productController.createProduct);
router.put('/:id', authMiddleware, isAdmin, productController.updateProduct);
router.delete('/:id', authMiddleware, isAdmin, productController.deleteProduct);

// Variant management
router.post('/:productId/variants', authMiddleware, isAdmin, productController.addVariant);
router.put('/variants/:variantId', authMiddleware, isAdmin, productController.updateVariant);
router.delete('/variants/:variantId', authMiddleware, isAdmin, productController.deleteVariant);

module.exports = router;
