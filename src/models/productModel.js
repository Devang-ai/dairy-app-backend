const db = require('../config/db');

class Product {
    static async getAll() {
        const [rows] = await db.execute('SELECT * FROM products');
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.execute('SELECT * FROM products WHERE id = ?', [id]);
        return rows[0];
    }

    static async getVariants(productId) {
        const [rows] = await db.execute('SELECT * FROM product_variants WHERE product_id = ?', [productId]);
        return rows;
    }

    static async create(productData) {
        const { name, description, image_url, is_available = 1 } = productData;
        const [result] = await db.execute(
            'INSERT INTO products (name, description, image_url, is_available) VALUES (?, ?, ?, ?)',
            [name, description, image_url, is_available]
        );
        return result.insertId;
    }

    static async update(id, productData) {
        const { name, description, image_url, is_available } = productData;
        await db.execute(
            'UPDATE products SET name = ?, description = ?, image_url = ?, is_available = ? WHERE id = ?',
            [name, description, image_url, is_available === undefined ? 1 : is_available, id]
        );
    }

    static async delete(id) {
        await db.execute('DELETE FROM products WHERE id = ?', [id]);
    }

    // Variant methods
    static async createVariant(variantData) {
        const { product_id, variant_name, price, stock } = variantData;
        const [result] = await db.execute(
            'INSERT INTO product_variants (product_id, variant_name, price, stock) VALUES (?, ?, ?, ?)',
            [product_id, variant_name, price, stock]
        );
        return result.insertId;
    }

    static async updateVariant(id, variantData) {
        const { variant_name, price, stock } = variantData;
        await db.execute(
            'UPDATE product_variants SET variant_name = ?, price = ?, stock = ? WHERE id = ?',
            [variant_name, price, stock, id]
        );
    }

    static async deleteVariant(id) {
        await db.execute('DELETE FROM product_variants WHERE id = ?', [id]);
    }
}

module.exports = Product;
