const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const riderController = require('../controllers/riderController');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Define Fields
const cpUpload = upload.fields([
    { name: 'aadhar', maxCount: 1 },
    { name: 'license', maxCount: 1 },
    { name: 'pan', maxCount: 1 },
    { name: 'rc', maxCount: 1 }
]);

// Route: POST /api/riders/register
router.post('/register', cpUpload, riderController.register);

router.get('/profile/:id', riderController.getProfile);

module.exports = router;
