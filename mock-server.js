const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Mock data for testing
const mockStats = {
    totalOrders: 3,
    totalUsers: 5,
    todayOrders: 3,
    routeStats: [
        { id: 2, name: 'Route 2', count: 1 },
        { id: 3, name: 'Route 3', count: 1 },
        { id: 4, name: 'Route 4', count: 1 }
    ],
    businessDate: new Date().toISOString().split('T')[0]
};

const mockMonthlyReport = {
    period: {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        monthName: new Date().toLocaleDateString('en-US', { month: 'long' }),
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    },
    summary: {
        totalRestaurants: 5,
        totalOrders: 15,
        totalDelivered: 13,
        totalAmount: 7500
    },
    restaurants: [
        {
            user_id: 1,
            restaurant_name: 'Restaurant 1',
            contact: '1234567890',
            route_name: 'Route 1',
            total_orders: 5,
            delivered_orders: 4,
            total_amount: 2500,
            outstanding_amount: 2500
        },
        {
            user_id: 2,
            restaurant_name: 'Restaurant 2',
            contact: '9876543210',
            route_name: 'Route 2',
            total_orders: 3,
            delivered_orders: 3,
            total_amount: 1500,
            outstanding_amount: 1500
        },
        {
            user_id: 3,
            restaurant_name: 'Restaurant 3',
            contact: '5555555555',
            route_name: 'Route 3',
            total_orders: 7,
            delivered_orders: 6,
            total_amount: 3500,
            outstanding_amount: 3500
        }
    ]
};

// Routes
app.get('/api/admin/stats', (req, res) => {
    console.log('[Mock Backend] Admin stats requested');
    res.json(mockStats);
});

app.get('/api/admin/test', (req, res) => {
    console.log('[Mock Backend] Test endpoint requested');
    res.json({ 
        status: 'Mock backend is working', 
        database: 'Using mock data',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/orders/reports/monthly', (req, res) => {
    console.log('[Mock Backend] Monthly report requested:', req.query);
    res.json(mockMonthlyReport);
});

app.get('/api/orders/:orderId/status', (req, res) => {
    console.log('[Mock Backend] Order status update requested:', req.params.orderId);
    res.json({ 
        message: 'Order status updated to Delivered', 
        orderId: req.params.orderId,
        status: 'Delivered' 
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Mock Dairy App API - Database issues handled' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Mock server is running on port ${PORT}`);
    console.log('This is a fallback server with mock data');
    console.log('Please fix the database connection for full functionality');
});

module.exports = app;
