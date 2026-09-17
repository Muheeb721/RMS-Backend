import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import RentRecord from '../models/RentRecord.js';
import Maintenance from '../models/Maintenance.js';
import AdminActionLog from '../models/AdminActionLog.js';

const asNumber = (value) => Number(value || 0);
const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const buildTenantFallbacks = (users = []) => users.map((user, index) => ({
  id: user._id || user.id || `tenant-${index + 1}`,
  _id: user._id || user.id || `tenant-${index + 1}`,
  fullName: user.fullName || user.name || 'Unknown Tenant',
  name: user.name || user.fullName || 'Unknown Tenant',
  email: user.email || '',
  phone: user.phone || '',
  status: user.status || 'Active',
  propertyName: user.propertyName || user.property || '',
  propertyId: user.propertyId || '',
  createdAt: user.createdAt || new Date().toISOString(),
}));

const buildDuesFromRentRecords = (rentRecords = []) => rentRecords.map((record, index) => {
  const amount = asNumber(record.monthlyRent || record.amount || 0);
  const paidAmount = asNumber(record.paid || record.paidAmount || 0);
  const remainingAmount = asNumber(record.remaining ?? Math.max(amount - paidAmount, 0));
  const status = normalizeStatus(record.status);

  return {
    id: record._id || record.id || `due-${index + 1}`,
    _id: record._id || record.id || `due-${index + 1}`,
    userId: record.userId || record.tenantId || '',
    residentName: record.userName || record.tenantName || 'Unknown Tenant',
    user: record.userName || record.tenantName || 'Unknown Tenant',
    propertyId: record.propertyId || '',
    propertyName: record.propertyName || '',
    amount,
    remainingAmount,
    dueDate: record.dueDate || new Date().toISOString(),
    status: status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : status === 'overdue' ? 'Overdue' : 'Pending',
    paymentStatus: status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Pending',
    createdAt: record.createdAt || new Date().toISOString(),
  };
});

const buildMaintenanceItems = (maintenance = []) => maintenance.map((item, index) => ({
  id: item._id || item.id || `maintenance-${index + 1}`,
  _id: item._id || item.id || `maintenance-${index + 1}`,
  issue: item.title || item.issue || 'Maintenance request',
  title: item.title || item.issue || 'Maintenance request',
  description: item.description || '',
  propertyId: item.propertyId || '',
  propertyName: item.propertyName || '',
  user: item.userName || item.user || '',
  assignee: item.userName || item.user || '',
  priority: item.priority || 'Medium',
  status: item.status || 'Open',
  updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  createdAt: item.createdAt || new Date().toISOString(),
}));

export const buildDashboardSummary = ({ properties = [], users = [], bookings = [], payments = [], activity = [], rentRecords = [], maintenance = [] }) => {
  const totalProperties = properties.length;
  const availableProperties = properties.filter((item) => String(item.status || '').toLowerCase() === 'available').length;
  const reservedProperties = properties.filter((item) => String(item.status || '').toLowerCase() === 'reserved').length;
  const soldProperties = properties.filter((item) => String(item.status || '').toLowerCase() === 'sold').length;
  const forRentProperties = properties.filter((item) => String(item.status || '').toLowerCase() === 'for rent').length;

  const totalUsers = users.length;
  const totalBookings = bookings.length;
  const totalRevenue = payments
    .filter((payment) => String(payment.status || '').toLowerCase() === 'paid')
    .reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const pendingPayments = payments
    .filter((payment) => String(payment.status || '').toLowerCase() !== 'paid')
    .length;

  const dues = buildDuesFromRentRecords(rentRecords);
  const outstandingDues = dues.reduce((sum, due) => sum + asNumber(due.remainingAmount), 0);
  const openMaintenance = buildMaintenanceItems(maintenance).filter((item) => String(item.status || '').toLowerCase() !== 'resolved').length;

  const recentActivity = [...activity]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 10)
    .map((item, index) => ({
      id: item._id || item.id || `activity-${index}`,
      action: item.actionType || 'Admin Update',
      details: item.message || item.description || 'Activity recorded',
      timestamp: item.createdAt || new Date().toISOString(),
    }));

  return {
    totalProperties,
    availableProperties,
    reservedProperties,
    soldProperties,
    forRentProperties,
    totalUsers,
    totalBookings,
    totalRevenue,
    pendingPayments,
    outstandingDues,
    openMaintenance,
    recentActivity,
  };
};

export const getAdminDashboard = async (req, res) => {
  try {
    const [properties, users, bookings, payments, rentRecords, maintenance, activity] = await Promise.all([
      Property.find({}).sort({ createdAt: -1 }).lean(),
      User.find({}).select('-passwordHash').sort({ createdAt: -1 }).lean(),
      Booking.find({}).sort({ createdAt: -1 }).lean(),
      Payment.find({}).sort({ createdAt: -1 }).lean(),
      RentRecord.find({}).sort({ createdAt: -1 }).lean(),
      Maintenance.find({}).sort({ createdAt: -1 }).lean(),
      AdminActionLog.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const summary = buildDashboardSummary({ properties, users, bookings, payments, activity, rentRecords, maintenance });
    const tenants = buildTenantFallbacks(users);
    const dues = buildDuesFromRentRecords(rentRecords);
    const maintenanceItems = buildMaintenanceItems(maintenance);

    return res.json({
      success: true,
      data: {
        ...summary,
        properties,
        users,
        tenants,
        bookings,
        payments,
        rentRecords,
        dues,
        maintenanceItems,
        activity,
      },
    });
  } catch (error) {
    console.error('Admin dashboard fetch failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load admin dashboard.' });
  }
};

export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find({}).select('-passwordHash').sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: users });
  } catch (error) {
    console.error('Admin users fetch failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load users.' });
  }
};

export const getAdminAnalytics = async (req, res) => {
  try {
    const [properties, users, bookings, payments, rentRecords, maintenance, activity] = await Promise.all([
      Property.find({}).lean(),
      User.find({}).select('-passwordHash').lean(),
      Booking.find({}).lean(),
      Payment.find({}).lean(),
      RentRecord.find({}).lean(),
      Maintenance.find({}).lean(),
      AdminActionLog.find({}).sort({ createdAt: -1 }).limit(25).lean(),
    ]);

    const summary = buildDashboardSummary({ properties, users, bookings, payments, activity, rentRecords, maintenance });
    const dues = buildDuesFromRentRecords(rentRecords);
    const maintenanceItems = buildMaintenanceItems(maintenance);

    return res.json({
      success: true,
      data: {
        summary,
        users,
        tenants: buildTenantFallbacks(users),
        bookings,
        payments,
        rentRecords,
        dues,
        maintenanceItems,
        statusBreakdown: [
          { label: 'Available', value: properties.filter((item) => String(item.status || '').toLowerCase() === 'available').length },
          { label: 'Reserved', value: properties.filter((item) => String(item.status || '').toLowerCase() === 'reserved').length },
          { label: 'Sold', value: properties.filter((item) => String(item.status || '').toLowerCase() === 'sold').length },
          { label: 'For Rent', value: properties.filter((item) => String(item.status || '').toLowerCase() === 'for rent').length },
        ],
        recentActivity: summary.recentActivity,
      },
    });
  } catch (error) {
    console.error('Admin analytics fetch failed:', error);
    return res.status(500).json({ success: false, message: 'Unable to load admin analytics.' });
  }
};

export const createAdminUser = async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.email || !body.name || !body.password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }

    const email = String(body.email).trim().toLowerCase();
    const existing = await User.findOne({ email }).lean();
    if (existing) return res.status(409).json({ success: false, message: 'A user with that email already exists.' });

    const passwordHash = await bcrypt.hash(String(body.password), 10);
    const user = await User.create({
      name: body.name,
      email,
      passwordHash,
      role: body.role || 'resident',
      phone: body.phone || '',
      profile: body.profile || {},
      status: body.status || 'Active',
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const safe = { ...user.toObject() };
    delete safe.passwordHash;
    return res.status(201).json({ success: true, data: safe });
  } catch (error) {
    console.error('Create admin user failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create user.' });
  }
};

export const updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const allowed = ['name', 'email', 'phone', 'role', 'status', 'profile'];
    const payload = {};
    allowed.forEach((k) => { if (updates[k] !== undefined) payload[k] = updates[k]; });

    if (updates.password) {
      payload.passwordHash = await bcrypt.hash(String(updates.password), 10);
    }

    payload.updatedAt = new Date();

    const user = await User.findByIdAndUpdate(id, payload, { new: true }).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Update admin user failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update user.' });
  }
};

export const archiveAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { archived: true, status: 'Deleted', updatedAt: new Date() }, { new: true }).select('-passwordHash').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('Archive admin user failed', error);
    return res.status(500).json({ success: false, message: 'Unable to archive user.' });
  }
};
