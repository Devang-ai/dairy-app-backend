const db = require('./src/config/db');
const Order = require('./src/models/orderModel');
const OrderService = require('./src/services/orderService');

async function testMerge() {
    try {
        console.log('--- STARTING ORDER MERGE TEST ---');
        
        // 1. Get a test user and product
        const [users] = await db.execute('SELECT id FROM users WHERE role = "user" LIMIT 1');
        const [products] = await db.execute('SELECT id FROM products LIMIT 1');
        const [variants] = await db.execute('SELECT id, variant_name FROM product_variants WHERE product_id = ? LIMIT 1', [products[0].id]);
        
        if (!users.length || !products.length) {
            console.error('No users or products found to test with.');
            process.exit(1);
        }

        const userId = users[0].id;
        const productId = products[0].id;
        const variantId = variants.length ? variants[0].id : 0;
        const variantName = variants.length ? variants[0].variant_name : '';
        const businessDate = OrderService.getBusinessDate();
        const deliveryDate = OrderService.getDeliveryDate(businessDate);

        console.log(`Test User: ${userId}, Product: ${productId}, Variant: ${variantId} (${variantName})`);
        console.log(`Business Date: ${businessDate}`);

        // 2. Clear any existing orders for today for this user to have a clean slate
        await db.execute('DELETE FROM orders WHERE user_id = ? AND business_date = ?', [userId, businessDate]);

        // 3. Place first order
        console.log('\nPlacing first order...');
        const items1 = [{
            product_id: productId,
            variant_id: variantId,
            quantity: 2
        }];
        
        const orderId1 = await Order.create({
            user_id: userId,
            route_id: 1, // dummy
            business_date: businessDate,
            delivery_date: deliveryDate,
            total_amount: null,
            items: items1
        });
        console.log(`Order 1 created with ID: ${orderId1}`);

        // 4. Place second order (should merge)
        console.log('\nPlacing second order for same user/day...');
        const items2 = [{
            product_id: productId,
            variant_id: variantId,
            quantity: 3
        }];

        // Check if existing order found
        const existing = await Order.findByUserAndDate(userId, businessDate);
        if (existing && existing.id === orderId1) {
            console.log('SUCCESS: Existing order found for merging.');
            await Order.addOrUpdateItems(existing.id, items2);
            console.log('Merged items into existing order.');
        } else {
            console.error('FAILURE: Existing order not found for merging.');
        }

        // 5. Verify results
        const items = await Order.getOrderItems(orderId1);
        console.log('\nFinal Order Items:');
        console.table(items.map(i => ({
            product: i.product_name,
            variant: i.variant_name,
            quantity: i.quantity,
            formatted: Order.formatQuantity(i.quantity, i.variant_name)
        })));

        const item = items.find(i => i.product_id === productId && i.variant_id === variantId);
        if (item && parseFloat(item.quantity) === 5) {
            console.log('\n✅ TEST PASSED: Quantities merged correctly (2 + 3 = 5)');
        } else {
            console.error(`\n❌ TEST FAILED: Quantity is ${item ? item.quantity : 'not found'}, expected 5`);
        }

        // Cleanup
        // await db.execute('DELETE FROM orders WHERE id = ?', [orderId1]);
        
    } catch (err) {
        console.error('Test Error:', err);
    } finally {
        await db.end();
        process.exit(0);
    }
}

testMerge();
