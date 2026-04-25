const Order = require('../models/orderModel');
const CSVHelper = require('../utils/csvHelper');
// Deploy trigger: Unit Standardization Phase 2 (Formal UnitType)
const db = require('../config/db');
const ExcelJS = require('exceljs');

const MONTHS_NAME = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// HELPERS FOR GLOBAL UNIT SYSTEM
const extractBaseValue = (name) => {
    if (!name) return 0;
    const n = name.toLowerCase();
    const regex = /(\d+(?:\.\d+)?)\s*(gm|g|kg|k|l|ml|litre|litres)?/g;
    let total = 0;
    let match;
    while ((match = regex.exec(n)) !== null) {
        const val = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'kg' || unit === 'k' || unit === 'l' || unit === 'litre' || unit === 'litres') {
            total += val * 1000;
        } else {
            total += val;
        }
    }
    return total;
};

const formatUnitDisplay = (value, unitType = 'weight') => {
    const val = parseFloat(value) || 0;
    if (unitType === 'volume') {
        if (val >= 1000) return (val / 1000).toFixed(2).replace(/\.00$/, '') + ' L';
        return Math.round(val) + ' ml';
    } else {
        if (val >= 1000) return (val / 1000).toFixed(2).replace(/\.00$/, '') + ' kg';
        return Math.round(val) + ' gm';
    }
};

exports.exportRouteWise = async (req, res) => {
    try {
        const { route_id, date } = req.query;
        if (!date) return res.status(400).json({ message: 'Date is required' });

        const [rows] = await db.execute(`
            SELECT 
                o.id AS OrderID,
                u.full_name AS CustomerName,
                r.name AS Route,
                u.address AS Address,
                DATE_FORMAT(o.delivery_date, '%d-%b-%Y') AS DeliveryDate,
                p.name AS Product,
                p.unit_type,
                oi.quantity AS qty_raw
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN routes r ON o.route_id = r.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            WHERE o.business_date = ?
            ${route_id && route_id !== 'all' ? ' AND o.route_id = ?' : ''}
            ORDER BY r.name, u.full_name, o.id
        `, route_id && route_id !== 'all' ? [date, route_id] : [date]);

        const csvRows = [];
        let lastOrderId = null;
        for (const row of rows) {
            const isFirst = row.OrderID !== lastOrderId;
            lastOrderId = row.OrderID;
            csvRows.push({
                OrderID:      isFirst ? row.OrderID      : '',
                CustomerName: isFirst ? row.CustomerName : '',
                Route:        isFirst ? row.Route        : '',
                Address:      isFirst ? row.Address      : '',
                DeliveryDate: isFirst ? row.DeliveryDate : '',
                Product:      row.Product,
                Quantity:     formatUnitDisplay(row.qty_raw, row.unit_type),
            });
        }

        const fields = ['OrderID', 'CustomerName', 'Route', 'Address', 'DeliveryDate', 'Product', 'Quantity'];
        const csv = CSVHelper.generate(csvRows, fields);
        res.header('Content-Type', 'text/csv');
        res.attachment(`delivery_${route_id || 'all'}_${date}.csv`);
        return res.send(csv);
    } catch (error) {
        res.status(500).json({ message: 'Error exporting CSV', error: error.message });
    }
};

exports.exportRouteXLSX = async (req, res) => {
    try {
        const { route_id, date } = req.query;
        if (!date) return res.status(400).json({ message: 'Date is required' });

        const [rows] = await db.execute(`
            SELECT 
                o.id AS OrderID,
                u.full_name AS CustomerName,
                r.name AS Route,
                u.address AS Address,
                DATE_FORMAT(o.delivery_date, '%d-%b-%Y') AS DeliveryDate,
                p.name AS Product,
                p.unit_type,
                pv.variant_name,
                oi.packet_count, oi.packet_size,
                oi.quantity AS qty_raw
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN routes r ON o.route_id = r.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE o.business_date = ?
            ${route_id && route_id !== 'all' ? ' AND o.route_id = ?' : ''}
            ORDER BY r.name, u.full_name, o.id
        `, route_id && route_id !== 'all' ? [date, route_id] : [date]);

        const ordersMap = new Map();
        for (const row of rows) {
            if (!ordersMap.has(row.OrderID)) {
                ordersMap.set(row.OrderID, {
                    OrderID: row.OrderID, CustomerName: row.CustomerName, Route: row.Route,
                    Address: row.Address, DeliveryDate: row.DeliveryDate, items: []
                });
            }
            
            let size = parseFloat(row.packet_size || 0) || 0;
            let total = parseFloat(row.qty_raw || 0) || 0;
            
            // Stabilization: If stored in KG/L (legacy), normalize to Grams/ML
            if (size > 0 && size < 50) size = size * 1000;
            if (total > 0 && total < 50) total = total * 1000;

            if (size === 0) size = extractBaseValue(row.variant_name || row.Product);

            let count = parseInt(row.packet_count || 0);
            if (count <= 0 && size > 0) count = Math.round(total / size);

            ordersMap.get(row.OrderID).items.push({
                Product:  `${row.Product}${row.variant_name ? ' (' + row.variant_name + ')' : ''}`,
                Unit:     formatUnitDisplay(size, row.unit_type),
                Quantity: count || 1,
                Total:    formatUnitDisplay(total, row.unit_type)
            });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Delivery Report');
        
        // Define Columns properly with headers
        worksheet.columns = [
            { header: 'Order ID', key: 'OrderID', width: 12 }, 
            { header: 'Customer Name', key: 'CustomerName', width: 25 }, 
            { header: 'Route', key: 'Route', width: 20 },
            { header: 'Address', key: 'Address', width: 35 }, 
            { header: 'Delivery Date', key: 'DeliveryDate', width: 18 }, 
            { header: 'Product', key: 'Product', width: 35 },
            { header: 'Unit Size', key: 'Unit', width: 15 }, 
            { header: 'Packet Qty', key: 'Quantity', width: 18 }, 
            { header: 'Total Weight/Vol', key: 'Total', width: 22 }
        ];

        // Style the first row (headers)
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30; // Extra height for headers
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5276' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left:   { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right:  { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        });

        // Set widths explicitly again to be absolutely sure
        [1,2,3,4,5,6,7,8,9].forEach(colIdx => {
            const col = worksheet.getColumn(colIdx);
            if (colIdx === 6) col.width = 40; // Product
            else if (colIdx === 8) col.width = 20; // Qty
            else if (colIdx === 9) col.width = 25; // Total
        });

        for (const order of ordersMap.values()) {
            const startRow = worksheet.rowCount + 1;
            order.items.forEach(item => {
                const rowData = [
                    order.OrderID, order.CustomerName, order.Route, order.Address, order.DeliveryDate,
                    item.Product, item.Unit, item.Quantity, item.Total
                ];
                const row = worksheet.addRow(rowData);
                row.eachCell({ includeEmpty: true }, (cell, col) => {
                    cell.alignment = { vertical: 'middle', horizontal: col <= 5 ? 'center' : 'left', wrapText: true };
                });
            });
            const endRow = worksheet.rowCount;
            if (order.items.length > 1) {
                [1,2,3,4,5].forEach(col => worksheet.mergeCells(startRow, col, endRow, col));
            }
            exports.applyGroupBorders(worksheet, startRow, endRow, 9, 'FF1A5276');
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="delivery_${date}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: 'Excel Error', error: error.message });
    }
};

exports.exportMonthlyXLSX = async (req, res) => {
    try {
        const { year, month } = req.query;
        const pad = String(month).padStart(2, '0');
        const startDate = `${year}-${pad}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${pad}-${lastDay}`;

        const [rows] = await db.execute(`
            SELECT 
                u.id AS UserID, u.full_name AS CustomerName, r.name AS Route,
                o.id AS OrderID, DATE_FORMAT(o.delivery_date, '%d-%b-%Y') AS DeliveryDate,
                p.name AS Product, p.unit_type, pv.variant_name,
                oi.packet_count, oi.packet_size, oi.quantity AS qty_raw
            FROM users u
            JOIN orders o ON o.user_id = u.id
            LEFT JOIN routes r ON u.route_id = r.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE DATE(o.delivery_date) BETWEEN ? AND ?
            ORDER BY r.name, u.full_name, o.delivery_date, o.id
        `, [startDate, endDate]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Monthly Report');

        // Wide columns with headers defined in-place for reliable widths
        worksheet.columns = [
            { header: 'User ID',          key: 'UserID',       width: 12 },
            { header: 'Customer Name',     key: 'CustomerName', width: 28 },
            { header: 'Route',             key: 'Route',        width: 20 },
            { header: 'Order ID',          key: 'OrderID',      width: 12 },
            { header: 'Date',              key: 'Date',         width: 18 },
            { header: 'Product',           key: 'Product',      width: 40 },
            { header: 'Unit Size',         key: 'Unit',         width: 18 },
            { header: 'Packet Qty',        key: 'Quantity',     width: 18 },
            { header: 'Total Weight/Vol',  key: 'Total',        width: 25 },
        ];

        // Style header row (row 1 auto-created by ExcelJS from column headers)
        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell(cell => {
            cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5E55' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left:   { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right:  { style: 'thin', color: { argb: 'FFFFFFFF' } },
            };
        });

        let curUser = null, userStart = 0, curOrder = null, orderStart = 0;

        rows.forEach((row, i) => {
            const isNewUser  = row.UserID  !== curUser;
            const isNewOrder = row.OrderID !== curOrder;
            const rowIdx = worksheet.rowCount + 1;

            if (isNewUser) {
                if (curUser !== null) {
                    const end = worksheet.rowCount;
                    if (end > userStart) [1,2,3].forEach(c => worksheet.mergeCells(userStart, c, end, c));
                }
                curUser = row.UserID; userStart = rowIdx;
            }

            if (isNewOrder) {
                if (curOrder !== null) {
                    const end = worksheet.rowCount;
                    if (end > orderStart) [4,5].forEach(c => worksheet.mergeCells(orderStart, c, end, c));
                    exports.applyGroupBorders(worksheet, orderStart, end, 9, 'FF2D5E55');
                }
                curOrder = row.OrderID; orderStart = rowIdx;
            }

            // SCALING FIX: normalize both size and total (same logic as Route export)
            let size  = parseFloat(row.packet_size || 0) || 0;
            let total = parseFloat(row.qty_raw     || 0) || 0;
            if (size  > 0 && size  < 50) size  = size  * 1000;
            if (total > 0 && total < 50) total = total * 1000;
            if (size === 0) size = extractBaseValue(row.variant_name || row.Product);

            let count = parseInt(row.packet_count || 0);
            if (count <= 0 && size > 0) count = Math.round(total / size);
            if (count <= 0) count = 1;

            const excelRow = worksheet.addRow([
                row.UserID,
                row.CustomerName,
                row.Route || 'N/A',
                row.OrderID,
                row.DeliveryDate,
                `${row.Product}${row.variant_name ? ' (' + row.variant_name + ')' : ''}`,
                formatUnitDisplay(size,  row.unit_type),
                count,
                formatUnitDisplay(total, row.unit_type),
            ]);
            excelRow.eachCell({ includeEmpty: true }, cell => {
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top:    { style: 'thin' },
                    bottom: { style: 'thin' },
                    left:   { style: 'thin' },
                    right:  { style: 'thin' },
                };
            });

            if (i === rows.length - 1) {
                const end = worksheet.rowCount;
                if (end > userStart)  [1,2,3].forEach(c => worksheet.mergeCells(userStart,  c, end, c));
                if (end > orderStart) [4,5].forEach(c   => worksheet.mergeCells(orderStart, c, end, c));
                exports.applyGroupBorders(worksheet, orderStart, end, 9, 'FF2D5E55');
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Monthly_${month}_${year}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: 'Monthly Excel Error', error: error.message });
    }
};

exports.applyGroupBorders = (worksheet, startRow, endRow, totalCols, color) => {
    for (let r = startRow; r <= endRow; r++) {
        for (let c = 1; c <= totalCols; c++) {
            const cell = worksheet.getCell(r, c);
            cell.border = {
                top: { style: r === startRow ? 'medium' : 'thin', color: { argb: color } },
                bottom: { style: r === endRow ? 'medium' : 'thin', color: { argb: color } },
                left: { style: c === 1 ? 'medium' : 'thin', color: { argb: color } },
                right: { style: c === totalCols ? 'medium' : 'thin', color: { argb: color } },
            };
        }
    }
};

exports.getStats = async (req, res) => {
    try {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(new Date().getTime() + istOffset);
        const businessDate = new Date(nowIST);
        if (nowIST.getUTCHours() < 2) businessDate.setUTCDate(nowIST.getUTCDate() - 1);
        const bizDateStr = businessDate.toISOString().split('T')[0];
        
        const [ordersResult] = await db.execute('SELECT COUNT(*) as count FROM orders');
        const [usersResult] = await db.execute('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        const [todayOrders] = await db.execute('SELECT COUNT(*) as count FROM orders WHERE business_date = ?', [bizDateStr]);
        
        const [routeStats] = await db.execute(`
            SELECT r.id, r.name, COUNT(o.id) as count 
            FROM routes r 
            LEFT JOIN orders o ON r.id = o.route_id AND o.business_date = ?
            GROUP BY r.id, r.name
        `, [bizDateStr]);

        res.json({
            totalOrders: ordersResult[0].count,
            totalUsers: usersResult[0].count,
            todayOrders: todayOrders[0].count,
            routeStats,
            businessDate: bizDateStr
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const [users] = await db.execute('SELECT u.*, r.name as route_name FROM users u LEFT JOIN routes r ON u.route_id = r.id');
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching users' });
    }
};

const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');

exports.testConnection = async (req, res) => {
    res.json({ message: 'Admin API is working correctly', timestamp: new Date() });
};

exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { full_name, role, route_id, contact, address, authorized_person_name } = req.body;
        await db.execute(
            'UPDATE users SET full_name = ?, role = ?, route_id = ?, contact = ?, address = ?, authorized_person_name = ? WHERE id = ?',
            [full_name, role, route_id, contact, address, authorized_person_name, id]
        );
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute('DELETE FROM users WHERE id = ?', [id]);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const bcrypt = require('bcryptjs');
exports.resetUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        if (!password) return res.status(400).json({ message: 'Password is required' });
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.exportUserMonthly = async (req, res) => {
    try {
        const { user_id, year, month } = req.query;
        if (!user_id || !year || !month) return res.status(400).json({ message: 'Missing parameters' });
        
        const pad = String(month).padStart(2, '0');
        const startDate = `${year}-${pad}-01`;
        const endDate = `${year}-${pad}-${new Date(year, month, 0).getDate()}`;

        const [rows] = await db.execute(`
            SELECT 
                u.full_name AS CustomerName,
                o.id AS OrderID, DATE_FORMAT(o.delivery_date, '%d-%b-%Y') AS DeliveryDate,
                p.name AS Product, p.unit_type, pv.variant_name,
                oi.packet_count, oi.packet_size, oi.quantity AS qty_raw
            FROM orders o
            JOIN users u ON o.user_id = u.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE o.user_id = ? AND DATE(o.delivery_date) BETWEEN ? AND ?
            ORDER BY o.delivery_date, o.id
        `, [user_id, startDate, endDate]);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('User Monthly Report');
        const CustomerName = rows[0]?.CustomerName || 'User';

        worksheet.columns = [
            { header: 'Order ID', key: 'OrderID', width: 12 },
            { header: 'Delivery Date', key: 'Date', width: 18 },
            { header: 'Product', key: 'Product', width: 25 },
            { header: 'Unit Size', key: 'Unit', width: 15 },
            { header: 'Quantity', key: 'Qty', width: 12 },
            { header: 'Total Weight/Vol', key: 'Total', width: 18 }
        ];

        rows.forEach(row => {
            let size = parseFloat(row.packet_size || 0) || 0;
            const total = parseFloat(row.qty_raw || 0) || 0;
            if (size === 0) size = extractBaseValue(row.variant_name || row.Product);
            if (size > 0 && size < 50) size = size * 1000;

            worksheet.addRow({
                OrderID: row.OrderID,
                Date: row.DeliveryDate,
                Product: `${row.Product}${row.variant_name ? ' (' + row.variant_name + ')' : ''}`,
                Unit: formatUnitDisplay(size, row.unit_type),
                Qty: row.packet_count || 1,
                Total: formatUnitDisplay(total, row.unit_type)
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Monthly_${CustomerName}_${month}_${year}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};exports.uploadImage = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file' });
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream((err, res) => res ? resolve(res) : reject(err));
            streamifier.createReadStream(req.file.buffer).pipe(stream);
        });
        res.json({ imageUrl: result.secure_url });
    } catch (error) {
        res.status(500).json({ message: 'Upload error' });
    }
};
