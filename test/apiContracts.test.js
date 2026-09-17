import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase } from '../src/config/database.js';

// Ensure database is connected for controller tests (uses in-memory fallback)
await connectDatabase();

import { createRentRecord, listRentRecords } from '../src/controllers/rentController.js';
import { createMaintenanceRequest, listMaintenanceRequests } from '../src/controllers/maintenanceController.js';
import { updatePaymentStatus } from '../src/controllers/paymentController.js';
import { createRentalProfile } from '../src/controllers/rentalController.js';
import { createNotification } from '../src/controllers/notificationController.js';

const makeRes = () => {
  const res = {};
  res.status = (code) => {
    res.code = code;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

test('rent API contract includes record creation and listing support', async () => {
  const req = {
    user: { id: 'u-1', name: 'User One', email: 'user@example.com' },
    body: { propertyId: 'p-1', propertyName: 'DHA Villa', monthlyRent: 50000, paid: 30000, dueDate: '2026-09-05', month: 'September 2026' },
  };

  const res = makeRes();
  await createRentRecord(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'u-1');

  const listRes = makeRes();
  await listRentRecords({ user: { id: 'u-1' }, query: {} }, listRes);
  assert.equal(listRes.payload.success, true);
  assert.ok(Array.isArray(listRes.payload.data));
});

test('maintenance API contract includes creation and listing support', async () => {
  const req = {
    user: { id: 'u-1', name: 'User One', email: 'user@example.com' },
    body: { propertyId: 'p-1', propertyName: 'DHA Villa', title: 'Leakage', description: 'Kitchen sink leak', category: 'Plumbing' },
  };

  const res = makeRes();
  await createMaintenanceRequest(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'u-1');

  const listRes = makeRes();
  await listMaintenanceRequests({ user: { id: 'u-1' }, query: {} }, listRes);
  assert.equal(listRes.payload.success, true);
  assert.ok(Array.isArray(listRes.payload.data));
});

test('payment status updates support approve and reject actions', async () => {
  const req = { params: { id: 'payment-1' }, body: { status: 'Approved', reason: 'verified' } };
  const res = makeRes();

  await updatePaymentStatus(req, res);

  assert.equal(res.code, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.status, 'Approved');
});

test('tenant profiles can be created without a profile image when core tenant data is present', async () => {
  const req = {
    user: { id: 'u-rental-1', name: 'Rental User', email: 'rent@example.com' },
    body: {
      fullName: 'Rental User',
      email: 'rent@example.com',
      phone: '+923001234567',
      currentAddress: 'Block A, Gulshan, Karachi',
      city: 'Karachi',
      occupation: 'Software Engineer',
      emergencyContactName: 'Ali User',
      emergencyContactPhone: '+923001234568',
      propertyId: 'p-rent-1',
      propertyName: 'Sky Residences',
      propertyType: 'Apartment',
      status: 'Pending',
      profileStatus: 'Profile Complete',
    },
  };

  const res = makeRes();
  await createRentalProfile(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'u-rental-1');
  assert.equal(res.payload.data.profileStatus, 'Profile Complete');
});

test('booking and payment payloads keep the real frontend fields required by RMS', async () => {
  const bookingReq = {
    user: { id: 'u-2', name: 'Jane Doe', email: 'jane@example.com' },
    body: {
      propertyId: 'p-10',
      propertyTitle: 'Garden Residency',
      customerName: 'Jane Doe',
      customerPhone: '+923001234567',
      bookingDate: '2026-09-10',
      visitDate: '2026-09-12',
      amount: 35000,
      notes: 'Need a 2-bedroom family flat',
      bookingStatus: 'Pending',
      paymentStatus: 'Pending',
    },
  };

  const bookingRes = makeRes();
  await createRentRecord({
    user: bookingReq.user,
    body: { propertyId: 'p-10', propertyName: 'Garden Residency', monthlyRent: 35000, paid: 0, dueDate: '2026-09-10', month: 'September 2026' },
  }, makeRes());

  const createBooking = (await import('../src/controllers/bookingController.js')).createBooking;
  await createBooking(bookingReq, bookingRes);

  assert.equal(bookingRes.code, 201);
  assert.equal(bookingRes.payload.success, true);
  assert.equal(bookingRes.payload.data.propertyTitle, 'Garden Residency');
  assert.equal(bookingRes.payload.data.customerName, 'Jane Doe');
  assert.equal(bookingRes.payload.data.paymentStatus, 'Pending');

  const paymentReq = {
    user: { id: 'u-2', name: 'Jane Doe', email: 'jane@example.com' },
    body: {
      bookingId: 'bk-2026-001',
      propertyId: 'p-10',
      propertyName: 'Garden Residency',
      amount: 12000,
      paymentType: 'Advance',
      transactionId: 'TXN-001',
      status: 'Approved',
    },
  };

  const paymentRes = makeRes();
  const { createPayment } = await import('../src/controllers/paymentController.js');
  await createPayment(paymentReq, paymentRes);

  assert.equal(paymentRes.code, 201);
  assert.equal(paymentRes.payload.success, true);
  assert.equal(paymentRes.payload.data.propertyName, 'Garden Residency');
  assert.equal(paymentRes.payload.data.status, 'Approved');
});

test('authenticated users can create notifications without sending a userId in the payload', async () => {
  const req = {
    user: { id: 'user-portal-1', name: 'Portal User', email: 'portal@example.com' },
    body: {
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed.',
      entityType: 'BOOKING',
      actionType: 'BOOKING_CONFIRMED',
      status: 'Notice',
    },
  };

  const res = makeRes();
  await createNotification(req, res);

  assert.equal(res.code, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.data.userId, 'user-portal-1');
  assert.equal(res.payload.data.userName, 'Portal User');
  assert.equal(res.payload.data.title, 'Booking Confirmed');
});
