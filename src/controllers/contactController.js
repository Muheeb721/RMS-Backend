import ContactRequest from '../models/ContactRequest.js';
import User from '../models/User.js';
import UserNotification from '../models/UserNotification.js';

export const createContact = async (req, res) => {
  try {
    const { fullName, email, phone, message, propertyId, propertyName, inquiryType } = req.body || {};

    const payload = {
      fullName: fullName || '',
      email: email || '',
      phone: phone || '',
      message: message || '',
      propertyId: propertyId || '',
      propertyName: propertyName || '',
      inquiryType: inquiryType || 'General',
      createdAt: new Date(),
    };

    if (req.user && req.user.id) payload.userId = req.user.id;
    const record = await ContactRequest.create(payload);

    // notify admin (non-blocking)
    try {
      const adminUser = await User.findOne({ role: 'admin' }).lean();
      const adminId = adminUser && adminUser._id ? adminUser._id.toString() : 'admin';
      await UserNotification.create({
        userId: adminId,
        userName: adminUser?.name || 'Admin',
        actorType: 'user',
        actorName: fullName || email || 'Visitor',
        entityType: 'CONTACT',
        entityId: record._id.toString(),
        actionType: 'CONTACT_FORM_SUBMITTED',
        title: 'Contact Form Submitted',
        message: `New contact form submitted by ${fullName || email || 'a visitor'}.`,
        isRead: false,
        createdAt: new Date(),
      });
    } catch (e) {
      console.warn('Contact admin notification failed:', e && e.message ? e.message : e);
    }

    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Create contact failed', error);
    return res.status(500).json({ success: false, message: 'Unable to store contact submission.' });
  }
};

export const listContacts = async (req, res) => {
  try {
    const user = req.user || {};
    const type = req.query.type || null;
    const filter = {};
    if (type) filter.inquiryType = type;
    if (user && user.role === 'admin') {
      const items = await ContactRequest.find(filter).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: items });
    }

    if (user && user.id) {
      filter.userId = user.id;
      const items = await ContactRequest.find(filter).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: items });
    }

    return res.status(401).json({ success: false, message: 'Authentication required.' });
  } catch (error) {
    console.error('List contacts failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list contact requests.' });
  }
};

export const updateContact = async (req, res) => {
  try {
    const user = req.user || {};
    const { id } = req.params || {};
    const updates = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Id required.' });

    const record = await ContactRequest.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Not found.' });

    // allow admin or owner to update
    if (user.role !== 'admin' && String(record.userId || '') !== String(user.id || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    Object.assign(record, updates, { updatedAt: new Date() });
    await record.save();
    return res.json({ success: true, data: record });
  } catch (error) {
    console.error('Update contact failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update contact request.' });
  }
};

export const deleteContact = async (req, res) => {
  try {
    const user = req.user || {};
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Id required.' });

    const record = await ContactRequest.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Not found.' });

    if (user.role !== 'admin' && String(record.userId || '') !== String(user.id || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    await ContactRequest.findByIdAndDelete(id);
    return res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete contact failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete contact request.' });
  }
};
