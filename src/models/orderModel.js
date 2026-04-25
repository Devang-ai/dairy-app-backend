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
                    'INSERT INTO orders (user_id, delivery_date, total_amount, status) VALUES (?, ?, ?)',
                    [user_id, delivery_date, total_amount || 0, 'pending']
                );
                orderId = orderResult.insertId;
            }

            await this.addOrUpdateItemsInternal(connection, orderId, items);

            await connection.commit();
            return orderId;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async findByUserAndDate(userId, businessDate) {
        try {
            const [rows] = await db.execute(
                'SELECT * FROM orders WHERE user_id = ? AND business_date = ? LIMIT 1',
                [userId, businessDate]
            );
            return rows[0];
        } catch (error) {
            // Fallback for old schema
            const [rows] = await db.execute(
                'SELECT * FROM orders WHERE user_id = ? AND DATE(delivery_date) = DATE_ADD(?, INTERVAL 1 DAY) LIMIT 1',
                [userId, businessDate]
            );
            return rows[0];
        }
    }

    static async addOrUpdateItems(orderId, items) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            
            await this.addOrUpdateItemsInternal(connection, orderId, items);
            
            // Recalculate order total if needed (wholesale doesn't use automation usually)
            
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async addOrUpdateItemsInternal(connection, orderId, items) {
        // Detect if variant_id column exists to avoid "Unknown column" errors
        let hasVariantId = true;
        try {
            await connection.execute('SELECT variant_id FROM order_items LIMIT 1');
        } catch (err) {
            hasVariantId = false;
        }

        // Detect if packet fields exist
        let hasPacketFields = true;
        try {
            await connection.execute('SELECT packet_size FROM order_items LIMIT 1');
        } catch (err) {
            hasPacketFields = false;
        }

        for (const item of items) {
            let existing = [];
            try {
                if (hasVariantId && item.variant_id) {
                    [existing] = await connection.execute(
                        'SELECT id, quantity, packet_count FROM order_items WHERE order_id = ? AND product_id = ? AND variant_id = ?',
                        [orderId, item.product_id, item.variant_id]
                    );
                } else {
                    [existing] = await connection.execute(
                        'SELECT id, quantity, packet_count FROM order_items WHERE order_id = ? AND product_id = ? AND (variant_id IS NULL OR variant_id = 0)',
                        [orderId, item.product_id]
                    );
                }
            } catch (selectErr) {
                console.warn('[OrderModel] Select error (fallback used):', selectErr.message);
                [existing] = await connection.execute(
                    'SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ?',
                    [orderId, item.product_id]
                );
            }

            if (existing.length > 0) {
                // UPDATE: Add quantities
                const newQuantity = parseFloat(existing[0].quantity) + parseFloat(item.quantity);
                const newPacketCount = hasPacketFields ? (parseInt(existing[0].packet_count || 0) + parseInt(item.packet_count || 0)) : null;

                let updateSql = 'UPDATE order_items SET quantity = ?';
                let updateParams = [newQuantity];
                
                if (hasPacketFields && item.packet_count !== undefined) {
                    updateSql += ', packet_count = ?';
                    updateParams.push(newPacketCount);
                }
                
                updateSql += ' WHERE id = ?';
                updateParams.push(existing[0].id);
                
                await connection.execute(updateSql, updateParams);
            } else {
                // INSERT: New item
                if (hasPacketFields && item.packet_size !== undefined) {
                    let insertSql = 'INSERT INTO order_items (order_id, product_id, quantity, final_price, packet_size, unit_type, packet_count';
                    let insertParams = [orderId, item.product_id, item.quantity, item.final_price || null, item.packet_size, item.unit_type, item.packet_count];
                    
                    if (hasVariantId) {
                        insertSql += ', variant_id';
                        insertParams.push(item.variant_id || 0);
                    }
                    
                    insertSql += ') VALUES (?, ?, ?, ?, ?, ?, ?' + (hasVariantId ? ', ?' : '') + ')';
                    await connection.execute(insertSql, insertParams);
                } else {
                    // Fallback to legacy insertion
                    let insertSql = 'INSERT INTO order_items (order_id, product_id, quantity, final_price' + (hasVariantId ? ', variant_id' : '') + ') VALUES (?, ?, ?, ?' + (hasVariantId ? ', ?' : '') + ')';
                    let insertParams = [orderId, item.product_id, item.quantity, item.final_price || null];
                    if (hasVariantId) insertParams.push(item.variant_id || 0);
                    await connection.execute(insertSql, insertParams);
                }
            }
        }
    }

    static async getAllDetail(filters) {
        const { route_id, date, user_id, startDate } = filters;
        
        // Detect if business_date exists
        let hasBusinessDate = true;
        try {
            await db.execute('SELECT business_date FROM orders LIMIT 1');
        } catch (err) {
            hasBusinessDate = false;
        }

        try {
            let query = `
                SELECT o.*, u.full_name as username, u.contact, r.name as route_name
                FROM orders o
                JOIN users u ON o.user_id = u.id
                LEFT JOIN routes r ON o.route_id = r.id
                WHERE 1=1
            `;
            const params = [];

            if (hasBusinessDate) {
                if (startDate) {
                    query += ' AND (o.business_date >= ? OR DATE(o.delivery_date) >= ?)';
                    params.push(startDate, startDate);
                } else if (date) {
                    if (user_id) {
                        query += ' AND (o.business_date = ? OR DATE(o.delivery_date) = ?)';
                        params.push(date, date);
                    } else {
                        query += ' AND o.business_date = ?';
                        params.push(date);
                    }
                }
            } else {
                // LEGACY FALLBACK: business_date missing
                if (startDate) {
                    query += ' AND DATE(o.delivery_date) >= DATE_ADD(?, INTERVAL 1 DAY)';
                    params.push(startDate);
                } else if (date) {
                    query += ' AND DATE(o.delivery_date) = DATE_ADD(?, INTERVAL 1 DAY)';
                    params.push(date);
                }
            }

            if (route_id && route_id !== 'all') {
                query += ' AND o.route_id = ?';
                params.push(route_id);
            }

            if (user_id) {
                query += ' AND o.user_id = ?';
                params.push(user_id);
            }

            query += ' ORDER BY o.created_at DESC';
            const [rows] = await db.execute(query, params);
            return rows;
        } catch (error) {
            return [];
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
        let hasVariantId = true;
        try {
            await db.execute('SELECT variant_id FROM order_items LIMIT 1');
        } catch (err) {
            hasVariantId = false;
        }

        try {
            // Detect if packet fields exist
            let hasPacketFields = true;
            try {
                await db.execute('SELECT packet_size FROM order_items LIMIT 1');
            } catch (err) {
                hasPacketFields = false;
            }

            const query = `
                SELECT 
                    oi.id,
                    oi.product_id,
                    oi.quantity,
                    oi.final_price,
                    ${hasPacketFields ? 'oi.packet_size, oi.unit_type, oi.packet_count, ' : ''}
                    p.name as product_name,
                    p.image_url,
                    p.category,
                    ${hasVariantId ? 'oi.variant_id, pv.variant_name' : 'NULL as variant_id, NULL as variant_name'}
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                ${hasVariantId ? 'LEFT JOIN product_variants pv ON oi.variant_id = pv.id' : ''}
                WHERE oi.order_id = ?
            `;
            const [rows] = await db.execute(query, [orderId]);
            return rows;
        } catch (error) {
            // Fallback for missing variant_id column
            const [rows] = await db.execute(`
                SELECT oi.*, p.name as product_name, NULL as variant_name
                FROM order_items oi
                LEFT JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            `, [orderId]);
            return rows;
        }
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

    // Format quantity for display (Unit x Quantity)
    static formatQuantity(quantity, variantName = '') {
        const qty = parseFloat(quantity) || 0;
        const cleanQty = parseFloat(qty.toFixed(3));
        
        if (variantName) {
            return `${variantName} × ${cleanQty}`;
        }

        // Fallback to old logic if no variant name provided
        if (qty >= 1) {
            return `${cleanQty} kg`;
        } else {
            return `${Math.round(qty * 1000)} gm`;
        }
    }
}

module.exports = Order;
