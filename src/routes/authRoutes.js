const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/routes', authController.getRoutes);
router.get('/list-all-users', authController.listAllUsers);

module.exports = router;
