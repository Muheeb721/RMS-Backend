import express from 'express';
import {
  createContact,
  listContacts,
  updateContact,
  deleteContact,
  createPropertyInquiry,
  listPropertyInquiries,
  updatePropertyInquiry,
  deletePropertyInquiry,
  batchPropertyInquiries,
} from '../controllers/contactController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', createContact);
router.get('/', requireAuth, listContacts);
router.put('/:id', requireAuth, updateContact);
router.delete('/:id', requireAuth, deleteContact);

router.post('/property-inquiries', requireAuth, createPropertyInquiry);
router.get('/property-inquiries', requireAuth, listPropertyInquiries);
router.post('/property-inquiries/batch', requireAuth, batchPropertyInquiries);
router.put('/property-inquiries/:id', requireAuth, updatePropertyInquiry);
router.delete('/property-inquiries/:id', requireAuth, deletePropertyInquiry);

export default router;
