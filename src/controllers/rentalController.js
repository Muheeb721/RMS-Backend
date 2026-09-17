import RentalProfile from '../models/RentalProfile.js';
import { sendProfileCompletedEmail } from '../services/emailService.js';

const addMonths = (date, months) => {
  if (!date) return null;
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

export const createRentalProfile = async (req, res) => {
  try {
    const body = req.body || {};
    const user = req.user || {};
    const userId = String(body.userId || user.id || user._id || '').trim();
    const required = [
      body.fullName,
      body.email,
      body.phone,
      body.currentAddress,
      body.city,
      body.occupation,
      body.emergencyContactName,
    ];

    if (!userId || required.some((value) => !value || !String(value).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Profile is incomplete. Full name, email, phone, current address, city, occupation, and emergency contact are required.',
      });
    }

    const payload = {
      userId,
      fullName: String(body.fullName).trim(),
      email: String(body.email).trim(),
      phone: String(body.phone).trim(),
      profileImage: typeof body.profileImage === 'string' ? body.profileImage.trim() : (body.profileImage || ''),
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      gender: body.gender || '',
      currentAddress: String(body.currentAddress).trim(),
      city: String(body.city).trim(),
      area: String(body.area || '').trim(),
      postalCode: String(body.postalCode || '').trim(),
      occupation: String(body.occupation).trim(),
      companyName: String(body.companyName || '').trim(),
      monthlyIncome: Number(body.monthlyIncome || 0),
      familyMembers: Number(body.familyMembers || 1),
      peopleInProperty: Number(body.peopleInProperty || 1),
      preferredMoveInDate: body.preferredMoveInDate ? new Date(body.preferredMoveInDate) : null,
      emergencyContactName: String(body.emergencyContactName || '').trim(),
      emergencyContactPhone: String(body.emergencyContactPhone || '').trim(),
      relationship: String(body.relationship || '').trim(),
      propertyId: body.propertyId || '',
      propertyName: body.propertyName || '',
      propertyType: body.propertyType || '',
      monthlyRent: Number(body.monthlyRent || 0),
      rentalStartDate: body.rentalStartDate ? new Date(body.rentalStartDate) : null,
      rentalDurationMonths: Number(body.rentalDurationMonths || 0),
      applicationDate: body.applicationDate ? new Date(body.applicationDate) : new Date(),
      status: body.status || 'Pending',
      profileStatus: body.profileStatus || 'Profile Complete',
      notes: body.notes || '',
    };

    const existing = await RentalProfile.findOne({ userId }).lean();
    const record = existing
      ? await RentalProfile.findByIdAndUpdate(existing._id, payload, { new: true, runValidators: true }).lean()
      : await RentalProfile.create(payload);

    if (record.rentalStartDate && record.rentalDurationMonths > 0) {
      const next = addMonths(record.rentalStartDate, 1);
      await RentalProfile.findByIdAndUpdate(record._id, { nextNotificationDate: next }, { new: true });
    }

    try {
      if (record.email && record.fullName) {
        await sendProfileCompletedEmail({
          userName: record.fullName,
          userEmail: record.email,
          userId: record.userId,
        });
      }
    } catch (emailError) {
      console.warn('Profile completion email failed:', emailError && emailError.message ? emailError.message : emailError);
    }

    return res.status(existing ? 200 : 201).json({ success: true, data: record });
  } catch (error) {
    console.error('Create rental profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create rental profile.' });
  }
};

export const getRentalProfile = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Profile id required.' });
    const rec = await RentalProfile.findById(id).lean();
    if (!rec) return res.status(404).json({ success: false, message: 'Profile not found.' });
    return res.json({ success: true, data: rec });
  } catch (error) {
    console.error('Get rental profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch rental profile.' });
  }
};

export const getUserRentalProfile = async (req, res) => {
  try {
    const user = req.user || {};
    const userId = String(user.id || user._id || '').trim();
    if (!userId) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const rec = await RentalProfile.findOne({ userId }).lean();
    return res.json({ success: true, data: rec || null });
  } catch (error) {
    console.error('Get user rental profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to fetch user rental profile.' });
  }
};

export const updateRentalProfile = async (req, res) => {
  try {
    const { id } = req.params || {};
    const updates = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Profile id required.' });

    if (updates.rentalStartDate) updates.rentalStartDate = new Date(updates.rentalStartDate);
    if (updates.preferredMoveInDate) updates.preferredMoveInDate = new Date(updates.preferredMoveInDate);
    if (updates.dateOfBirth) updates.dateOfBirth = new Date(updates.dateOfBirth);
    if (updates.monthlyIncome) updates.monthlyIncome = Number(updates.monthlyIncome);
    if (updates.rentalDurationMonths) updates.rentalDurationMonths = Number(updates.rentalDurationMonths);
    if (updates.monthlyRent) updates.monthlyRent = Number(updates.monthlyRent);
    if (updates.profileStatus) updates.profileStatus = updates.profileStatus;

    const existing = await RentalProfile.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Profile not found.' });

    const profileData = {
      ...existing.toObject(),
      ...updates,
      userId: existing.userId,
      updatedAt: new Date(),
    };

    if (profileData.fullName && profileData.email && profileData.phone && profileData.currentAddress && profileData.city && profileData.occupation && profileData.emergencyContactName) {
      profileData.profileStatus = 'Profile Complete';
    } else {
      profileData.profileStatus = 'Profile Incomplete';
    }

    const rec = await RentalProfile.findByIdAndUpdate(id, profileData, { new: true, runValidators: true }).lean();
    return res.json({ success: true, data: rec });
  } catch (error) {
    console.error('Update rental profile failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update rental profile.' });
  }
};

export const listRentalProfiles = async (req, res) => {
  try {
    const items = await RentalProfile.find({ archived: { $ne: true } }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List rental profiles failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list rental profiles.' });
  }
};

export const changeRentalStatus = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { status } = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Profile id required.' });
    if (!status) return res.status(400).json({ success: false, message: 'Status is required.' });
    const rec = await RentalProfile.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true }).lean();
    if (!rec) return res.status(404).json({ success: false, message: 'Profile not found.' });
    return res.json({ success: true, data: rec });
  } catch (error) {
    console.error('Change rental status failed', error);
    return res.status(500).json({ success: false, message: 'Unable to change rental status.' });
  }
};
