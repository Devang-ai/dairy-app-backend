const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');

exports.register = async (req, res) => {
    try {
        const { full_name, username, password, role, route_id, contact, address } = req.body;
        
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
            address
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
