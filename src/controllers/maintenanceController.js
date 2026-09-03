import mongoose from 'mongoose';
import Maintenance from '../models/Maintenance.js';

const getMemoryMaintenanceRequests = () => {
  globalThis.__rmsMaintenanceRequests ??= [];
  return globalThis.__rmsMaintenanceRequests;
};

export const createMaintenanceRequest = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const { propertyId, propertyName, title, description, category, priority, status } = req.body || {};
    const payload = {
      userId: user.id,
      userName: user.name || '',
      propertyId: propertyId || '',
      propertyName: propertyName || '',
      title: title || 'Maintenance Request',
      description: description || '',
      category: category || 'General',
      priority: priority || 'Medium',
      status: status || 'Open',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (mongoose.connection.readyState !== 1) {
      const requests = getMemoryMaintenanceRequests();
      const request = { ...payload, _id: `maintenance-${Date.now()}-${requests.length + 1}` };
      requests.unshift(request);
      return res.status(201).json({ success: true, data: request });
    }

    const request = await Maintenance.create(payload);
    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error('Create maintenance request failed', error);
    const requests = getMemoryMaintenanceRequests();
    const request = { ...req.body, userId: req.user?.id || '', _id: `maintenance-${Date.now()}-${requests.length + 1}`, createdAt: new Date(), updatedAt: new Date() };
    requests.unshift(request);
    return res.status(201).json({ success: true, data: request });
  }
};

export const listMaintenanceRequests = async (req, res) => {
  try {
    const user = req.user || {};
    const filter = user && user.id ? { userId: user.id } : {};
    if (mongoose.connection.readyState !== 1) {
      const items = getMemoryMaintenanceRequests().filter((request) => (!user?.id ? true : request.userId === user.id));
      return res.json({ success: true, data: items });
    }
    const items = await Maintenance.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List maintenance requests failed', error);
    const items = getMemoryMaintenanceRequests().filter((request) => (!req.user?.id ? true : request.userId === req.user.id));
    return res.json({ success: true, data: items });
  }
};

export const updateMaintenanceRequest = async (req, res) => {
  try {
    const { id } = req.params;
    if (mongoose.connection.readyState !== 1) {
      const requests = getMemoryMaintenanceRequests();
      const idx = requests.findIndex((request) => String(request._id) === String(id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Maintenance request not found.' });
      const updated = { ...requests[idx], ...req.body, updatedAt: new Date() };
      requests[idx] = updated;
      return res.json({ success: true, data: updated });
    }
    const request = await Maintenance.findByIdAndUpdate(id, { ...req.body, updatedAt: new Date() }, { new: true }).lean();
    if (!request) return res.status(404).json({ success: false, message: 'Maintenance request not found.' });
    return res.json({ success: true, data: request });
  } catch (error) {
    console.error('Update maintenance request failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update maintenance request.' });
  }
};
