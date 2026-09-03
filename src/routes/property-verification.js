import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listVerifications, saveVerifications, setVerified, getVerification } from '../controllers/propertyVerificationController.js';

const router = express.Router();

// list all verifications (admin/private)
router.get('/', requireAuth, listVerifications);

// bulk save verifications
router.post('/', requireAuth, saveVerifications);

// set verification for a property
router.post('/:propertyId', requireAuth, setVerified);

// get verification for a property
router.get('/:propertyId', getVerification);

export default router;
