const db = require('../config/db');

class User {
    static async findByUsername(username) {
        const query = `
            SELECT u.*, r.name as route_name 
            FROM users u
            LEFT JOIN routes r ON u.route_id = r.id
            WHERE u.username = ?
        `;
        const [rows] = await db.execute(query, [username]);
        return rows[0];
    }

    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [id]);
        return rows[0];
    }

    static async create(userData) {
        const { full_name, username, password, role, route_id, contact, address, authorized_person_name } = userData;
        const [result] = await db.execute(
            'INSERT INTO users (full_name, username, password, role, route_id, contact, address, authorized_person_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [full_name, username, password, role || 'user', route_id, contact, address, authorized_person_name]
        );
        return result.insertId;
    }

    static async getAllRoutes() {
        const [rows] = await db.execute('SELECT * FROM routes');
        return rows;
    }
    static async getAllUsersWithRoutes() {
        const query = `
            SELECT u.id, u.full_name, u.username, u.contact, u.address, u.authorized_person_name, r.name as route_name 
            FROM users u
            LEFT JOIN routes r ON u.route_id = r.id
            WHERE u.role = 'user'
            ORDER BY u.username ASC
        `;
        const [rows] = await db.execute(query);
        return rows;
    }
    
    static async updateUser(id, data) {
        const { full_name, username, contact, address, route_id, authorized_person_name } = data;
        const [result] = await db.execute(
            'UPDATE users SET full_name = ?, username = ?, contact = ?, address = ?, route_id = ?, authorized_person_name = ? WHERE id = ?',
            [full_name, username, contact, address, route_id, authorized_person_name, id]
        );
        return result.affectedRows;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [id]);
        return result.affectedRows;
    }

    static async updateUserProfile(id, data) {
        const { full_name, address } = data;
        const [result] = await db.execute(
            'UPDATE users SET full_name = ?, address = ? WHERE id = ?',
            [full_name, address, id]
        );
        return result.affectedRows;
    }
}


module.exports = User;
