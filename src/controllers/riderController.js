const Rider = require('../models/riderModel');
const path = require('path');

exports.register = async (req, res) => {
    try {
        console.log('>>> [BACKEND] Registering new rider. Body:', req.body);
        
        const { 
            name, email, phone, city, 
            vehicleType, vehicleNumber, 
            bankDetails 
        } = req.body;

        // Check if phone or email is missing
        if (!phone || !name) {
            return res.status(400).json({ message: 'Name and Phone are required' });
        }

        // Check if rider already exists
        const existingRider = await Rider.findByPhone(phone);
        if (existingRider) {
            return res.status(400).json({ message: 'Rider with this phone already exists' });
        }

        // Extract uploaded files
        // Multer puts files in req.files when using upload.fields()
        const documents = req.files || {};
        
        const getFileUrl = (fieldName) => {
            if (documents[fieldName] && documents[fieldName][0]) {
                // Return the path that can be accessed via /uploads static route
                return `/uploads/${documents[fieldName][0].filename}`;
            }
            return null;
        };

        const riderData = {
            name,
            email,
            phone,
            city,
            vehicle_type: vehicleType,
            vehicle_number: vehicleNumber,
            aadhar_url: getFileUrl('aadhar'),
            license_url: getFileUrl('license'),
            pan_url: getFileUrl('pan'),
            rc_url: getFileUrl('rc'),
            account_number: req.body['bankDetails[accountNumber]'],
            ifsc: req.body['bankDetails[ifsc]'],
            bank_name: req.body['bankDetails[bankName]']
        };

        const riderId = await Rider.create(riderData);

        const newRider = await Rider.findById(riderId);

        res.status(201).json({
            message: 'Rider application submitted successfully',
            rider: newRider
        });

    } catch (error) {
        console.error('>>> [BACKEND] Rider Registration Error:', error);
        res.status(500).json({ message: 'Server error during rider registration', error: error.message });
    }
};

exports.getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const rider = await Rider.findById(id);
        if (!rider) {
            return res.status(404).json({ message: 'Rider not found' });
        }
        res.json(rider);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching profile' });
    }
};
