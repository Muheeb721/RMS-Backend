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

const normalizePropertyInquiry = (document = {}) => ({
  id: document._id ? document._id.toString() : document.id || '',
  name: document.name || document.fullName || '',
  fullName: document.fullName || document.name || '',
  phone: document.phone || '',
  email: document.email || '',
  propertyId: document.propertyId || '',
  propertyTitle: document.propertyTitle || document.propertyName || '',
  preferredContactMethod: document.preferredContactMethod || 'Email',
  message: document.message || '',
  status: document.status || 'New',
  createdAt: document.createdAt || new Date().toISOString(),
  updatedAt: document.updatedAt || document.createdAt || new Date().toISOString(),
});

export const createPropertyInquiry = async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {
      fullName: body.fullName || body.name || '',
      name: body.name || body.fullName || '',
      email: body.email || '',
      phone: body.phone || '',
      propertyId: body.propertyId || '',
      propertyName: body.propertyName || body.propertyTitle || '',
      propertyTitle: body.propertyTitle || body.propertyName || '',
      message: body.message || '',
      inquiryType: body.inquiryType || 'Property Inquiry',
      preferredContactMethod: body.preferredContactMethod || 'Email',
      status: body.status || 'New',
      userId: req.user?.id || body.userId || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const record = await ContactRequest.create(payload);
    return res.status(201).json({ success: true, data: normalizePropertyInquiry(record.toObject ? record.toObject() : record) });
  } catch (error) {
    console.error('Create property inquiry failed', error);
    return res.status(500).json({ success: false, message: 'Unable to store property inquiry.' });
  }
};

export const listPropertyInquiries = async (req, res) => {
  try {
    const user = req.user || {};
    const filter = {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (String(user.role || '').toLowerCase() !== 'admin') {
      filter.userId = String(user.id);
    }
    const items = await ContactRequest.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items.map(normalizePropertyInquiry) });
  } catch (error) {
    console.error('List property inquiries failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list property inquiries.' });
  }
};

export const updatePropertyInquiry = async (req, res) => {
  try {
    const user = req.user || {};
    const { id } = req.params || {};
    const updates = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Id required.' });

    const record = await ContactRequest.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Not found.' });

    if (String(user.role || '').toLowerCase() !== 'admin' && String(record.userId || '') !== String(user.id || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    if (updates.status) record.status = updates.status;
    if (updates.message) record.message = updates.message;
    if (updates.name) record.name = updates.name;
    if (updates.fullName) record.fullName = updates.fullName;
    if (updates.preferredContactMethod) record.preferredContactMethod = updates.preferredContactMethod;
    record.updatedAt = new Date();
    await record.save();
    return res.json({ success: true, data: normalizePropertyInquiry(record.toObject ? record.toObject() : record) });
  } catch (error) {
    console.error('Update property inquiry failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update property inquiry.' });
  }
};

export const deletePropertyInquiry = async (req, res) => {
  try {
    const user = req.user || {};
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Id required.' });

    const record = await ContactRequest.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Not found.' });

    if (String(user.role || '').toLowerCase() !== 'admin' && String(record.userId || '') !== String(user.id || '')) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    await ContactRequest.findByIdAndDelete(id);
    return res.json({ success: true, data: null });
  } catch (error) {
    console.error('Delete property inquiry failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete property inquiry.' });
  }
};

export const batchPropertyInquiries = async (req, res) => {
  try {
    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    const created = [];
    for (const row of records) {
      const item = await ContactRequest.create({
        fullName: row.fullName || row.name || '',
        name: row.name || row.fullName || '',
        email: row.email || '',
        phone: row.phone || '',
        propertyId: row.propertyId || '',
        propertyName: row.propertyName || row.propertyTitle || '',
        propertyTitle: row.propertyTitle || row.propertyName || '',
        preferredContactMethod: row.preferredContactMethod || 'Email',
        message: row.message || '',
        inquiryType: row.inquiryType || 'Property Inquiry',
        status: row.status || 'New',
        userId: req.user?.id || row.userId || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      created.push(normalizePropertyInquiry(item.toObject ? item.toObject() : item));
    }
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Batch property inquiry failed', error);
    return res.status(500).json({ success: false, message: 'Unable to store property inquiries.' });
  }
};
