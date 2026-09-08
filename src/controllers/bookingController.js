import Booking from '../models/Booking.js';
import UserNotification from '../models/UserNotification.js';
import { logAdminAction } from '../services/activityService.js';
import { buildUserNotification } from '../utils/activity.js';

export const createBooking = async (req, res) => {
  try {
    const body = req.body || {};
    const user = req.user || {};
    const effectiveUserId = String(body.userId || user.id || `guest-${Date.now()}`).trim();
    const bookingStatus = body.bookingStatus || body.status || 'Pending';
    const paymentStatus = body.paymentStatus || 'Pending';
    const propertyId = body.propertyId || body.property?.id || '';
    const propertyName = body.propertyName || body.propertyTitle || body.property?.title || '';
    const propertyTitle = body.propertyTitle || propertyName || '';
    const propertyType = body.propertyType || body.type || body.property?.type || '';
    const amount = Number(body.amount || body.rent || body.totalAmount || 0);
    const userName = body.customerName || body.userName || user.name || body.fullName || 'Guest User';
    const userEmail = body.userEmail || body.email || user.email || '';
    const userPhone = body.userPhone || body.phone || body.customerPhone || '';

    const booking = await Booking.create({
      userId: effectiveUserId,
      userName,
      userEmail,
      userPhone,
      customerName: userName,
      customerPhone: userPhone,
      propertyId,
      propertyName,
      propertyTitle,
      propertyType,
      amount,
      rent: Number(body.rent || amount || 0),
      rentFrequency: body.rentFrequency || 'Monthly',
      moveInDate: body.moveInDate ? new Date(body.moveInDate) : null,
      rentalDuration: body.rentalDuration || '1 month',
      occupants: Number(body.occupants || 1),
      message: body.message || body.notes || '',
      notes: body.notes || body.message || '',
      paymentStatus,
      bookingStatus,
      status: bookingStatus,
      bookingDate: body.bookingDate ? new Date(body.bookingDate) : new Date(),
      visitDate: body.visitDate ? new Date(body.visitDate) : null,
    });

    try {
      await logAdminAction({
        adminId: 'system',
        adminName: 'System',
        adminEmail: '',
        userId: booking.userId,
        userName: booking.userName,
        actionType: 'BOOKING_SUBMITTED',
        entityType: 'BOOKING',
        entityId: booking._id.toString(),
        message: `Your booking for ${booking.propertyTitle || 'the property'} has been submitted.`,
        description: `Booking ${booking._id} submitted by user.`,
        newStatus: booking.bookingStatus || booking.status || 'Pending',
        propertyName: booking.propertyTitle || '',
      });
    } catch (e) {
      console.warn('Booking notification create failed via logAdminAction:', e && e.message ? e.message : e);
    }

    return res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('Create booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create booking.' });
  }
};

export const listMyBookings = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const items = await Booking.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List my bookings failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get bookings.' });
  }
};

export const listAllBookings = async (req, res) => {
  try {
    const items = await Booking.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List bookings failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get bookings.' });
  }
};

export const approveBooking = async (req, res) => {
  try {
    const { id } = req.params; // booking id
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const previousStatus = booking.status;
    booking.status = 'Approved';
    booking.bookingStatus = 'Approved';
    booking.paymentStatus = booking.paymentStatus || 'Approved';
    await booking.save();

    const admin = req.user || {};
    const result = await logAdminAction({
      adminId: admin.id || admin._id || 'admin',
      adminName: admin.name || 'Admin',
      adminEmail: admin.email || '',
      userId: booking.userId,
      userName: booking.userName,
      actionType: 'BOOKING_APPROVED',
      entityType: 'BOOKING',
      entityId: booking._id.toString(),
      previousStatus,
      newStatus: 'Approved',
      message: `Your booking for ${booking.propertyTitle || 'the property'} has been approved.`,
      description: `Admin approved booking ${booking._id}`,
      propertyName: booking.propertyTitle || '',
    });

    return res.json({ success: true, data: booking, audit: result });
  } catch (error) {
    console.error('Approve booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to approve booking.' });
  }
};

export const rejectBooking = async (req, res) => {
  try {
    const { id } = req.params; // booking id
    const { reason } = req.body || {};
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const previousStatus = booking.status;
    booking.status = 'Rejected';
    booking.bookingStatus = 'Rejected';
    booking.paymentStatus = booking.paymentStatus || 'Pending';
    await booking.save();

    const admin = req.user || {};
    const result = await logAdminAction({
      adminId: admin.id || admin._id || 'admin',
      adminName: admin.name || 'Admin',
      adminEmail: admin.email || '',
      userId: booking.userId,
      userName: booking.userName,
      actionType: 'BOOKING_REJECTED',
      entityType: 'BOOKING',
      entityId: booking._id.toString(),
      previousStatus,
      newStatus: 'Rejected',
      message: `Your booking for ${booking.propertyTitle || 'the property'} has been rejected.`,
      reason: reason || 'No reason provided',
      description: `Admin rejected booking ${booking._id}`,
      propertyName: booking.propertyTitle || '',
    });

    return res.json({ success: true, data: booking, audit: result });
  } catch (error) {
    console.error('Reject booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to reject booking.' });
  }
};
