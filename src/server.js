import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import {createRequire } from 'module';
const require = createRequire(import.meta.url);
const morgan = require('morgan');
import bcrypt from 'bcryptjs';
import { connectDatabase } from './config/database.js';
import { seedDemoIfMissing } from './utils/demoSeeder.js';
import { requireAdmin, requireAuth } from './middleware/auth.js';
import User from './models/User.js';
import UserNotification from './models/UserNotification.js';
import { logAdminAction, getUserActivity, getAdminActivity } from './services/activityService.js';
import { createNotification } from './controllers/notificationController.js';
import {aboutRoutes} from './routes/about.js';

// routers
import authRoutes from './routes/auth.js';
import propertyRoutes from './routes/properties.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payments.js';
import rentRoutes from './routes/rents.js';
import maintenanceRoutes from './routes/maintenance.js';
import favoriteRoutes from './routes/favorites.js';
import savedSearchRoutes from './routes/saved-searches.js';
import notificationRoutes from './routes/notifications.js';
import contactRoutes from './routes/contact.js';
import propertyInquiryRoutes from './routes/property-inquiries.js';
import userRoutes from './routes/users.js';
import analyticsRoutes from './routes/analytics.js';
import reviewsRoutes from './routes/reviews.js';
import propertyVerificationRoutes from './routes/property-verification.js';
import areasRoutes from './routes/areas.js';
import rentalRoutes from './routes/rentals.js';
import imageRoutes from './routes/images.js';

import chatbotRoutes from './routes/chatbotroutes.js';
import adminRoutes from './routes/admin.js';

const app = express();
const DEFAULT_PORT = 5000;
const configuredPort = Number.parseInt(process.env.PORT || '', 10);
const START_PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : DEFAULT_PORT;

// Global error handlers to assist in debugging startup crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection at startup:', reason);
});

const ensureDefaultAdmin = async () => {
  const adminEmail = 'admin@rms.com';
  const existing = await User.findOne({ email: adminEmail });
  if (!existing) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await User.create({
      name: 'System Admin',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      phone: '+923000000000',
      profile: { name: 'System Admin', email: adminEmail, phone: '+923000000000' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Default admin created with email admin@rms.com and password admin123');
    return;
  }

  if (String(existing.role || '').toLowerCase() !== 'admin') {
    existing.role = 'admin';
    existing.updatedAt = new Date();
    await existing.save();
  }
};

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5177',
  'http://127.0.0.1:5178',
  'http://127.0.0.1:4173',
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  const localhostMatch = /^http:\/\/localhost:(517[3-9]|518\d)\/?$/.test(origin);
  const localMatch = /^http:\/\/127\.0\.0\.1:(517[3-9]|518\d)\/?$/.test(origin);
  return localhostMatch || localMatch;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-rms-session', 'X-Requested-With'],
};

app.use(express.json());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// serve demo/static images from Backend/public/images (used by demo seed)
const imagesDir = path.join(process.cwd(), 'Backend', 'public', 'images');
app.use('/images', express.static(imagesDir));
app.use(morgan('dev'));

// mount api routers
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/rents', rentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/saved-searches', savedSearchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/property-inquiries', propertyInquiryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/about', aboutRoutes);
app.use('/api/property-verification', propertyVerificationRoutes);
app.use('/api/areas', areasRoutes);
app.use('/api/rental-profiles', rentalRoutes);
app.use('/api/tenant-profile', rentalRoutes);
app.use('/api/tenant-profiles', rentalRoutes);
app.use('/api/rent-bookings', bookingRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/reviews', reviewsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'RMS backend is running.' });
});

app.post('/api/admin/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const input = req.body || {};
    const result = await logAdminAction({
      adminId: input.adminId || req.user?.id || 'admin-01',
      adminName: input.adminName || req.user?.name || 'Admin',
      adminEmail: input.adminEmail || req.user?.email || '',
      userId: input.userId || '',
      userName: input.userName || '',
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId || '',
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      message: input.message,
      reason: input.reason,
      description: input.description,
      propertyName: input.propertyName,
    });

    res.status(201).json({
      success: true,
      data: result.logRecord,
      notification: result.notification,
    });
  } catch (error) {
    console.error('Admin activity log failed', error);
    res.status(500).json({ success: false, message: 'Unable to record admin activity.' });
  }
});

app.get('/api/users/me/activity', requireAuth, async (req, res) => {
  try {
    const logs = await getUserActivity(req.user.id || req.user._id || req.user.email || '');
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('User activity fetch failed', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve activity history.' });
  }
});

app.get('/api/admin/activity', requireAuth, requireAdmin, async (req, res) => {
  try {
    const logs = await getAdminActivity();
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Admin activity fetch failed', error);
    res.status(500).json({ success: false, message: 'Unable to retrieve admin activity.' });
  }
});

app.post('/api/admin/booking/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, userName, bookingId, propertyName, message, reason, previousStatus, newStatus } = req.body || {};
    const result = await logAdminAction({
      adminId: req.user?.id || 'admin-01',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      userId,
      userName,
      actionType: 'BOOKING_APPROVED',
      entityType: 'BOOKING',
      entityId: bookingId,
      previousStatus,
      newStatus: newStatus || 'Approved',
      message: message || `Your booking for ${propertyName || 'the property'} has been approved by the admin.`,
      reason: reason || 'Booking verified successfully.',
      description: `Admin approved booking ${bookingId}`,
      propertyName,
    });

    res.json({ success: true, data: result.logRecord, notification: result.notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to approve booking.' });
  }
});

app.post('/api/admin/booking/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, userName, bookingId, propertyName, message, reason, previousStatus, newStatus } = req.body || {};
    const result = await logAdminAction({
      adminId: req.user?.id || 'admin-01',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      userId,
      userName,
      actionType: 'BOOKING_REJECTED',
      entityType: 'BOOKING',
      entityId: bookingId,
      previousStatus,
      newStatus: newStatus || 'Rejected',
      message: message || `Your booking for ${propertyName || 'the property'} was rejected by the admin.`,
      reason: reason || 'Booking did not meet the required criteria.',
      description: `Admin rejected booking ${bookingId}`,
      propertyName,
    });

    res.json({ success: true, data: result.logRecord, notification: result.notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to reject booking.' });
  }
});

app.post('/api/admin/payment/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, userName, paymentId, propertyName, message, reason, previousStatus, newStatus } = req.body || {};
    const result = await logAdminAction({
      adminId: req.user?.id || 'admin-01',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      userId,
      userName,
      actionType: 'PAYMENT_APPROVED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      previousStatus,
      newStatus: newStatus || 'Approved',
      message: message || 'Your payment has been approved by the admin.',
      reason: reason || 'Payment verified successfully.',
      description: `Admin approved payment ${paymentId}`,
      propertyName,
    });

    res.json({ success: true, data: result.logRecord, notification: result.notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to approve payment.' });
  }
});

app.post('/api/admin/payment/reject', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, userName, paymentId, propertyName, message, reason, previousStatus, newStatus } = req.body || {};
    const result = await logAdminAction({
      adminId: req.user?.id || 'admin-01',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      userId,
      userName,
      actionType: 'PAYMENT_REJECTED',
      entityType: 'PAYMENT',
      entityId: paymentId,
      previousStatus,
      newStatus: newStatus || 'Rejected',
      message: message || 'Your payment has been rejected by the admin.',
      reason: reason || 'Payment could not be verified.',
      description: `Admin rejected payment ${paymentId}`,
      propertyName,
    });

    res.json({ success: true, data: result.logRecord, notification: result.notification });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Unable to reject payment.' });
  }
});

app.post('/api/admin/message', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, userName, entityType = 'GENERAL', entityId = '', actionType = 'ANNOUNCEMENT', title, message, reason, status = 'Notice' } = req.body || {};

    if (!userId) {
      return res.status(400).json({ success: false, message: 'A target userId is required.' });
    }

    const notification = await UserNotification.create({
      userId,
      userName: userName || '',
      actorType: 'admin',
      actorName: req.user?.name || 'Admin',
      entityType: String(entityType).toUpperCase(),
      entityId: String(entityId || ''),
      actionType: String(actionType).toUpperCase(),
      title: title || 'Admin message',
      message: message || 'A new message from the admin is available.',
      reason: reason || '',
      status,
      isRead: false,
      createdAt: new Date(),
    });

    await logAdminAction({
      adminId: req.user?.id || 'admin-01',
      adminName: req.user?.name || 'Admin',
      adminEmail: req.user?.email || '',
      userId,
      userName,
      actionType: 'ANNOUNCEMENT',
      entityType: String(entityType).toUpperCase(),
      entityId: String(entityId || ''),
      previousStatus: '',
      newStatus: status,
      message: message || 'Admin message sent.',
      reason: reason || 'Admin announcement',
      description: title || 'Admin message sent',
      propertyName: '',
    });

    return res.status(201).json({ success: true, data: notification });
  } catch (error) {
    console.error('Admin message creation failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to store the admin message.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

const startServer = async () => {
  try {
    await connectDatabase();
    await ensureDefaultAdmin();
    try {
      await seedDemoIfMissing();
    } catch (e) {
      console.warn('Demo seeder failed', e?.message || e);
    }

    const candidatePorts = Array.from({ length: 10 }, (_, index) => START_PORT + index);

    const listenOnPort = (portIndex = 0) => {
      const port = candidatePorts[portIndex];
      const server = app.listen(port, () => {
        console.log(`RMS backend listening on http://localhost:${port}`);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && portIndex < candidatePorts.length - 1) {
          console.warn(`Port ${port} is already in use. Retrying on http://localhost:${candidatePorts[portIndex + 1]}`);
          listenOnPort(portIndex + 1);
          return;
        }

        console.error(`Failed to start backend on port ${port}:`, error.message || error);
        process.exit(1);
      });
    };

    listenOnPort();
  } catch (error) {
    console.error('Failed to start backend:', error);
    process.exit(1);
  }
};

startServer();
