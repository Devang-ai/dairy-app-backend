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
        
        // Define Columns with exact widths and keys (without headers so we can set them manually at Row 4)
        worksheet.columns = [
            { key: 'OrderID', width: 12 }, 
            { key: 'CustomerName', width: 25 }, 
            { key: 'DeliveryDate', width: 18 }, 
            { key: 'Product', width: 40 },
            { key: 'Unit', width: 15 }, 
            { key: 'Quantity', width: 20 }, 
            { key: 'Total', width: 25 }
        ];

        // 1. Get Route Name for the Heading
        let routeName = 'All Routes';
        if (route_id && route_id !== 'all') {
            const firstRow = rows[0];
            routeName = firstRow?.Route || 'Specified Route';
        }

        // 2. Add Row 1: Title Header Row (Centered and Styled Navy Blue)
        const titleRow = worksheet.addRow([`DELIVERY REPORT - ${routeName.toUpperCase()}`]);
        titleRow.height = 40;
        worksheet.mergeCells(1, 1, 1, 7);
        const titleCell = worksheet.getCell(1, 1);
        titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 16, name: 'Calibri' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // 3. Add Row 2: Metadata Subtitle Row (Date & Statistics)
        const subtitleRow = worksheet.addRow([`Delivery Date: ${date}   |   Total Orders: ${ordersMap.size}`]);
        subtitleRow.height = 25;
        worksheet.mergeCells(2, 1, 2, 7);
        const subtitleCell = worksheet.getCell(2, 1);
        subtitleCell.font = { bold: true, color: { argb: 'FF374151' }, size: 11, name: 'Calibri' };
        subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        subtitleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        // 4. Add Row 3: Empty Spacer Row
        const spacerRow = worksheet.addRow([]);
        spacerRow.height = 15;

        // 5. Add Row 4: Main Table Headers
        const headers = ['Order ID', 'Customer Name', 'Delivery Date', 'Product', 'Unit Size', 'Packet Qty', 'Total Weight/Vol'];
        const headerRow = worksheet.addRow(headers);
        headerRow.height = 30;
        headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left:   { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right:  { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        });

        const USER_COLORS = ['FFFFFFFF', 'FFE0E0E0']; // White and Medium Grey for B&W Xerox
        let colorIndex = -1;
        let lastCustomerName = null;

        for (const order of ordersMap.values()) {
            let isNewUser = false;
            if (lastCustomerName !== order.CustomerName) {
                colorIndex = (colorIndex + 1) % USER_COLORS.length;
                lastCustomerName = order.CustomerName;
                isNewUser = true;
            }
            const bgColor = USER_COLORS[colorIndex];
            
            const startRow = worksheet.rowCount + 1;

            order.items.forEach((item, idx) => {
                const rowData = [
                    idx === 0 ? order.OrderID : '', 
                    idx === 0 ? order.CustomerName : '', 
                    idx === 0 ? order.DeliveryDate : '',
                    item.Product, item.Unit, item.Quantity, item.Total
                ];
                
                const row = worksheet.addRow(rowData);

                row.eachCell({ includeEmpty: true }, (cell, col) => {
                    cell.alignment = { vertical: 'middle', horizontal: col <= 3 ? 'center' : 'left', wrapText: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                });
            });
            
            const endRow = worksheet.rowCount;
            if (order.items.length > 1) {
                [1,2,3].forEach(col => worksheet.mergeCells(startRow, col, endRow, col));
            }

            // Apply borders AFTER merge to guarantee they aren't hidden by ExcelJS
            for (let r = startRow; r <= endRow; r++) {
                for (let c = 1; c <= 7; c++) {
                    const cell = worksheet.getCell(r, c);
                    cell.border = {
                        left:   { style: 'thin', color: { argb: 'FF9E9E9E' } },
                        right:  { style: 'thin', color: { argb: 'FF9E9E9E' } },
                        bottom: (r === endRow) ? { style: 'medium', color: { argb: 'FF000000' } } : { style: 'thin', color: { argb: 'FF9E9E9E' } },
                        top: (r === startRow && isNewUser) ? { style: 'medium', color: { argb: 'FF000000' } } : { style: 'thin', color: { argb: 'FF9E9E9E' } }
                    };
                }
            }
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
        const { year, month, route_id } = req.query;
        const pad = String(month).padStart(2, '0');
        const startDate = `${year}-${pad}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${pad}-${lastDay}`;

        // Build route filter
        const cleanRoute = (route_id === 'null' || route_id === 'all' || !route_id) ? null : route_id;
        const routeFilter = cleanRoute ? 'AND u.route_id = ?' : '';
        const params = cleanRoute ? [startDate, endDate, cleanRoute] : [startDate, endDate];

        const [rows] = await db.execute(`
            SELECT 
                u.id AS UserID, u.full_name AS CustomerName, r.name AS Route,
                o.id AS OrderID, DATE_FORMAT(o.delivery_date, '%d-%b-%Y') AS DeliveryDate,
                p.name AS Product, p.unit_type, pv.variant_name,
                oi.packet_count, oi.packet_size, oi.quantity AS qty_raw
            FROM users u
            JOIN orders o ON o.user_id = u.id
            LEFT JOIN routes r ON o.route_id = r.id
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE DATE(o.delivery_date) BETWEEN ? AND ? ${routeFilter}
            ORDER BY r.name, u.full_name, o.delivery_date, o.id
        `, params);

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

        const USER_COLORS = ['FFFFFFFF', 'FFE0E0E0']; // White and Medium Grey for B&W Xerox
        let colorIndex = -1;
        let curUser = null;
        let curOrder = null;
        let userStart = 0;
        let orderStart = 0;

        rows.forEach((row, i) => {
            const isNewUser  = row.UserID  !== curUser;
            const isNewOrder = row.OrderID !== curOrder;
            const rowIdx = worksheet.rowCount + 1;

            if (isNewUser) {
                if (curUser !== null) {
                    const end = worksheet.rowCount;
                    if (end > userStart) [1,2,3].forEach(c => worksheet.mergeCells(userStart, c, end, c));
                }
                colorIndex = (colorIndex + 1) % USER_COLORS.length;
                curUser = row.UserID;
                userStart = rowIdx;
            }
            if (isNewOrder) {
                if (curOrder !== null) {
                    const end = worksheet.rowCount;
                    if (end > orderStart) [4,5].forEach(c => worksheet.mergeCells(orderStart, c, end, c));
                    
                    // Explicitly set thick bottom border for the previous order's last row after merges
                    for (let c = 1; c <= 9; c++) {
                        const cell = worksheet.getCell(end, c);
                        cell.border = { ...(cell.border || {}), bottom: { style: 'medium', color: { argb: 'FF000000' } } };
                    }
                }
                curOrder = row.OrderID;
                orderStart = rowIdx;
            }
            
            const bgColor = USER_COLORS[colorIndex];

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
                isNewUser ? row.UserID : '',
                isNewUser ? row.CustomerName : '',
                isNewUser ? (row.Route || 'N/A') : '',
                isNewOrder ? row.OrderID : '',
                isNewOrder ? row.DeliveryDate : '',
                `${row.Product}${row.variant_name ? ' (' + row.variant_name + ')' : ''}`,
                formatUnitDisplay(size,  row.unit_type),
                count,
                formatUnitDisplay(total, row.unit_type),
            ]);

            const applyThickTop = (isNewUser);

            excelRow.eachCell({ includeEmpty: true }, (cell, col) => {
                cell.alignment = { vertical: 'middle', horizontal: col <= 5 ? 'center' : 'left', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                
                cell.border = {
                    left:   { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    right:  { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    top: applyThickTop ? { style: 'medium', color: { argb: 'FF000000' } } : { style: 'thin', color: { argb: 'FF9E9E9E' } }
                };
            });

            // If it's the last row overall, handle the final merges and borders
            if (i === rows.length - 1) {
                const end = worksheet.rowCount;
                if (end > userStart)  [1,2,3].forEach(c => worksheet.mergeCells(userStart, c, end, c));
                if (end > orderStart) [4,5].forEach(c => worksheet.mergeCells(orderStart, c, end, c));
                
                // Explicitly set the thick bottom border for the very last row after merges
                for (let c = 1; c <= 9; c++) {
                    const cell = worksheet.getCell(end, c);
                    cell.border = { ...(cell.border || {}), bottom: { style: 'medium', color: { argb: 'FF000000' } } };
                }
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

exports.exportProductSalesXLSX = async (req, res) => {
    try {
        const { year, month, route_id } = req.query;
        if (!year || !month) return res.status(400).json({ message: 'Year and month required' });
        
        const pad = String(month).padStart(2, '0');
        const startDate = `${year}-${pad}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${pad}-${lastDay}`;

        const cleanRoute = (route_id === 'null' || route_id === 'all' || !route_id) ? null : route_id;
        const routeFilter = cleanRoute ? 'AND o.route_id = ?' : '';
        const params = cleanRoute ? [startDate, endDate, cleanRoute] : [startDate, endDate];

        const [rows] = await db.execute(`
            SELECT 
                p.name AS Product, p.unit_type, pv.variant_name,
                oi.packet_count, oi.packet_size, oi.quantity AS qty_raw
            FROM orders o
            JOIN order_items oi ON o.id = oi.order_id
            JOIN products p ON oi.product_id = p.id
            LEFT JOIN product_variants pv ON oi.variant_id = pv.id
            WHERE DATE(o.delivery_date) BETWEEN ? AND ? ${routeFilter}
        `, params);

        const salesMap = new Map();

        rows.forEach(row => {
            let size = parseFloat(row.packet_size || 0) || 0;
            let total = parseFloat(row.qty_raw || 0) || 0;
            if (size > 0 && size < 50) size = size * 1000;
            if (total > 0 && total < 50) total = total * 1000;
            if (size === 0) size = extractBaseValue(row.variant_name || row.Product);

            let count = parseInt(row.packet_count || 0);
            if (count <= 0 && size > 0) count = Math.round(total / size);
            if (count <= 0) count = 1;

            const productName = `${row.Product}${row.variant_name ? ' (' + row.variant_name + ')' : ''}`;
            const unitType = row.unit_type;
            const unitSizeStr = formatUnitDisplay(size, unitType);
            const key = `${productName}|${unitSizeStr}`;

            if (!salesMap.has(key)) {
                salesMap.set(key, { product: productName, unitSizeStr, unitType, totalPackets: 0, totalWeightVol: 0 });
            }
            const data = salesMap.get(key);
            data.totalPackets += count;
            data.totalWeightVol += total;
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Product Sales Summary');

        worksheet.columns = [
            { header: 'Product', key: 'Product', width: 35 },
            { header: 'Unit Size', key: 'Unit', width: 15 },
            { header: 'Total Packets', key: 'Packets', width: 18 },
            { header: 'Total Weight/Vol', key: 'Total', width: 22 }
        ];

        const headerRow = worksheet.getRow(1);
        headerRow.height = 30;
        headerRow.eachCell(cell => {
            cell.font  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D5E55' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
            };
        });

        let rowIndex = 2;
        const sortedSales = Array.from(salesMap.values()).sort((a, b) => a.product.localeCompare(b.product));

        sortedSales.forEach((data, index) => {
            const isEven = index % 2 === 0;
            const bgColor = isEven ? 'FFFFFFFF' : 'FFE0E0E0';

            const row = worksheet.addRow({
                Product: data.product,
                Unit: data.unitSizeStr,
                Packets: data.totalPackets,
                Total: formatUnitDisplay(data.totalWeightVol, data.unitType)
            });

            row.eachCell({ includeEmpty: true }, (cell, col) => {
                cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                cell.border = {
                    left: { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    right: { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    top: { style: 'thin', color: { argb: 'FF9E9E9E' } }
                };
            });
            rowIndex++;
        });

        const routeName = cleanRoute ? `Route_${cleanRoute}` : 'All_Routes';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="ProductSales_${routeName}_${month}_${year}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: 'Product Sales Excel Error', error: error.message });
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
        
        // Don't overwrite role if not provided
        const [currentUser] = await db.execute('SELECT role FROM users WHERE id = ?', [id]);
        const targetRole = role || (currentUser[0] ? currentUser[0].role : 'user');

        await db.execute(
            'UPDATE users SET full_name = ?, role = ?, route_id = ?, contact = ?, address = ?, authorized_person_name = ? WHERE id = ?',
            [full_name, targetRole, route_id, contact, address, authorized_person_name, id]
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
        const { password, newPassword } = req.body;
        const finalPassword = password || newPassword;
        if (!finalPassword) return res.status(400).json({ message: 'Password is required' });
        const hashedPassword = await bcrypt.hash(finalPassword, 10);
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
            { header: 'Product', key: 'Product', width: 35 },
            { header: 'Unit Size', key: 'Unit', width: 15 },
            { header: 'Quantity', key: 'Qty', width: 12 },
            { header: 'Total Weight/Vol', key: 'Total', width: 22 }
        ];

        // Style header row
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

        const USER_COLORS = ['FFFFFFFF', 'FFE0E0E0']; // White and Medium Grey for B&W Xerox
        let colorIndex = -1;
        let curOrder = null;
        let orderStart = 0;

        rows.forEach((row, i) => {
            const isNewOrder = row.OrderID !== curOrder;
            const rowIdx = worksheet.rowCount + 1;

            if (isNewOrder) {
                if (curOrder !== null) {
                    const end = worksheet.rowCount;
                    if (end > orderStart) [1,2].forEach(c => worksheet.mergeCells(orderStart, c, end, c));
                    
                    // Explicitly set thick bottom border for the previous order's last row after merges
                    for (let c = 1; c <= 6; c++) {
                        const cell = worksheet.getCell(end, c);
                        cell.border = { ...(cell.border || {}), bottom: { style: 'medium', color: { argb: 'FF000000' } } };
                    }
                }
                colorIndex = (colorIndex + 1) % USER_COLORS.length;
                curOrder = row.OrderID;
                orderStart = rowIdx;
            }
            
            const bgColor = USER_COLORS[colorIndex];

            let size = parseFloat(row.packet_size || 0) || 0;
            let total = parseFloat(row.qty_raw || 0) || 0;
            if (size > 0 && size < 50) size = size * 1000;
            if (total > 0 && total < 50) total = total * 1000;
            if (size === 0) size = extractBaseValue(row.variant_name || row.Product);

            let count = parseInt(row.packet_count || 0);
            if (count <= 0 && size > 0) count = Math.round(total / size);
            if (count <= 0) count = 1;

            const excelRow = worksheet.addRow([
                isNewOrder ? row.OrderID : '',
                isNewOrder ? row.DeliveryDate : '',
                `${row.Product}${row.variant_name ? ' (' + row.variant_name + ')' : ''}`,
                formatUnitDisplay(size, row.unit_type),
                count,
                formatUnitDisplay(total, row.unit_type)
            ]);

            const applyThickTop = (isNewOrder);

            excelRow.eachCell({ includeEmpty: true }, (cell, col) => {
                cell.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'center' : 'left', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                
                cell.border = {
                    left:   { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    right:  { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    bottom: { style: 'thin', color: { argb: 'FF9E9E9E' } },
                    top: applyThickTop ? { style: 'medium', color: { argb: 'FF000000' } } : { style: 'thin', color: { argb: 'FF9E9E9E' } }
                };
            });

            if (i === rows.length - 1) {
                const end = worksheet.rowCount;
                if (end > orderStart) [1,2].forEach(c => worksheet.mergeCells(orderStart, c, end, c));
                for (let c = 1; c <= 6; c++) {
                    const cell = worksheet.getCell(end, c);
                    cell.border = { ...(cell.border || {}), bottom: { style: 'medium', color: { argb: 'FF000000' } } };
                }
            }
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Monthly_${CustomerName}_${month}_${year}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.uploadImage = async (req, res) => {
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
