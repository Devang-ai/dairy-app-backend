const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ── Security & Performance Middleware ─────────────────────────────────────
try {
  const helmet = require('helmet');
  app.use(helmet());
} catch(e) { console.warn('helmet not installed, skipping'); }

try {
  const compression = require('compression');
  app.use(compression());
} catch(e) { console.warn('compression not installed, skipping'); }

// Rate limiting — 100 requests per 15 min per IP (prevents abuse/crash)
try {
  const rateLimit = require('express-rate-limit');
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                  // max 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' }
  });
  app.use('/api/', limiter);
  console.log('>>> Rate limiting active: 100 req/15min per IP');
} catch(e) { console.warn('express-rate-limit not installed, skipping'); }

// Middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/riders', require('./routes/riderRoutes'));

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Dairy App API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

const PORT = process.env.PORT || 5000;

// Auto-migration for Render/Production
const db = require('./config/db');
async function ensureSchema() {
    try {
        console.log('>>> checking database schema...');
        
        // Products check
        const [pColCheck] = await db.execute('SHOW TABLES LIKE "products"');
        if (pColCheck.length > 0) {
            const [columns] = await db.execute('DESCRIBE products');
            if (!columns.some(c => c.Field === 'category')) {
                console.log('>>> migration: adding category to products');
                await db.execute("ALTER TABLE products ADD COLUMN category VARCHAR(100) DEFAULT 'All'");
            }
        }

        // Users check
        const [uColCheck] = await db.execute('SHOW TABLES LIKE "users"');
        if (uColCheck.length > 0) {
            const [uCols] = await db.execute('DESCRIBE users');
            if (!uCols.some(c => c.Field === 'authorized_person_name')) {
                console.log('>>> migration: adding authorized_person_name to users');
                await db.execute("ALTER TABLE users ADD COLUMN authorized_person_name VARCHAR(255) DEFAULT NULL");
            }
        }

        // Riders table creation
        console.log('>>> checking for riders table...');
        await db.execute(`
            CREATE TABLE IF NOT EXISTS riders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL UNIQUE,
                city VARCHAR(100),
                vehicle_type VARCHAR(50),
                vehicle_number VARCHAR(50),
                aadhar_url VARCHAR(255),
                license_url VARCHAR(255),
                pan_url VARCHAR(255),
                rc_url VARCHAR(255),
                account_number VARCHAR(50),
                ifsc VARCHAR(20),
                bank_name VARCHAR(100),
                status ENUM('pending', 'active', 'suspended', 'Available', 'Offline') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Update orders status enum
        const [oColCheck] = await db.execute('SHOW TABLES LIKE "orders"');
        if (oColCheck.length > 0) {
            console.log('>>> migration: updating orders status enum');
            await db.execute(`
                ALTER TABLE orders MODIFY COLUMN status 
                ENUM('Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled', 'Processing') 
                DEFAULT 'Pending'
            `);
        }

        // Cleanup: Remove dummy test data so user can register with these numbers
        console.log('>>> cleaning up test data...');
        await db.execute("DELETE FROM riders WHERE phone IN ('9876543210', '9988776655')");

        console.log('>>> database schema is up to date.');
    } catch (err) {
        console.error('>>> schema check failed:', err.message);
    }
}

ensureSchema().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

module.exports = app;
