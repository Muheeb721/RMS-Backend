import Booking from '../models/Booking.js';
import Property from '../models/Property.js';
import UserNotification from '../models/UserNotification.js';
import Payment from '../models/Payment.js';
import { logAdminAction } from '../services/activityService.js';
import { sendBookingSubmittedEmail, sendBookingApprovedEmail, sendBookingRejectedEmail } from '../services/emailService.js';
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
      // applicant personal info
      cnic: body.cnic || body.CNIC || '',
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      nationality: body.nationality || '',
      // current address
      addressLine1: body.addressLine1 || body.address1 || '',
      addressLine2: body.addressLine2 || body.address2 || '',
      city: body.city || '',
      province: body.province || body.state || '',
      country: body.country || '',
      // employment
      employmentStatus: body.employmentStatus || '',
      companyName: body.companyName || '',
      jobTitle: body.jobTitle || '',
      monthlyIncome: Number(body.monthlyIncome || 0),
      workAddress: body.workAddress || '',
      yearsExperience: Number(body.yearsExperience || 0),
      // rental details
      reasonForRent: body.reasonForRent || body.reason || '',
      preferredMoveInDate: body.preferredMoveInDate ? new Date(body.preferredMoveInDate) : null,
      // references
      previousLandlordName: body.previousLandlordName || '',
      previousLandlordPhone: body.previousLandlordPhone || '',
      previousLandlordRelationship: body.previousLandlordRelationship || '',
      // terms
      termsAccepted: Boolean(body.termsAccepted || body.terms || false),
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

    try {
      if (booking.userEmail) {
        await sendBookingSubmittedEmail({
          userName: booking.userName || booking.customerName || 'RMS User',
          userEmail: booking.userEmail,
          userId: booking.userId,
          bookingId: booking._id.toString(),
          propertyName: booking.propertyTitle || booking.propertyName || 'N/A',
          propertyType: booking.propertyType || 'N/A',
          location: booking.city || 'N/A',
          monthlyRent: booking.rent || booking.amount || 0,
          moveInDate: booking.moveInDate ? new Date(booking.moveInDate).toISOString().slice(0, 10) : 'N/A',
          rentalDuration: booking.rentalDuration || 'N/A',
          bookingStatus: 'Pending Confirmation',
          bookingDate: booking.bookingDate ? new Date(booking.bookingDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
      }
    } catch (emailError) {
      console.warn('Booking submitted email failed:', emailError && emailError.message ? emailError.message : emailError);
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
    console.log("Booking ID received:",req.params.id)
    const { id } = req.params; // booking id
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    const previousStatus = booking.status;
    booking.status = 'Approved';
    booking.bookingStatus = 'Approved';
    booking.paymentStatus = booking.paymentStatus || 'Approved';
    await booking.save();

    // update property status to Reserved when a booking is approved
    try {
      if (booking.propertyId) {
        await Property.findOneAndUpdate({ _id: booking.propertyId }, { status: 'Reserved', availability: 'Reserved' });
      }
    } catch (e) {
      console.warn('Unable to update property status on booking approve', e && e.message ? e.message : e);
    }

    // create an initial payment record (advance) for this approved booking if rent/amount exists
    try {
      const total = Number(booking.rent || booking.amount || 0);
      if (total > 0) {
        const paymentPayload = {
          userId: booking.userId || booking.userEmail || `guest-${Date.now()}`,
          userName: booking.userName || booking.customerName || '',
          userEmail: booking.userEmail || '',
          bookingId: booking._id.toString(),
          propertyId: booking.propertyId || '',
          propertyName: booking.propertyTitle || booking.propertyName || '',
          propertyType: booking.propertyType || '',
          totalAmount: total,
          amount: total,
          advanceAmount: 0,
          amountPaid: 0,
          remainingAmount: total,
          paymentType: 'Advance',
          method: 'Pending',
          status: 'Pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        try {
          await Payment.create(paymentPayload);
        } catch (e) {
          console.warn('Unable to create payment for approved booking', e && e.message ? e.message : e);
        }
      }
    } catch (e) {
      console.warn('Create initial payment failed for booking approve', e && e.message ? e.message : e);
    }

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

    try {
      if (booking.userEmail) {
        await sendBookingApprovedEmail({
          userName: booking.userName || booking.customerName || 'RMS User',
          userEmail: booking.userEmail,
          userId: booking.userId,
          bookingId: booking._id.toString(),
          propertyName: booking.propertyTitle || booking.propertyName || 'N/A',
          location: booking.city || 'N/A',
          monthlyRent: booking.rent || booking.amount || 0,
          moveInDate: booking.moveInDate ? new Date(booking.moveInDate).toISOString().slice(0, 10) : 'N/A',
          status: 'Approved',
        });
      }
    } catch (emailError) {
      console.warn('Booking approved email failed:', emailError && emailError.message ? emailError.message : emailError);
    }

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

    try {
      if (booking.userEmail) {
        await sendBookingRejectedEmail({
          userName: booking.userName || booking.customerName || 'RMS User',
          userEmail: booking.userEmail,
          userId: booking.userId,
          bookingId: booking._id.toString(),
          propertyName: booking.propertyTitle || booking.propertyName || 'N/A',
          reason: reason || 'No reason provided',
        });
      }
    } catch (emailError) {
      console.warn('Booking rejected email failed:', emailError && emailError.message ? emailError.message : emailError);
    }

    return res.json({ success: true, data: booking, audit: result });
  } catch (error) {
    console.error('Reject booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to reject booking.' });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing booking id.' });
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

    // attempt to restore property availability if this booking reserved it
    try {
      if (booking.propertyId) {
        await Property.findOneAndUpdate({ _id: booking.propertyId }, { status: 'Available', availability: 'Available' });
      }
    } catch (e) {
      console.warn('Unable to update property status on booking delete', e && e.message ? e.message : e);
    }

    await Booking.findByIdAndDelete(id);

    const admin = req.user || {};
    try {
      await logAdminAction({
        adminId: admin.id || admin._id || 'admin',
        adminName: admin.name || 'Admin',
        adminEmail: admin.email || '',
        userId: booking.userId,
        userName: booking.userName || booking.customerName || '',
        actionType: 'BOOKING_DELETED',
        entityType: 'BOOKING',
        entityId: id,
        message: `Booking ${id} was deleted by admin.`,
        description: `Admin deleted booking ${id}`,
        propertyName: booking.propertyTitle || booking.propertyName || '',
      });
    } catch (e) {
      console.warn('Log admin action failed for booking delete', e && e.message ? e.message : e);
    }

    return res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete booking failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete booking.' });
  }
};
