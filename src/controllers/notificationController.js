import UserNotification from '../models/UserNotification.js';

export const listNotifications = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const items = await UserNotification.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List notifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list notifications.' });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const count = await UserNotification.countDocuments({ userId: user.id, isRead: { $ne: true } });
    return res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Unread count failed', error);
    return res.status(500).json({ success: false, message: 'Unable to get unread count.' });
  }
};

export const listAdminNotifications = async (req, res) => {
  try {
    const items = await UserNotification.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List admin notifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list admin notifications.' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const user = req.user || {};
    const { id } = req.params || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const note = await UserNotification.findOneAndUpdate({ _id: id, userId: user.id }, { isRead: true }, { new: true }).lean();
    return res.json({ success: true, data: note });
  } catch (error) {
    console.error('Mark notification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to mark notification.' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    await UserNotification.updateMany({ userId: user.id, isRead: { $ne: true } }, { isRead: true });
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all notifications failed', error);
    return res.status(500).json({ success: false, message: 'Unable to mark all notifications.' });
  }
};

export const createNotification = async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.userId) return res.status(400).json({ success: false, message: 'userId is required.' });
    const note = await UserNotification.create({
      userId: payload.userId,
      userName: payload.userName || '',
      actorType: payload.actorType || 'system',
      actorName: payload.actorName || 'System',
      entityType: String(payload.entityType || 'GENERAL').toUpperCase(),
      entityId: payload.entityId || '',
      actionType: String(payload.actionType || 'SYSTEM').toUpperCase(),
      title: payload.title || payload.actionType || 'Notification',
      message: payload.message || '',
      reason: payload.reason || '',
      status: payload.status || 'Notice',
      isRead: payload.isRead === true,
      createdAt: new Date(),
    });

    return res.status(201).json({ success: true, data: note });
  } catch (error) {
    console.error('Create notification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to create notification.' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const user = req.user || {};
    const { id } = req.params || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    const note = await UserNotification.findOneAndDelete({ _id: id, userId: user.id }).lean();
    return res.json({ success: true, data: note });
  } catch (error) {
    console.error('Delete notification failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete notification.' });
  }
};
