const db = require('../config/db');

class Order {
    static async create(orderData) {
        const { user_id, route_id, total_amount, business_date, delivery_date, items } = orderData;
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            let orderId;
            try {
                // Try inserting with new optimized schema (route_id, business_date)
                const [orderResult] = await connection.execute(
                    'INSERT INTO orders (user_id, route_id, business_date, delivery_date, total_amount, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [user_id, route_id, business_date, delivery_date, total_amount || 0, 'Pending']
                );
                orderId = orderResult.insertId;
            } catch (err) {
                // FALLBACK: Use original schema if migration is pending (no route_id / business_date columns)
                console.log('[OrderModel] Fallback insertion due to:', err.message);
                const [orderResult] = await connection.execute(
                    'INSERT INTO orders (user_id, delivery_date, total_amount, status) VALUES (?, ?, ?, ?)',
                    [user_id, delivery_date, total_amount || 0, 'pending']
                );
                orderId = orderResult.insertId;
            }

            for (const item of items) {
                try {
                    // Wholesale/migrated schema: quantity as decimal, final_price nullable
                    await connection.execute(
                        'INSERT INTO order_items (order_id, product_id, quantity, final_price) VALUES (?, ?, ?, ?)',
                        [orderId, item.product_id, item.quantity, item.final_price || null]
                    );
                } catch (itemErr) {
                    try {
                        // Fallback 1: Schema has final_price but also requires variant_id and unit_price
                        console.log('[OrderModel] Fallback item insert (with variant_id):', itemErr.message);
                        await connection.execute(
                            'INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price, final_price) VALUES (?, ?, ?, ?, ?, ?)',
                            [orderId, item.product_id, item.variant_id || 0, item.quantity, 0, item.final_price || null]
                        );
                    } catch (itemErr2) {
                        // Fallback 2: Original schema - no final_price column at all
                        console.log('[OrderModel] Fallback item insert (original schema):', itemErr2.message);
                        await connection.execute(
                            'INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)',
                            [orderId, item.product_id, item.variant_id || 0, item.quantity, 0]
                        );
                    }
                }
            }

            await connection.commit();
            return orderId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async getAllDetail(filters) {
        const { route_id, date, user_id } = filters;
        
        try {
            let query = `
                SELECT o.*, u.full_name as username, u.contact, r.name as route_name
                FROM orders o
                JOIN users u ON o.user_id = u.id
                LEFT JOIN routes r ON o.route_id = r.id
                WHERE 1=1
            `;
            const params = [];

            if (route_id && route_id !== 'all') {
                query += ' AND o.route_id = ?';
                params.push(route_id);
            }
            if (date) {
                // For user queries, match on either business_date OR delivery_date
                // so orders never disappear due to 2AM cutoff timing differences
                if (user_id) {
                    query += ' AND (o.business_date = ? OR DATE(o.delivery_date) = ?)';
                    params.push(date, date);
                } else {
                    // Admin: strict business_date filter
                    query += ' AND o.business_date = ?';
                    params.push(date);
                }
            }
            if (user_id) {
                query += ' AND o.user_id = ?';
                params.push(user_id);
            }

            query += ' ORDER BY o.created_at DESC';
            const [rows] = await db.execute(query, params);
            return rows;
        } catch (error) {
            console.log('[OrderModel] Falling back to legacy query due to:', error.message);
            let fallbackQuery = `
                SELECT o.*, u.full_name as username, u.contact, r.name as route_name
                FROM orders o
                JOIN users u ON o.user_id = u.id
                LEFT JOIN routes r ON u.route_id = r.id
                WHERE DATE(o.delivery_date) = DATE_ADD(?, INTERVAL 1 DAY)
            `;
            const fallbackParams = [date];
            
            if (route_id && route_id !== 'all') {
                fallbackQuery += ' AND u.route_id = ?';
                fallbackParams.push(route_id);
            }
            
            const [rows] = await db.execute(fallbackQuery, fallbackParams);
            return rows;
        }
    }


    static async getByUserId(userId) {
        const [rows] = await db.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [userId]);
        return rows;
    }

    static async updateStatus(orderId, status) {
        try {
            console.log('[OrderModel] Updating order status:', { orderId, status });
            const [result] = await db.execute(
                'UPDATE orders SET status = ? WHERE id = ?',
                [status, orderId]
            );
            console.log('[OrderModel] Update result:', result);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('[OrderModel] Error updating status:', error);
            throw error;
        }
    }

    static async getOrderItems(orderId) {
        const [rows] = await db.execute(`
            SELECT oi.*, p.name as product_name
            FROM order_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `, [orderId]);
        return rows;
    }

    // New method for admin to update final price
    static async updateItemPrice(orderItemId, finalPrice) {
        try {
            const [result] = await db.execute(
                'UPDATE order_items SET final_price = ? WHERE id = ?',
                [finalPrice, orderItemId]
            );
            
            // Recalculate order total
            await this.recalculateOrderTotal(orderItemId);
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('[OrderModel] Error updating item price:', error);
            throw error;
        }
    }

    // Recalculate order total based on item prices
    static async recalculateOrderTotal(orderItemId) {
        try {
            // Get order_id from the item
            const [orderItem] = await db.execute(
                'SELECT order_id FROM order_items WHERE id = ?',
                [orderItemId]
            );
            
            if (orderItem.length === 0) return;
            
            const orderId = orderItem[0].order_id;
            
            // Calculate total from all items with final prices
            const [totalResult] = await db.execute(`
                SELECT SUM(final_price) as total_amount
                FROM order_items 
                WHERE order_id = ? AND final_price IS NOT NULL
            `, [orderId]);
            
            const totalAmount = totalResult[0].total_amount || 0;
            
            // Update order total
            await db.execute(
                'UPDATE orders SET total_amount = ? WHERE id = ?',
                [totalAmount, orderId]
            );
        } catch (error) {
            console.error('[OrderModel] Error recalculating order total:', error);
            throw error;
        }
    }

    // Format quantity for display (0.100 -> "100 gm", 1 -> "1 kg")
    static formatQuantity(quantity) {
        if (quantity >= 1) {
            return `${quantity} kg`;
        } else {
            return `${(quantity * 1000).toFixed(0)} gm`;
        }
    }
}

module.exports = Order;
