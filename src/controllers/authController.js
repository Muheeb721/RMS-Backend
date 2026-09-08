import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logAdminAction } from '../services/activityService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export const signup = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const normalizedEmail = String(email || '').trim().toLowerCase();
    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) return res.status(400).json({ success: false, message: 'Invalid email address.' });

    // normalizedEmail defined above
    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use.' });

    const passwordHash = await bcrypt.hash(String(password), 10);
    const userRole = String(role || 'resident').toLowerCase();
    const user = await User.create({
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      passwordHash,
      phone: phone || '',
      role: ['admin','owner','resident'].includes(userRole) ? userRole : 'resident',
      profile: {
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        phone: phone || '',
        address: '',
        description: '',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const token = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    // Notify admin of new signup (non-blocking)
    try {
      await logAdminAction({
        adminId: 'system',
        adminName: 'System',
        userId: user._id.toString(),
        userName: user.name,
        actionType: 'USER_SIGNUP',
        entityType: 'USER',
        entityId: user._id.toString(),
        message: `${user.name} has created a new account.`,
        description: `User signup: ${user.email}`,
      });
    } catch (e) {
      console.warn('Signup notification failed:', e && e.message ? e.message : e);
    }

    return res.status(201).json({ success: true, data: { user: { id: user._id, name: user.name, email: user.email, role: user.role }, token } });
  } catch (error) {
    console.error('Signup error', error);
    return res.status(500).json({ success: false, message: 'Unable to create account.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(401).json({ success: false, message: 'Email is incorrect. Please enter a valid email address.' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Email is incorrect. Please check your email.' });
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Password is incorrect. Please try again.' });
    }

    const token = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    try {
      await logAdminAction({
        adminId: 'system',
        adminName: 'System',
        userId: user._id.toString(),
        userName: user.name,
        actionType: 'USER_LOGIN',
        entityType: 'USER',
        entityId: user._id.toString(),
        message: `${user.name} logged into RMS.`,
        description: `User login: ${user.email}`,
      });
    } catch (e) {
      console.warn('Login notification failed:', e && e.message ? e.message : e);
    }

    return res.json({ success: true, data: { user: { id: user._id, name:user.name, email: user.email, role: user.role }, token } });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ success: false, message: 'Unable to login.' });
  }
};

export const me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const user = await User.findById(req.user.id).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Me error', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch user.' });
  }
};
