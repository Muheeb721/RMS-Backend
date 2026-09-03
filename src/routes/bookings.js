import express from 'express';
import { createBooking, listMyBookings, listAllBookings, approveBooking, rejectBooking } from '../controllers/bookingController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, createBooking);
router.get('/me', requireAuth, listMyBookings);
router.get('/', requireAuth, requireAdmin, listAllBookings);
router.post('/:id/approve', requireAuth, requireAdmin, approveBooking);
router.post('/:id/reject', requireAuth, requireAdmin, rejectBooking);

export default router;
