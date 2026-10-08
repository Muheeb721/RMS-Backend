import express from 'express';
import { signup, login, me } from '../controllers/authController.js';
import {
  sendAdminPasswordResetOtp,
  verifyAdminPasswordResetOtp,
  resetAdminPassword,
} from '../controllers/adminPasswordResetController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', signup);
router.post('/signup', signup);
router.post('/login', login);
router.post('/admin/forgot-password', sendAdminPasswordResetOtp);
router.post('/admin/verify-otp', verifyAdminPasswordResetOtp);
router.post('/admin/reset-password', resetAdminPassword);
router.get('/me', requireAuth, me);

export default router;
