import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logAdminAction } from '../services/activityService.js';

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return process.env.JWT_SECRET;
};
const normalizeUserDocument = (user) => ({
  _id: user?._id ?? user?.id,
  id: user?._id ?? user?.id,
  username: user?.username || '',
  name: user?.name || '',
  email: user?.email || '',
  role: user?.role || 'resident',
  phone: user?.phone || '',
  profileImage: user?.profileImage || user?.profile?.profileImage || user?.profileData?.profileImage || '',
  hasRentalProfile: Boolean(user?.hasRentalProfile),
  profileData: user?.profileData || {},
  favorites: user?.favorites || [],
  preferences: user?.preferences || {},
  lastLoginAt: user?.lastLoginAt || null,
});

export const signup = async (req, res) => {
  try {
    const { name, email, username, password, confirmPassword, phone, role, profileData, preferences } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedUsername = username ? String(username).trim().toLowerCase() : (normalizedEmail.split('@')[0] || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Invalid email address.' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (confirmPassword && String(password) !== String(confirmPassword)) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    const existing = await User.findOne({ $or: [{ email: normalizedEmail }, { username: normalizedUsername }] }).lean();
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const requestedRole = String(role || 'resident').toLowerCase();
    const userRole = requestedRole === 'owner' ? 'owner' : 'resident';
    const user = await User.create({
      username: normalizedUsername,
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      passwordHash,
      phone: phone || '',
      role: ['admin', 'owner', 'resident'].includes(userRole) ? userRole : 'resident',
      profile: {
        name: name || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        phone: phone || '',
        address: '',
        description: '',
      },
      profileData: profileData || {},
      favorites: [],
      preferences: preferences || {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const tokenPayload = { userId: user._id.toString(), id: user._id.toString(), email: user.email, name: user.name, role: user.role };
    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const safeUser = normalizeUserDocument(user);

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

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: safeUser,
      data: { token, user: safeUser },
    });
  } catch (error) {
    console.error('Signup error', error);
    return res.status(500).json({ success: false, message: 'Unable to create account.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    const identifier = (email ?? username ?? '').toString().trim();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/username and password are required.' });
    }

    const normalizedIdentifier = identifier.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const userFilter = emailRegex.test(normalizedIdentifier)
      ? { email: normalizedIdentifier }
      : { $or: [{ username: normalizedIdentifier }, { email: normalizedIdentifier }] };

    const user = await User.findOne(userFilter).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const match = await user.comparePassword(String(password));
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    user.lastLoginAt = new Date();
    user.updatedAt = new Date();
    await user.save();

    const tokenPayload = { userId: user._id.toString(), id: user._id.toString(), email: user.email, name: user.name, role: user.role };
    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const safeUser = normalizeUserDocument(user);

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

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser,
      data: { token, user: safeUser },
    });
  } catch (error) {
    console.error('Login error', error);
    return res.status(500).json({ success: false, message: 'Unable to login.' });
  }
};

export const me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated.' });
    const userId = req.user.userId || req.user.id || req.user._id;
    const user = await User.findById(userId).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: normalizeUserDocument(user) });
  } catch (error) {
    console.error('Me error', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch user.' });
  }
};
