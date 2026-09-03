import express from 'express';
import { createPayment, listMyPayments, listAllPayments, updatePaymentStatus, updatePayment, deletePayment } from '../controllers/paymentController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, createPayment);
router.get('/me', requireAuth, listMyPayments);
router.get('/', requireAuth, requireAdmin, listAllPayments);
router.patch('/:id/status', requireAuth, requireAdmin, updatePaymentStatus);
router.put('/:id/status', requireAuth, requireAdmin, updatePaymentStatus);
router.post('/:id/status', requireAuth, requireAdmin, updatePaymentStatus);
router.put('/:id', requireAuth, requireAdmin, updatePayment);
router.delete('/:id', requireAuth, requireAdmin, deletePayment);

export default router;
