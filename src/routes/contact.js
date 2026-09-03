import express from 'express';
import { createContact, listContacts, updateContact, deleteContact } from '../controllers/contactController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', createContact);
router.get('/', requireAuth, listContacts);
router.put('/:id', requireAuth, updateContact);
router.delete('/:id', requireAuth, deleteContact);

export default router;
