import express from 'express';
import {
  createTenant,
  listTenants,
  getTenantDetail,
  updateTenant,
  deleteTenant,
  generateMonthlyRentRecords,
  listRentPayments,
  recordRentPayment,
  updateRentPayment,
  verifyRentPayment,
  getTenantPaymentHistory,
  getOverdueRent,
  getDashboardSummary,
  listRentSettings,
  updateRentSettings,
  getTenantScore,
} from '../controllers/tenantController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.post('/tenants', requireAuth, requireAdmin, createTenant);
router.get('/tenants', requireAuth, listTenants);
router.get('/tenants/summary', requireAuth, requireAdmin, getDashboardSummary);
router.get('/tenants/score/:id', requireAuth, getTenantScore);
router.get('/tenants/:id', requireAuth, getTenantDetail);
router.put('/tenants/:id', requireAuth, requireAdmin, updateTenant);
router.delete('/tenants/:id', requireAuth, requireAdmin, deleteTenant);

router.post('/rent/generate', requireAuth, requireAdmin, generateMonthlyRentRecords);
router.get('/rent', requireAuth, listRentPayments);
router.get('/rent/tenant/:tenantId', requireAuth, getTenantPaymentHistory);
router.get('/rent/overdue', requireAuth, requireAdmin, getOverdueRent);
router.post('/rent/:id/pay', requireAuth, recordRentPayment);
router.put('/rent/:id', requireAuth, requireAdmin, updateRentPayment);
router.put('/rent/:id/verify', requireAuth, requireAdmin, verifyRentPayment);

router.get('/rent-settings', requireAuth, listRentSettings);
router.put('/rent-settings', requireAuth, requireAdmin, updateRentSettings);

export default router;
