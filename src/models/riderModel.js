const db = require('../config/db');

class Rider {
    static async create(riderData) {
        const {
            name, email, phone, city,
            vehicle_type, vehicle_number,
            aadhar_url, license_url, pan_url, rc_url,
            account_number, ifsc, bank_name
        } = riderData;

        const query = `
            INSERT INTO riders (
                name, email, phone, city, 
                vehicle_type, vehicle_number, 
                aadhar_url, license_url, pan_url, rc_url, 
                account_number, ifsc, bank_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            name, email, phone, city,
            vehicle_type, vehicle_number,
            aadhar_url, license_url, pan_url, rc_url,
            account_number, ifsc, bank_name
        ];

        const [result] = await db.execute(query, values);
        return result.insertId;
    }

    static async findByPhone(phone) {
        const [rows] = await db.execute('SELECT * FROM riders WHERE phone = ?', [phone]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM riders WHERE id = ?', [id]);
        return rows[0];
    }

    static async getAll() {
        const [rows] = await db.execute('SELECT * FROM riders ORDER BY created_at DESC');
        return rows;
    }

    static async updateStatus(id, status) {
        const [result] = await db.execute('UPDATE riders SET status = ? WHERE id = ?', [status, id]);
        return result.affectedRows;
    }
}

module.exports = Rider;
