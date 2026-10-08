import express from 'express';
import { createBooking, listMyBookings, listAllBookings, updateBooking, approveBooking, rejectBooking, deleteBooking } from '../controllers/bookingController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, createBooking);
router.get('/me', requireAuth, listMyBookings);
router.get('/', requireAuth, requireAdmin, listAllBookings);
router.put('/:id', requireAuth, requireAdmin, updateBooking);
router.post('/:id/approve', requireAuth, requireAdmin, approveBooking);
router.put('/:id/approve', requireAuth, requireAdmin, approveBooking);
router.post('/:id/reject', requireAuth, requireAdmin, rejectBooking);
router.put('/:id/reject', requireAuth, requireAdmin, rejectBooking);
router.delete('/:id', requireAuth, requireAdmin, deleteBooking);

export default router;
