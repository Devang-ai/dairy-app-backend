const Route = require('../models/routeModel');

exports.getRoutes = async (req, res) => {
    try {
        const routes = await Route.getAll();
        res.json(routes);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching routes' });
    }
};

exports.createRoute = async (req, res) => {
    try {
        const routeId = await Route.create(req.body);
        res.status(201).json({ message: 'Route created successfully', routeId });
    } catch (error) {
        console.error('[RouteController] Create Error:', error);
        res.status(500).json({ message: 'Error creating route', error: error.message });
    }
};

exports.updateRoute = async (req, res) => {
    try {
        await Route.update(req.params.id, req.body);
        res.json({ message: 'Route updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating route' });
    }
};

exports.deleteRoute = async (req, res) => {
    try {
        await Route.delete(req.params.id);
        res.json({ message: 'Route deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting route' });
    }
};
