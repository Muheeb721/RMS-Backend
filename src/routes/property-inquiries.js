import express from 'express';
import {
  createPropertyInquiry,
  listPropertyInquiries,
  updatePropertyInquiry,
  deletePropertyInquiry,
  batchPropertyInquiries,
} from '../controllers/contactController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/', requireAuth, createPropertyInquiry);
router.get('/', requireAuth, listPropertyInquiries);
router.post('/batch', requireAuth, batchPropertyInquiries);
router.put('/:id', requireAuth, updatePropertyInquiry);
router.delete('/:id', requireAuth, deletePropertyInquiry);

export default router;
