const db = require('../config/db');

class Product {
    static async getAll() {
        try {
            const [rows] = await db.execute('SELECT * FROM products');
            return rows;
        } catch (error) {
            console.error('[ProductModel] getAll Error:', error.message);
            throw error;
        }
    }

    static async getById(id) {
        try {
            const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
            return rows[0];
        } catch (error) {
            console.error('[ProductModel] getById Error:', error.message);
            throw error;
        }
    }

    static async getVariants(productId) {
        try {
            const [rows] = await db.execute('SELECT * FROM product_variants WHERE product_id = ?', [productId]);
            return rows;
        } catch (error) {
            console.warn('[ProductModel] getVariants Error (Table might be missing):', error.message);
            return []; // Return empty instead of crashing if table is missing
        }
    }

    static async create(productData) {
        try {
            const { name, description, image_url, category, is_available = 1 } = productData;
            console.log('>>> [ProductModel] Attempting to create product:', { name, category });
            const [result] = await db.execute(
                'INSERT INTO products (name, description, image_url, category, is_available) VALUES (?, ?, ?, ?, ?)',
                [name, description, image_url, category || 'All', is_available]
            );
            return result.insertId;
        } catch (error) {
            console.error('[ProductModel] create Error:', error.message);
            console.error('[ProductModel] SQL Error Stack:', error.stack);
            throw error;
        }
    }

    static async update(id, productData) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const { name, description, image_url, category, is_available, variants } = productData;
            
            // 1. Update Product Details
            await connection.execute(
                'UPDATE products SET name = ?, description = ?, image_url = ?, category = ?, is_available = ? WHERE id = ?',
                [name, description, image_url, category || 'All', is_available === undefined ? 1 : is_available, id]
            );

            // 2. Sync Variants (if provided)
            if (variants && Array.isArray(variants)) {
                // Get current variant IDs to know which ones were removed
                const [currentVariants] = await connection.execute('SELECT id FROM product_variants WHERE product_id = ?', [id]);
                const currentIds = currentVariants.map(v => v.id);
                const incomingIds = variants.filter(v => v.id).map(v => v.id);
                const toDelete = currentIds.filter(cid => !incomingIds.includes(cid));

                // Delete removed variants
                if (toDelete.length > 0) {
                    for (const vid of toDelete) {
                        try {
                            await connection.execute('DELETE FROM product_variants WHERE id = ?', [vid]);
                        } catch (e) {
                             console.warn(`[ProductModel] Could not delete variant ${vid} (it might be referenced in orders). skipping delete for this variant.`);
                        }
                    }
                }

                // Update or Insert variants
                for (const v of variants) {
                    if (!v.variant_name || v.variant_name.trim() === '') continue;
                    
                    if (v.id && incomingIds.includes(v.id)) {
                        // Update existing
                        await connection.execute(
                            'UPDATE product_variants SET variant_name = ?, price = ?, stock = ? WHERE id = ?',
                            [v.variant_name, v.price || 0, v.stock || 100, v.id]
                        );
                    } else {
                        // Insert new
                        await connection.execute(
                            'INSERT INTO product_variants (product_id, variant_name, price, stock) VALUES (?, ?, ?, ?)',
                            [id, v.variant_name, v.price || 0, v.stock || 100]
                        );
                    }
                }
            }

            await connection.commit();
        } catch (error) {
            await connection.rollback();
            console.error('[ProductModel] update Transactional Error:', error.message);
            throw error;
        } finally {
            connection.release();
        }
    }

    static async delete(id) {
        console.log('>>> [ProductModel] Cleaning up dependencies for product ID:', id);
        try {
            // Check order_items first
            const [orderItems] = await db.execute('SELECT COUNT(*) as count FROM order_items WHERE product_id = ?', [id]);
            const [variants] = await db.execute('SELECT COUNT(*) as count FROM product_variants WHERE product_id = ?', [id]);
            
            console.log(`>>> [ProductModel] Found ${orderItems[0].count} order items and ${variants[0].count} variants to clean.`);

            // Cleanup sequence
            await db.execute('DELETE FROM order_items WHERE product_id = ?', [id]);
            await db.execute('DELETE FROM product_variants WHERE product_id = ?', [id]);
            
            // Final delete
            const [result] = await db.execute('DELETE FROM products WHERE id = ?', [id]);
            
            if (result.affectedRows === 0) {
                console.warn('>>> [ProductModel] No product was found with ID:', id);
            } else {
                console.log('>>> [ProductModel] Product row deleted successfully.');
            }
        } catch (error) {
            console.error('[ProductModel] delete Error:', error.message);
            throw error;
        }
    }



    // Variant methods
    static async createVariant(variantData) {
        try {
            const { product_id, variant_name, price = 0, stock = 100 } = variantData;
            const [result] = await db.execute(
                'INSERT INTO product_variants (product_id, variant_name, price, stock) VALUES (?, ?, ?, ?)',
                [product_id, variant_name, price, stock]
            );
            return result.insertId;
        } catch (error) {
            console.error('[ProductModel] createVariant Error:', error.message);
            throw error;
        }
    }

    static async updateVariant(id, variantData) {
        try {
            const { variant_name, price, stock } = variantData;
            await db.execute(
                'UPDATE product_variants SET variant_name = ?, price = ?, stock = ? WHERE id = ?',
                [variant_name, price, stock, id]
            );
        } catch (error) {
            console.error('[ProductModel] updateVariant Error:', error.message);
            throw error;
        }
    }

    static async deleteVariant(id) {
        try {
            await db.execute('DELETE FROM product_variants WHERE id = ?', [id]);
        } catch (error) {
            console.error('[ProductModel] deleteVariant Error:', error.message);
            throw error;
        }
    }
}

module.exports = Product;
