import express from 'express';
import { listNotifications, markAsRead, getUnreadCount, listAdminNotifications, markAllAsRead, createNotification, deleteNotification } from '../controllers/notificationController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// User endpoints
router.get('/', requireAuth, listNotifications);
router.get('/count', requireAuth, getUnreadCount);
router.get('/unread-count', requireAuth, getUnreadCount);
router.post('/:id/read', requireAuth, markAsRead);
router.patch('/:id/read', requireAuth, markAsRead);
router.post('/mark-all-read', requireAuth, markAllAsRead);
router.patch('/read-all', requireAuth, markAllAsRead);
router.delete('/:id', requireAuth, deleteNotification);

// Admin endpoints
router.get('/admin/all', requireAuth, requireAdmin, listAdminNotifications);
router.post('/create', requireAuth, createNotification);

export default router;
