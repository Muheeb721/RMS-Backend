import express from 'express';
import { getAdminAnalytics, getAdminDashboard, getAdminUsers, createAdminUser, updateAdminUser, archiveAdminUser } from '../controllers/adminController.js';
import { createProperty, deleteProperty, getProperty, listProperties, updateProperty } from '../controllers/propertyController.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', requireAuth, requireAdmin, getAdminDashboard);
router.get('/analytics', requireAuth, requireAdmin, getAdminAnalytics);
router.get('/users', requireAuth, requireAdmin, getAdminUsers);
router.post('/users', requireAuth, requireAdmin, createAdminUser);
router.put('/users/:id', requireAuth, requireAdmin, updateAdminUser);
router.delete('/users/:id', requireAuth, requireAdmin, archiveAdminUser);
router.get('/properties', requireAuth, requireAdmin, listProperties);
router.get('/properties/:id', requireAuth, requireAdmin, getProperty);
router.post('/properties', requireAuth, requireAdmin, createProperty);
router.put('/properties/:id', requireAuth, requireAdmin, updateProperty);
router.delete('/properties/:id', requireAuth, requireAdmin, deleteProperty);

export default router;
