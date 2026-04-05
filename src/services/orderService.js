const moment = require('moment');

class OrderService {
    static getBusinessDate(date = new Date()) {
        const cutoffHour = 2;
        const currentHour = date.getHours();
        const businessDate = new Date(date);
        
        if (currentHour < cutoffHour) {
            // 12:00 AM - 1:59 AM: Assign previous date
            businessDate.setDate(date.getDate() - 1);
        }
        
        return businessDate.toISOString().split('T')[0];
    }

    static getDeliveryDate(businessDateStr) {
        // Delivery is always Business Date + 1 Day
        const date = new Date(businessDateStr);
        date.setDate(date.getDate() + 1);
        return date.toISOString().split('T')[0];
    }

    static isCutoffPending() {
        const now = new Date();
        const cutoffHour = 2;
        return now.getHours() < cutoffHour;
    }
}

module.exports = OrderService;
