import AdminActionLog from '../models/AdminActionLog.js';
import UserNotification from '../models/UserNotification.js';
import { buildUserNotification, normalizeAction } from '../utils/activity.js';

export const logAdminAction = async ({
  adminId,
  adminName,
  adminEmail,
  userId,
  userName,
  actionType,
  entityType,
  entityId,
  previousStatus,
  newStatus,
  message,
  reason,
  description,
  propertyName,
}) => {
  const normalizedActionType = normalizeAction(actionType);

  const logRecord = await AdminActionLog.create({
    adminId: adminId || 'system-admin',
    adminName: adminName || 'Admin',
    adminEmail: adminEmail || '',
    userId: userId || '',
    userName: userName || '',
    actionType: normalizedActionType,
    entityType: (entityType || 'GENERAL').toUpperCase(),
    entityId: entityId || '',
    previousStatus: previousStatus || '',
    newStatus: newStatus || '',
    message: message || '',
    reason: reason || '',
    description: description || message || '',
    propertyName: propertyName || '',
    createdAt: new Date(),
  });

  const notificationPayload = buildUserNotification({
    actionType: normalizedActionType,
    entityType: (entityType || 'GENERAL').toUpperCase(),
    entityId,
    userId,
    userName,
    adminName,
    propertyName,
    newStatus,
    reason,
    message,
  });

  let notification = null;
  if (userId) {
    notification = await UserNotification.create({
      userId,
      userName: userName || '',
      actorType: 'admin',
      actorName: adminName || 'Admin',
      entityType: (entityType || 'GENERAL').toUpperCase(),
      entityId: entityId || '',
      actionType: normalizedActionType,
      title: notificationPayload.title,
      message: notificationPayload.message,
      reason: reason || '',
      status: newStatus || 'Updated',
      isRead: false,
      createdAt: new Date(),
    });
  }

  return {
    logRecord,
    notification,
  };
};

export const getUserActivity = async (userId) => {
  const logs = await AdminActionLog.find({ userId }).sort({ createdAt: -1 }).lean();
  return logs.map((item) => ({
    id: item._id,
    actionType: item.actionType,
    entityType: item.entityType,
    message: item.message || item.description || 'Admin activity recorded.',
    status: item.newStatus || item.previousStatus || 'Updated',
    createdAt: item.createdAt,
  }));
};

export const getAdminActivity = async () => {
  const logs = await AdminActionLog.find({}).sort({ createdAt: -1 }).lean();
  return logs.map((item) => ({
    id: item._id,
    adminId: item.adminId,
    adminName: item.adminName,
    adminEmail: item.adminEmail,
    userId: item.userId,
    userName: item.userName,
    actionType: item.actionType,
    entityType: item.entityType,
    entityId: item.entityId,
    previousStatus: item.previousStatus,
    newStatus: item.newStatus,
    message: item.message,
    reason: item.reason,
    description: item.description,
    propertyName: item.propertyName,
    createdAt: item.createdAt,
  }));
};
