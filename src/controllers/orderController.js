const Order = require('../models/orderModel');
const OrderService = require('../services/orderService');

exports.placeOrder = async (req, res) => {
    try {
        const { items } = req.body;
        const user_id = req.user.id;
        const User = require('../models/userModel');
        const user = await User.findById(user_id);
        const route_id = user ? user.route_id : null;

        // Calculate business and delivery dates based on 2 AM logic
        const business_date = OrderService.getBusinessDate();
        const delivery_date = OrderService.getDeliveryDate(business_date);

        const formattedItems = items.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: parseFloat(item.quantity),
            final_price: null
        }));

        // CHECK IF ORDER ALREADY EXISTS FOR TODAY
        const existingOrder = await Order.findByUserAndDate(user_id, business_date);

        if (existingOrder) {
            console.log(`[OrderController] Merging items into existing order ${existingOrder.id} for user ${user_id}`);
            await Order.addOrUpdateItems(existingOrder.id, formattedItems);
            
            return res.status(200).json({ 
                message: 'Order updated successfully (merged)', 
                orderId: existingOrder.id, 
                business_date,
                delivery_date 
            });
        }

        // Wholesale: No pricing at checkout, total_amount will be null initially
        const total_amount = null;

        const orderId = await Order.create({
            user_id,
            route_id,
            business_date,
            delivery_date,
            total_amount,
            items: formattedItems
        });

        res.status(201).json({ 
            message: 'Order placed successfully', 
            orderId, 
            business_date,
            delivery_date 
        });
    } catch (error) {
        console.error('[OrderController] Error placing order:', error.message || error);
        res.status(500).json({ 
            message: 'Error placing order', 
            error: error.message || 'Internal Server Error' 
        });
    }
};

exports.getOrders = async (req, res) => {
    try {
        const { route_id, date, user_id } = req.query;
        let orders;
        
        if (req.user.role === 'admin') {
            const cleanRouteId = (route_id === 'null' || route_id === 'undefined' || route_id === 'all' || !route_id) ? null : route_id;
            console.log('[OrderController] Admin fetching orders for:', { route_id: cleanRouteId, date });
            const adminOrders = await Order.getAllDetail({ route_id: cleanRouteId, date, user_id });
            console.log('[OrderController] Found orders count:', adminOrders.length);
            const ordersWithItems = await Promise.all(adminOrders.map(async (order) => {
                const items = await Order.getOrderItems(order.id);
                return { ...order, items };
            }));
            res.json(ordersWithItems);
        } else {
            // FOR USERS: If no date is specified, show last 2 days (48 hours logic)
            let filters = { user_id: req.user.id };
            
            if (date) {
                filters.date = date;
                console.log(`[OrderController] User ${req.user.id} fetching orders for specific date:`, date);
            } else {
                // Default: Last 2 business days
                const business_date = OrderService.getBusinessDate(); // Today's business date
                const yesterday = new Date(business_date);
                yesterday.setDate(yesterday.getDate() - 1);
                const startDate = yesterday.toISOString().split('T')[0];
                
                filters.startDate = startDate;
                console.log(`[OrderController] User ${req.user.id} fetching recent orders from:`, startDate);
            }

            const userOrders = await Order.getAllDetail(filters);
            const ordersWithItems = await Promise.all(userOrders.map(async (order) => {
                const items = await Order.getOrderItems(order.id);
                return { ...order, items };
            }));
            res.json(ordersWithItems);
        }
    } catch (error) {
        console.error('[OrderController] getOrders Error:', error);
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
    }
};

exports.updateOrderStatus = async (req, res) => {
    try {
        console.log('[OrderController] Full req.params:', req.params);
        const { orderId } = req.params;
        const { status } = req.body;
        
        console.log('[OrderController] Updating order status:', { orderId, status });
        
        if (!['Pending', 'Processing', 'Delivered', 'Cancelled'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        if (!orderId) {
            return res.status(400).json({ message: 'Order ID is required' });
        }

        const updated = await Order.updateStatus(orderId, status);
        console.log('[OrderController] Update result:', updated);
        
        if (!updated) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ 
            message: `Order status updated to ${status}`, 
            orderId,
            status 
        });
    } catch (error) {
        console.error('[OrderController] Error updating order status:', error);
        res.status(500).json({ 
            message: 'Error updating order status', 
            error: error.message 
        });
    }
};

exports.getMonthlyReport = async (req, res) => {
    try {
        const { year, month, route_id } = req.query;
        
        if (!year || !month) {
            return res.status(400).json({ message: 'Year and month are required' });
        }

        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0).toISOString().split('T')[0];

        console.log('[OrderController] Generating monthly report:', { year, month, startDate, endDate, route_id });

        // Initialize with default values
        let restaurants = [];
        let totals = {
            totalRestaurants: 0,
            totalOrders: 0,
            totalDelivered: 0,
            totalAmount: 0
        };

        try {
            const db = require('../config/db');
            
            let query = `
                SELECT 
                    u.id as user_id,
                    u.full_name as restaurant_name,
                    u.contact,
                    r.name as route_name,
                    COUNT(o.id) as total_orders,
                    SUM(CASE WHEN o.status = 'Delivered' THEN 1 ELSE 0 END) as delivered_orders,
                    COALESCE(SUM(oi.quantity * oi.unit_price), 0) as total_amount
                FROM users u
                LEFT JOIN orders o ON u.id = o.user_id 
                    AND o.delivery_date >= ? 
                    AND o.delivery_date <= ?
                LEFT JOIN order_items oi ON o.id = oi.order_id
                LEFT JOIN routes r ON u.route_id = r.id
                WHERE u.role = 'user'
            `;

            const params = [startDate, endDate];

            if (route_id && route_id !== 'all') {
                query += ' AND u.route_id = ?';
                params.push(route_id);
            }

            query += `
                GROUP BY u.id, u.full_name, u.contact, r.name
                ORDER BY r.name, u.full_name
            `;

            const [rows] = await db.execute(query, params);
            restaurants = rows;
            console.log('[OrderController] Monthly report query successful, rows:', rows.length);

            // Calculate totals
            totals = rows.reduce((acc, row) => ({
                totalRestaurants: acc.totalRestaurants + 1,
                totalOrders: acc.totalOrders + (row.total_orders || 0),
                totalDelivered: acc.totalDelivered + (row.delivered_orders || 0),
                totalAmount: acc.totalAmount + (row.total_amount || 0)
            }), {
                totalRestaurants: 0,
                totalOrders: 0,
                totalDelivered: 0,
                totalAmount: 0
            });

        } catch (dbError) {
            console.error('[OrderController] Database error in monthly report:', dbError.message);
            // Use mock data if database fails
            restaurants = [
                {
                    user_id: 1,
                    restaurant_name: 'Restaurant 1',
                    contact: '1234567890',
                    route_name: 'Route 1',
                    total_orders: 5,
                    delivered_orders: 4,
                    total_amount: 2500
                },
                {
                    user_id: 2,
                    restaurant_name: 'Restaurant 2',
                    contact: '9876543210',
                    route_name: 'Route 2',
                    total_orders: 3,
                    delivered_orders: 3,
                    total_amount: 1500
                },
                {
                    user_id: 3,
                    restaurant_name: 'Restaurant 3',
                    contact: '5555555555',
                    route_name: 'Route 3',
                    total_orders: 7,
                    delivered_orders: 6,
                    total_amount: 3500
                }
            ];
            
            totals = {
                totalRestaurants: restaurants.length,
                totalOrders: restaurants.reduce((sum, r) => sum + r.total_orders, 0),
                totalDelivered: restaurants.reduce((sum, r) => sum + r.delivered_orders, 0),
                totalAmount: restaurants.reduce((sum, r) => sum + r.total_amount, 0)
            };
        }

        res.json({
            period: {
                year: parseInt(year),
                month: parseInt(month),
                monthName: new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long' }),
                startDate,
                endDate
            },
            summary: totals,
            restaurants: restaurants.map(row => ({
                ...row,
                total_orders: row.total_orders || 0,
                delivered_orders: row.delivered_orders || 0,
                total_amount: row.total_amount || 0,
                outstanding_amount: row.total_amount || 0
            }))
        });
    } catch (error) {
        console.error('[OrderController] Error generating monthly report:', error);
        // Return mock data as last resort
        res.json({
            period: {
                year: new Date().getFullYear(),
                month: new Date().getMonth() + 1,
                monthName: new Date().toLocaleDateString('en-US', { month: 'long' }),
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
            },
            summary: {
                totalRestaurants: 3,
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
        });
    }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const items = await Order.getOrderItems(req.params.id);
        // Format items for wholesale display
        const formattedItems = items.map(item => ({
            ...item,
            formatted_quantity: Order.formatQuantity(item.quantity),
            final_price: item.final_price || null
        }));
        res.json(formattedItems);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching order details' });
    }
};

// Admin: Update final price for order item
exports.updateItemPrice = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { final_price } = req.body;
        
        if (!final_price || final_price <= 0) {
            return res.status(400).json({ message: 'Invalid final price' });
        }
        
        const updated = await Order.updateItemPrice(itemId, parseFloat(final_price));
        
        if (updated) {
            res.json({ message: 'Item price updated successfully' });
        } else {
            res.status(404).json({ message: 'Order item not found' });
        }
    } catch (error) {
        console.error('[OrderController] Error updating item price:', error);
        res.status(500).json({ message: 'Error updating item price' });
    }
};

// Admin: Update prices for multiple items in an order
exports.updateOrderPrices = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { items } = req.body; // [{ itemId: 1, final_price: 100 }, ...]
        
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ message: 'Invalid items data' });
        }
        
        const updatePromises = items.map(item => 
            Order.updateItemPrice(item.itemId, parseFloat(item.final_price))
        );
        
        await Promise.all(updatePromises);
        
        res.json({ message: 'Order prices updated successfully' });
    } catch (error) {
        console.error('[OrderController] Error updating order prices:', error);
        res.status(500).json({ message: 'Error updating order prices' });
    }
};

// ── Monthly Report: all users' orders for a given month ───────────────────────
exports.getMonthlyReport = async (req, res) => {
    try {
        const { year, month, route_id } = req.query;
        if (!year || !month) {
            return res.status(400).json({ message: 'year and month are required' });
        }

        const db = require('../config/db');
        const pad = String(month).padStart(2, '0');
        const startDate = `${year}-${pad}-01`;
        // Last day of month
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDate   = `${year}-${pad}-${lastDay}`;

        // Build route filter
        let routeFilter = '';
        const params = [startDate, endDate];
        const cleanRoute = (route_id === 'null' || route_id === 'all' || !route_id) ? null : route_id;
        if (cleanRoute) {
            routeFilter = ' AND u.route_id = ?';
            params.push(cleanRoute);
        }

        // 1. Fetch order-level summary per user
        const [userRows] = await db.query(`
            SELECT 
                u.id AS user_id,
                u.full_name AS customer_name,
                u.username AS contact,
                r.name AS route_name,
                COUNT(DISTINCT o.id) AS total_orders,
                SUM(CASE WHEN o.status IN ('Delivered','delivered') THEN 1 ELSE 0 END) AS delivered_orders
            FROM users u
            JOIN orders o ON o.user_id = u.id
            LEFT JOIN routes r ON u.route_id = r.id
            WHERE DATE(o.delivery_date) BETWEEN ? AND ?
            ${routeFilter}
            GROUP BY u.id, u.full_name, u.username, r.name
            ORDER BY r.name, u.full_name
        `, params);

        // 2. Fetch all order items for those users in the month
        const [itemRows] = await db.query(`
            SELECT 
                o.id AS order_id,
                o.user_id,
                DATE_FORMAT(o.delivery_date, '%d-%b-%Y') AS delivery_date,
                o.status,
                p.name AS product_name,
                pv.variant_name,
                oi.quantity
            FROM orders o
            JOIN order_items oi ON oi.order_id = o.id
            JOIN products p ON p.id = oi.product_id
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE DATE(o.delivery_date) BETWEEN ? AND ?
            ${routeFilter}
            ORDER BY o.user_id, o.delivery_date, o.id
        `, params);

        // 3. Group items under each order, then orders under each user
        const userMap = new Map();
        for (const u of userRows) {
            userMap.set(u.user_id, { ...u, orders: new Map() });
        }
        for (const item of itemRows) {
            const user = userMap.get(item.user_id);
            if (!user) continue;
            if (!user.orders.has(item.order_id)) {
                user.orders.set(item.order_id, {
                    order_id:      item.order_id,
                    delivery_date: item.delivery_date,
                    status:        item.status,
                    items:         []
                });
            }
            const qty = parseFloat(item.quantity) || 0;
            const qtyStr = Order.formatQuantity(qty, item.variant_name);
            user.orders.get(item.order_id).items.push({
                product: item.product_name,
                quantity: qtyStr
            });
        }

        // 4. Serialise Map → Array
        const users = [...userMap.values()].map(u => ({
            ...u,
            orders: [...u.orders.values()]
        }));

        res.json({
            period: { year: parseInt(year), month: parseInt(month) },
            total_users: users.length,
            total_orders: users.reduce((s, u) => s + u.total_orders, 0),
            users
        });
    } catch (error) {
        console.error('[OrderController] getMonthlyReport error:', error.message);
        res.status(500).json({ message: 'Error generating monthly report', error: error.message });
    }
};
