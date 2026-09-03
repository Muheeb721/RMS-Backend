import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardSummary } from '../src/controllers/adminController.js';

test('buildDashboardSummary returns totals and recent activity from Mongo-like records', () => {
  const summary = buildDashboardSummary({
    properties: [
      { status: 'Available' },
      { status: 'Available' },
      { status: 'Reserved' },
      { status: 'Sold' },
    ],
    users: [{ _id: '1' }, { _id: '2' }, { _id: '3' }],
    bookings: [{ status: 'Approved' }, { status: 'Pending' }],
    payments: [{ status: 'Paid', amount: 120 }, { status: 'Pending', amount: 50 }],
    activity: [
      { message: 'User signed in', createdAt: '2025-01-01T00:00:00.000Z' },
      { message: 'Admin approved booking', createdAt: '2025-01-02T00:00:00.000Z' },
    ],
  });

  assert.equal(summary.totalProperties, 4);
  assert.equal(summary.availableProperties, 2);
  assert.equal(summary.totalUsers, 3);
  assert.equal(summary.totalBookings, 2);
  assert.equal(summary.totalRevenue, 120);
  assert.equal(summary.pendingPayments, 1);
  assert.equal(summary.recentActivity.length, 2);
});
