const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const db = require('../config/db');


exports.register = async (req, res) => {
    try {
        const { full_name, username, password, role, route_id, contact, address, authorized_person_name } = req.body;
        
        // Check if user exists
        const existingUser = await User.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const userId = await User.create({
            full_name,
            username,
            password: hashedPassword,
            role,
            route_id,
            contact,
            address,
            authorized_person_name
        });

        res.status(201).json({ message: 'User registered successfully', userId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

exports.login = async (req, res) => {
    console.log('>>> [BACKEND] Received login request for username:', req.body.username);
    try {
        const { username, password } = req.body;
        
        const user = await User.findByUsername(username);
        if (!user) {
            console.log('>>> [BACKEND] Login Failed: User not found in DB');
            return res.status(401).json({ message: 'Invalid credentials: User not found' });
        }

        console.log('>>> [BACKEND] User found, comparing passwords...');
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            const dbPassPreview = user.password ? user.password.substring(0, 10) : 'null';
            console.log('>>> [BACKEND] Login Failed. DB Password Preview:', dbPassPreview);
            
            // Helpful message to understand if the DB has a raw password or a hash
            const isHashed = user.password && user.password.startsWith('$2');
            const errorReason = isHashed 
                ? 'Wrong password entered.' 
                : 'Old user found with unhashed password! Please register a new account.';
                
            return res.status(401).json({ 
                message: `Login Failed: ${errorReason} (DB: ${dbPassPreview}...)` 
            });
        }

        console.log('>>> [BACKEND] Login Successful for user:', user.username);
        const token = jwt.sign(
            { id: user.id, role: user.role, route_id: user.route_id },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                authorized_person_name: user.authorized_person_name,
                contact: user.contact,
                address: user.address,
                role: user.role,
                route_id: user.route_id,
                route_name: user.route_name
            }
        });

    } catch (error) {
        console.error('>>> [BACKEND] Login Error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

exports.getRoutes = async (req, res) => {
    console.log('>>> [BACKEND] Received request for /api/auth/routes');
    try {
        const routes = await User.getAllRoutes();
        console.log(`>>> [BACKEND] Found ${routes.length} routes in DB`);
        res.json(routes);
    } catch (error) {
        console.error('>>> [BACKEND] CRITICAL Error in getRoutes:', error);
        res.status(500).json({ message: 'Error fetching routes', error: error.message });
    }
};

exports.listAllUsers = async (req, res) => {
    try {
        const [rows] = await User.getAllUsersDirect(); // Adding a direct helper
        res.json({
            count: rows.length,
            users: rows.map(u => ({
                id: u.id,
                username: u.username,
                role: u.role,
                full_name: u.full_name
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.debugResetOrders = async (req, res) => {
    try {
        console.log('>>> [DEBUG] Performing hard reset of orders table...');
        await db.execute('SET FOREIGN_KEY_CHECKS = 0');
        await db.execute('TRUNCATE TABLE order_items');
        await db.execute('TRUNCATE TABLE orders');
        await db.execute('SET FOREIGN_KEY_CHECKS = 1');
        
        res.json({ 
            message: 'Orders completely reset. IDs will start from #1 again.',
            status: 'success'
        });
    } catch (error) {

        console.error('>>> [DEBUG] Reset Error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { full_name, address } = req.body;
        
        await User.updateUserProfile(userId, { full_name, address });
        
        res.json({ message: 'Profile updated successfully', status: 'success' });
    } catch (error) {
        console.error('>>> [BACKEND] Update Profile Error:', error);
        res.status(500).json({ message: 'Error updating profile' });
    }
};

exports.getMe = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get route name too
        const [routeRows] = await require('../config/db').execute(
            'SELECT name FROM routes WHERE id = ?',
            [user.route_id]
        );
        const route_name = routeRows[0]?.name || '';

        res.json({
            id: user.id,
            full_name: user.full_name || '',
            authorized_person_name: user.authorized_person_name || '',
            contact: user.contact || user.username,
            address: user.address || '',
            route_id: user.route_id || '',
            route_name,
            role: user.role
        });
    } catch (error) {
        console.error('>>> [BACKEND] getMe Error:', error);
        res.status(500).json({ message: 'Error fetching profile' });
    }
};


