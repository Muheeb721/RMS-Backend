import RentApplication from '../models/RentApplication.js';
import Property from '../models/Property.js';
import { logAdminAction } from '../services/activityService.js';
import { sendBookingSubmittedEmail, sendBookingApprovedEmail, sendBookingRejectedEmail } from '../services/emailService.js';

export const createApplication = async (req, res) => {
  try {
    const body = req.body || {};
    const user = req.user || {};
    const userId = String(body.userId || user.id || user._id || user.email || `guest-${Date.now()}`).trim();
    const application = await RentApplication.create({
      userId,
      userName: body.userName || user.name || '',
      userEmail: body.userEmail || user.email || '',
      userPhone: body.userPhone || '',
      profileImage: body.profileImage || '',
      cnicImage: body.cnicImage || '',
      propertyId: String(body.propertyId || ''),
      propertyTitle: body.propertyTitle || '',
      propertyType: body.propertyType || '',
      rent: Number(body.rent || 0),
      applicationStatus: 'pending',
      notes: body.notes || '',
      submittedAt: new Date(),
      updatedAt: new Date(),
    });

    try {
      await logAdminAction({
        adminId: 'system',
        adminName: 'System',
        actionType: 'RENT_APPLICATION_SUBMITTED',
        entityType: 'RENT_APPLICATION',
        entityId: application._id.toString(),
        userId: application.userId,
        userName: application.userName,
        message: `New rent application submitted for ${application.propertyTitle || application.propertyId}`,
        propertyName: application.propertyTitle || '',
      });
    } catch (e) {
      console.warn('Log admin action failed for rent application', e?.message || e);
    }

    try {
      if (application.userEmail) {
        await sendBookingSubmittedEmail({
          userName: application.userName || 'Applicant',
          userEmail: application.userEmail,
          userId: application.userId,
          bookingId: application._id.toString(),
          propertyName: application.propertyTitle || 'N/A',
          propertyType: application.propertyType || 'N/A',
          monthlyRent: application.rent || 0,
          bookingStatus: 'Pending',
          bookingDate: application.submittedAt ? new Date(application.submittedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        });
      }
    } catch (emailError) {
      console.warn('Application submitted email failed:', emailError?.message || emailError);
    }

    return res.status(201).json({ success: true, data: application });
  } catch (error) {
    console.error('Create application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create application.' });
  }
};

export const listUserApplications = async (req, res) => {
  try {
    const user = req.user || {};
    const userId = String(user.id || user._id || user.email || '').trim();
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const items = await RentApplication.find({ userId }).sort({ submittedAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List user applications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list applications.' });
  }
};

export const listAllApplications = async (req, res) => {
  try {
    const items = await RentApplication.find({}).sort({ submittedAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List applications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list applications.' });
  }
};

export const getApplicationById = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Application id required.' });
    const app = await RentApplication.findById(id).lean();
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });
    return res.json({ success: true, data: app });
  } catch (error) {
    console.error('Get application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get application.' });
  }
};

export const acceptApplication = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Application id required.' });
    const app = await RentApplication.findById(id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    app.applicationStatus = 'accepted';
    app.updatedAt = new Date();
    await app.save();

    // mark property as booked
    try {
      if (app.propertyId) {
        await Property.findOneAndUpdate({ _id: app.propertyId }, { status: 'Booked', availability: 'Booked' });
      }
    } catch (e) {
      console.warn('Unable to update property status on application accept', e?.message || e);
    }

    try {
      await logAdminAction({
        adminId: req.user?.id || req.user?._id || 'admin',
        adminName: req.user?.name || 'Admin',
        actionType: 'RENT_APPLICATION_ACCEPTED',
        entityType: 'RENT_APPLICATION',
        entityId: app._id.toString(),
        userId: app.userId,
        userName: app.userName,
        previousStatus: 'pending',
        newStatus: 'accepted',
        message: `Rent application ${app._id} accepted`,
        propertyName: app.propertyTitle || '',
      });
    } catch (e) { console.warn('Log admin action failed', e?.message || e); }

    try {
      if (app.userEmail) {
        await sendBookingApprovedEmail({
          userName: app.userName || 'Applicant',
          userEmail: app.userEmail,
          userId: app.userId,
          bookingId: app._id.toString(),
          propertyName: app.propertyTitle || 'N/A',
          location: '',
          monthlyRent: app.rent || 0,
          status: 'Accepted',
        });
      }
    } catch (emailError) { console.warn('Accept email failed', emailError?.message || emailError); }

    return res.json({ success: true, data: app });
  } catch (error) {
    console.error('Accept application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to accept application.' });
  }
};

export const rejectApplication = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { reason } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Application id required.' });
    const app = await RentApplication.findById(id);
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    app.applicationStatus = 'rejected';
    app.rejectionReason = reason || '';
    app.updatedAt = new Date();
    await app.save();

    // ensure property remains available
    try {
      if (app.propertyId) {
        await Property.findOneAndUpdate({ _id: app.propertyId }, { status: 'Available', availability: 'Available' });
      }
    } catch (e) { console.warn('Unable to update property status on application reject', e?.message || e); }

    try {
      await logAdminAction({
        adminId: req.user?.id || req.user?._id || 'admin',
        adminName: req.user?.name || 'Admin',
        actionType: 'RENT_APPLICATION_REJECTED',
        entityType: 'RENT_APPLICATION',
        entityId: app._id.toString(),
        userId: app.userId,
        userName: app.userName,
        previousStatus: 'pending',
        newStatus: 'rejected',
        message: `Rent application ${app._id} rejected`,
        reason: reason || '',
        propertyName: app.propertyTitle || '',
      });
    } catch (e) { console.warn('Log admin action failed', e?.message || e); }

    try {
      if (app.userEmail) {
        await sendBookingRejectedEmail({
          userName: app.userName || 'Applicant',
          userEmail: app.userEmail,
          userId: app.userId,
          bookingId: app._id.toString(),
          propertyName: app.propertyTitle || 'N/A',
          reason: reason || 'No reason provided',
        });
      }
    } catch (emailError) { console.warn('Reject email failed', emailError?.message || emailError); }

    return res.json({ success: true, data: app });
  } catch (error) {
    console.error('Reject application failed', error);
    return res.status(500).json({ success: false, message: 'Unable to reject application.' });
  }
};
