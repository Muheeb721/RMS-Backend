import express from 'express';
import { createRentRecord, listRentRecords, updateRentRecord } from '../controllers/rentController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, createRentRecord);
router.get('/', requireAuth, listRentRecords);
router.get('/all', requireAuth, requireAdmin, listRentRecords);
router.patch('/:id', requireAuth, requireAdmin, updateRentRecord);
router.put('/:id', requireAuth, requireAdmin, updateRentRecord);

export default router;
