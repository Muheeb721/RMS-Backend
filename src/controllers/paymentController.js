import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import UserNotification from '../models/UserNotification.js';
import { logAdminAction } from '../services/activityService.js';

const getMemoryPayments = () => {
  globalThis.__rmsPayments ??= [];
  return globalThis.__rmsPayments;
};

const normalizePaymentStatus = (value) => {
  const status = String(value || '').trim();
  if (!status) return 'Pending';
  const normalized = status.toLowerCase();
  if (['approved', 'paid', 'success', 'completed'].includes(normalized)) return 'Approved';
  if (['rejected', 'failed', 'cancelled', 'declined'].includes(normalized)) return 'Rejected';
  if (['pending', 'processing'].includes(normalized)) return 'Pending';
  return status;
};

export const createPayment = async (req, res) => {
  try {
    const user = req.user || {};
    const body = req.body || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });

    const totalAmount = Number(body.totalAmount || body.amount || body.total || 0);
    const amountPaid = Number(body.amountPaid || body.amount || 0);
    const advanceAmount = Number(body.advanceAmount || 0);
    const propertyName = body.propertyName || body.propertyTitle || '';
    const propertyType = body.propertyType || body.type || '';
    const normalizedStatus = normalizePaymentStatus(body.status || 'Completed');

    const payload = {
      userId: user.id,
      userName: body.userName || body.customerName || user.name || '',
      userEmail: body.userEmail || body.email || user.email || '',
      userPhone: body.userPhone || body.phone || '',
      bookingId: body.bookingId || '',
      propertyId: body.propertyId || '',
      propertyName,
      propertyType,
      amount: Number(body.amount || amountPaid || totalAmount || 0),
      totalAmount,
      amountPaid,
      advanceAmount,
      remainingAmount: Math.max(0, totalAmount - amountPaid),
      paymentType: body.paymentType || body.method || 'Advance',
      method: body.method || body.paymentType || 'Pending',
      transactionId: body.transactionId || body.reference || '',
      reference: body.reference || body.transactionId || '',
      status: normalizedStatus,
      reason: body.reason || '',
      notes: body.notes || '',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (mongoose.connection.readyState !== 1) {
      const payments = getMemoryPayments();
      const payment = { ...payload, _id: `payment-${Date.now()}-${payments.length + 1}` };
      payments.unshift(payment);
      return res.status(201).json({ success: true, data: payment });
    }

    const payment = await Payment.create(payload);
    try {
      const adminUser = await User.findOne({ role: 'admin' }).lean();
      if (adminUser && adminUser._id) {
        await UserNotification.create({
          userId: adminUser._id.toString(),
          userName: adminUser.name || 'Admin',
          actorType: 'system',
          actorName: 'System',
          entityType: 'PAYMENT',
          entityId: payment._id.toString(),
          actionType: 'PAYMENT_SUBMITTED',
          title: 'Payment Submitted',
          message: `Payment for ${payment.propertyName || 'a property'} was submitted by user ${payment.userId}.`,
          isRead: false,
          createdAt: new Date(),
        });
      }

      await logAdminAction({
        adminId: 'system',
        adminName: 'System',
        userId: payment.userId,
        userName: payment.userName || '',
        actionType: 'PAYMENT_SUBMITTED',
        entityType: 'PAYMENT',
        entityId: payment._id.toString(),
        message: `Your payment for ${payment.propertyName || 'the property'} has been submitted.`,
        description: `Payment ${payment._id} submitted by user ${payment.userId}`,
        propertyName: payment.propertyName || '',
        newStatus: payment.status || 'Submitted',
      });
    } catch (e) {
      console.warn('Payment notification creation failed:', e && e.message ? e.message : e);
    }
    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    console.error('Create payment failed', error);
    const payments = getMemoryPayments();
    const payment = { ...req.body, userId: req.user?.id || '', _id: `payment-${Date.now()}-${payments.length + 1}`, status: normalizePaymentStatus(req.body?.status || 'Completed'), createdAt: new Date() };
    payments.unshift(payment);
    return res.status(201).json({ success: true, data: payment });
  }
};

export const listMyPayments = async (req, res) => {
  try {
    const user = req.user || {};
    if (!user || !user.id) return res.status(401).json({ success: false, message: 'Authentication required.' });
    if (mongoose.connection.readyState !== 1) {
      const items = getMemoryPayments().filter((payment) => payment.userId === user.id);
      return res.json({ success: true, data: items });
    }
    const items = await Payment.find({ userId: user.id }).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List payments failed', error);
    const items = getMemoryPayments().filter((payment) => payment.userId === req.user?.id);
    return res.json({ success: true, data: items });
  }
};

export const listAllPayments = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ success: true, data: getMemoryPayments() });
    }
    const items = await Payment.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: items });
  } catch (error) {
    console.error('List all payments failed', error);
    return res.status(500).json({ success: false, message: 'Unable to list payments.' });
  }
};

export const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params || {};
    const { status, reason } = req.body || {};
    if (mongoose.connection.readyState !== 1) {
      const payments = getMemoryPayments();
      const target = payments.find((item) => String(item._id) === String(id));
      if (!target) {
        const fallback = payments.find((item) => String(item.transactionId || '') === String(req.body?.transactionId || ''));
        if (!fallback) {
          const generated = {
            _id: String(id || `payment-${Date.now()}`),
            userId: req.user?.id || '',
            bookingId: '',
            propertyId: '',
            amount: Number(req.body?.amount || 0),
            paymentType: req.body?.paymentType || 'Advance',
            transactionId: req.body?.transactionId || '',
            status: normalizePaymentStatus(status || 'Approved'),
            reason: reason || '',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          payments.unshift(generated);
          return res.status(200).json({ success: true, data: generated, previousStatus: 'Pending' });
        }
        const previousStatus = fallback.status;
        fallback.status = normalizePaymentStatus(status || 'Approved');
        fallback.reason = reason || fallback.reason || '';
        fallback.updatedAt = new Date();
        return res.status(200).json({ success: true, data: fallback, previousStatus });
      }
      const previousStatus = target.status;
      target.status = normalizePaymentStatus(status || 'Approved');
      target.reason = reason || target.reason || '';
      target.updatedAt = new Date();
      return res.status(200).json({ success: true, data: target, previousStatus });
    }

    const payment = id ? await Payment.findById(id) : null;
    if (!payment) {
      const fallback = await Payment.findOne({ transactionId: req.body?.transactionId || '' });
      if (!fallback) return res.status(404).json({ success: false, message: 'Payment not found.' });
      payment = fallback;
    }

    const previousStatus = payment.status;
    payment.status = normalizePaymentStatus(status || 'Approved');
    payment.reason = reason || payment.reason || '';
    payment.updatedAt = new Date();
    await payment.save();

    return res.status(200).json({ success: true, data: payment, previousStatus });
  } catch (error) {
    console.error('Update payment status failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update payment status.' });
  }
};

export const updatePayment = async (req, res) => {
  try {
    const { id } = req.params || {};
    const updates = req.body || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing payment id.' });

    if (mongoose.connection.readyState !== 1) {
      const payments = getMemoryPayments();
      const target = payments.find((p) => String(p._id) === String(id) || String(p.id) === String(id));
      if (!target) return res.status(404).json({ success: false, message: 'Payment not found.' });
      Object.assign(target, updates, { updatedAt: new Date() });
      return res.json({ success: true, data: target });
    }

    const payment = await Payment.findById(id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    Object.keys(updates || {}).forEach((k) => { payment[k] = updates[k]; });
    payment.updatedAt = new Date();
    await payment.save();
    return res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Update payment failed', error);
    return res.status(500).json({ success: false, message: 'Unable to update payment.' });
  }
};

export const deletePayment = async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) return res.status(400).json({ success: false, message: 'Missing payment id.' });

    if (mongoose.connection.readyState !== 1) {
      const payments = getMemoryPayments();
      const idx = payments.findIndex((p) => String(p._id) === String(id) || String(p.id) === String(id));
      if (idx === -1) return res.status(404).json({ success: false, message: 'Payment not found.' });
      const removed = payments.splice(idx, 1)[0];
      return res.json({ success: true, data: removed });
    }

    const removed = await Payment.findByIdAndDelete(id).lean();
    return res.json({ success: true, data: removed });
  } catch (error) {
    console.error('Delete payment failed', error);
    return res.status(500).json({ success: false, message: 'Unable to delete payment.' });
  }
};
