const db = require('../config/db');

class Route {
    static async getAll() {
        const [rows] = await db.execute('SELECT * FROM routes ORDER BY name ASC');
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.execute('SELECT * FROM routes WHERE id = ?', [id]);
        return rows[0];
    }

    static async create(routeData) {
        const { name, description } = routeData;
        try {
            // Using query instead of execute for broader compatibility
            const [result] = await db.query(
                'INSERT INTO routes (name, description) VALUES (?, ?)',
                [name, description]
            );
            return result.insertId;
        } catch (error) {
            console.error('[RouteModel] Create SQL Error:', error);
            throw error;
        }
    }

    static async update(id, routeData) {
        const { name, description } = routeData;
        await db.execute(
            'UPDATE routes SET name = ?, description = ? WHERE id = ?',
            [name, description, id]
        );
    }

    static async delete(id) {
        await db.execute('DELETE FROM routes WHERE id = ?', [id]);
    }
}

module.exports = Route;
