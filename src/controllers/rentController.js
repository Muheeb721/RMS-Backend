import mongoose from 'mongoose';
import RentRecord from '../models/RentRecord.js';

const getMemoryRentRecords = () => {
  globalThis.__rmsRentRecords ??= [];
  return globalThis.__rmsRentRecords;
};

export const createRentRecord = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const { propertyId, propertyName, monthlyRent, paid, dueDate, month, status } = req.body || {};
    const amount = Number(monthlyRent || 0);
    const paidAmount = Number(paid || 0);
    const payload = {
      userId: user.id,
      propertyId: propertyId || '',
      propertyName: propertyName || '',
      userName: user.name || '',
      monthlyRent: amount,
      paid: paidAmount,
      remaining: Math.max(0, amount - paidAmount),
      dueDate: dueDate || new Date(),
      month: month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      status: status || (paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'),
      paymentStatus: status || (paidAmount >= amount ? 'Paid' : paidAmount > 0 ? 'Partial' : 'Pending'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (mongoose.connection.readyState !== 1) {
      const records = getMemoryRentRecords();
      const record = { ...payload, _id: `rent-${Date.now()}-${records.length + 1}` };
      records.unshift(record);
      return res.status(201).json({ success: true, data: record });
    }

    const record = await RentRecord.create(payload);
    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Create rent record failed', error);
    const records = getMemoryRentRecords();
    const record = { ...req.body, userId: req.user?.id || '', _id: `rent-${Date.now()}-${records.length + 1}`, createdAt: new Date(), updatedAt: new Date() };
    records.unshift(record);
    return res.status(201).json({ success: true, data: record });
  }
};

export const listRentRecords = async (req, res) => {
  try {
    const user = req.user || {};
    const filter = user && user.id ? { userId: user.id } : {};
    if (mongoose.connection.readyState !== 1) {
      const items = getMemoryRentRecords().filter((record) => (!user?.id ? true : record.userId === user.id));
      return res.json({ success: true, data: items });
    }
    const items = await RentRecord.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List rent records failed', error);
    const items = getMemoryRentRecords().filter((record) => (!req.user?.id ? true : record.userId === req.user.id));
    return res.json({ success: true, data: items });
  }
};

export const updateRentRecord = async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState !== 1) {
      const records = getMemoryRentRecords();
      const idx = records.findIndex((record) => String(record._id) === String(id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Rent record not found.' });
      const updated = { ...records[idx], ...req.body, updatedAt: new Date() };
      records[idx] = updated;
      return res.json({ success: true, data: updated });
    }
    const record = await RentRecord.findByIdAndUpdate(id, { ...req.body, updatedAt: new Date() }, { new: true }).lean();
    if (!record) return res.status(404).json({ success: false, message: 'Rent record not found.' });
    return res.json({ success: true, data: record });
  } catch (error) {
    console.error('Update rent record failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update rent record.' });
  }
};
