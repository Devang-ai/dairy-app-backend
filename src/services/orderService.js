const moment = require('moment');

class OrderService {
    /**
     * Get the current business date based on 2 AM IST cutoff.
     * 2 AM IST (Today) to 1:59 AM IST (Next Day) = One Business Date.
     */
    static getBusinessDate() {
        // Get current time in IST
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const currentHour = nowIST.getHours();
        
        const businessDate = new Date(nowIST);
        
        if (currentHour < 2) {
            // If it's between 12:00 AM and 1:59 AM IST, it's still the previous business day
            businessDate.setDate(nowIST.getDate() - 1);
        }
        
        // Return YYYY-MM-DD
        return businessDate.toISOString().split('T')[0];
    }

    /**
     * Delivery is always Business Date + 1 Day
     */
    static getDeliveryDate(businessDateStr) {
        const date = new Date(businessDateStr);
        date.setDate(date.getDate() + 1);
        return date.toISOString().split('T')[0];
    }

    /**
     * Optional: Check if we are currently before the 2 AM cutoff
     */
    static isCutoffPending() {
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        return nowIST.getHours() < 2;
    }
}

module.exports = OrderService;
