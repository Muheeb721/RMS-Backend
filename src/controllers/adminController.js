import User from '../models/User.js';
import Property from '../models/Property.js';
import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import AdminActionLog from '../models/AdminActionLog.js';

const asNumber = (value) => Number(value || 0);

export const buildDashboardSummary = ({ properties = [], users = [], bookings = [], payments = [], activity = [] }) => {
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
    recentActivity,
  };
};

export const getAdminDashboard = async (req, res) => {
  try {
    const [properties, users, bookings, payments, activity] = await Promise.all([
      Property.find({}).sort({ createdAt: -1 }).lean(),
      User.find({}).select('-passwordHash').sort({ createdAt: -1 }).lean(),
      Booking.find({}).sort({ createdAt: -1 }).lean(),
      Payment.find({}).sort({ createdAt: -1 }).lean(),
      AdminActionLog.find({}).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const summary = buildDashboardSummary({ properties, users, bookings, payments, activity });

    return res.json({
      success: true,
      data: {
        ...summary,
        properties,
        users,
        bookings,
        payments,
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
    const [properties, users, bookings, payments, activity] = await Promise.all([
      Property.find({}).lean(),
      User.find({}).select('-passwordHash').lean(),
      Booking.find({}).lean(),
      Payment.find({}).lean(),
      AdminActionLog.find({}).sort({ createdAt: -1 }).limit(25).lean(),
    ]);

    const summary = buildDashboardSummary({ properties, users, bookings, payments, activity });

    return res.json({
      success: true,
      data: {
        summary,
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
