const OrderService = require('./src/services/orderService');

function test(timeStr, label) {
    const mockDate = new Date(`2026-04-01T${timeStr}:00`);
    const businessDate = OrderService.getBusinessDate(mockDate);
    const deliveryDate = OrderService.getDeliveryDate(businessDate);
    
    console.log(`[${label}] Time: ${timeStr}`);
    console.log(`   Expected Business: ${timeStr < "02:00" ? "2026-03-31" : "2026-04-01"}`);
    console.log(`   Actual Business:   ${businessDate}`);
    console.log(`   Delivery Date:     ${deliveryDate}`);
    console.log(businessDate === (timeStr < "02:00" ? "2026-03-31" : "2026-04-01") ? "✅ PASS" : "❌ FAIL");
    console.log('-------------------------');
}

console.log('--- TESTING 2 AM CUTOFF LOGIC ---');
test("01:30", "Before Cutoff");
test("02:30", "After Cutoff");
test("23:59", "End of Day");
test("00:01", "Start of Calendar Day");
