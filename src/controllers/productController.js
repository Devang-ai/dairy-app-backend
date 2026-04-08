const Product = require('../models/productModel');

const jwt = require('jsonwebtoken');

exports.getProducts = async (req, res) => {
    try {
        const products = await Product.getAll();
        
        // Check if requester is admin
        let isAdmin = false;
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded && decoded.role === 'admin') isAdmin = true;
            } catch (e) { /* ignore invalid token for public route */ }
        }

        const filteredProducts = isAdmin ? products : products.filter(p => p.is_available === 1);

        const productsWithVariants = await Promise.all(filteredProducts.map(async (product) => {
            const variants = await Product.getVariants(product.id);
            return { ...product, variants };
        }));
        res.json(productsWithVariants);
    } catch (error) {
        console.error('Error in getProducts:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
};

exports.getProductById = async (req, res) => {
    try {
        const product = await Product.getById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });
        const variants = await Product.getVariants(product.id);
        res.json({ ...product, variants });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching product' });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const { name, description, image_url, category, variants } = req.body;
        const productId = await Product.create({ name, description, image_url, category });
        
        if (variants && Array.isArray(variants)) {
            await Promise.all(variants.map(v => Product.createVariant({ ...v, product_id: productId })));
        }

        res.status(201).json({ message: 'Product created successfully', productId });
    } catch (error) {
        res.status(500).json({ message: 'Error creating product' });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        await Product.update(req.params.id, req.body);
        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error('[ProductController] Update Error:', error);
        res.status(500).json({ message: 'Error updating product', error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const { id } = req.params;
    console.log('>>> [ProductController] Attempting to delete product:', id);
    if (!id) return res.status(400).json({ message: 'Product ID is missing' });
    
    try {
        await Product.delete(id);
        console.log('<<< [ProductController] Product deleted successfully:', id);
        res.json({ message: 'Product deleted successfully', id });
    } catch (error) {
        console.error('<<< [ProductController] Critical Delete Error:', error.message);
        res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
};


// Variant controllers
exports.addVariant = async (req, res) => {
    try {
        const variantId = await Product.createVariant({ ...req.body, product_id: req.params.productId });
        res.status(201).json({ message: 'Variant added successfully', variantId });
    } catch (error) {
        res.status(500).json({ message: 'Error adding variant' });
    }
};

exports.updateVariant = async (req, res) => {
    try {
        await Product.updateVariant(req.params.variantId, req.body);
        res.json({ message: 'Variant updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating variant' });
    }
};

exports.deleteVariant = async (req, res) => {
    try {
        await Product.deleteVariant(req.params.variantId);
        res.json({ message: 'Variant deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting variant' });
    }
};
