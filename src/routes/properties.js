import express from 'express';
import { listProperties, getProperty, createProperty, updateProperty, deleteProperty, updatePropertyStatus, updatePropertyPrice, recommendProperties } from '../controllers/propertyController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public
router.get('/', listProperties);
router.get('/:id', getProperty);

// Admin protected routes for managing properties
router.post('/', requireAuth, requireAdmin, createProperty);
router.put('/:id', requireAuth, requireAdmin, updateProperty);
router.delete('/:id', requireAuth, requireAdmin, deleteProperty);
router.post('/:id/status', requireAuth, requireAdmin, updatePropertyStatus);
router.post('/:id/price', requireAuth, requireAdmin, updatePropertyPrice);

// Recommendation endpoint (accepts preferences in body)
router.post('/recommend', recommendProperties);

export default router;
