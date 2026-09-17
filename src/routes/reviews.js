import express from 'express';
import { listReviews, createReview, deleteReview } from '../controllers/reviewsController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listReviews);
router.post('/', requireAuth, createReview);
router.delete('/:id', requireAuth, requireAdmin, deleteReview);

export default router;
