const { Parser } = require('json2csv');

class CSVHelper {
    static generate(data, fields) {
        try {
            const parser = new Parser({ fields });
            const csv = parser.parse(data);
            return csv;
        } catch (err) {
            console.error('Error generating CSV:', err);
            throw err;
        }
    }
}

module.exports = CSVHelper;
