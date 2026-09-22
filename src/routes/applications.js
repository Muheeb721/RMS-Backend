import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  createApplication,
  listUserApplications,
  listAllApplications,
  getApplicationById,
  acceptApplication,
  rejectApplication,
} from '../controllers/rentApplicationController.js';

const router = express.Router();

router.post('/', requireAuth, createApplication);
router.get('/me', requireAuth, listUserApplications);
router.get('/', requireAuth, requireAdmin, listAllApplications);
router.get('/:id', requireAuth, requireAdmin, getApplicationById);
router.put('/:id/accept', requireAuth, requireAdmin, acceptApplication);
router.put('/:id/reject', requireAuth, requireAdmin, rejectApplication);

export default router;
