const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  getDashboardStats, getAllOrders, updateOrderStatus, confirmCOD,
  getWholesalerApplications, approveWholesaler, rejectWholesaler,
  getAllCustomers, getAllWholesalers, toggleUserStatus,
  getSalesReport, getLowStockProducts,
} = require('../controllers/admin.controller');

// All admin routes
router.use(protect, authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Orders
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.put('/orders/:id/confirm-cod', confirmCOD);

// Wholesaler Applications
router.get('/applications', getWholesalerApplications);
router.put('/applications/:id/approve', approveWholesaler);
router.put('/applications/:id/reject', rejectWholesaler);

// Users
router.get('/customers', getAllCustomers);
router.get('/wholesalers', getAllWholesalers);
router.put('/users/:id/toggle-status', toggleUserStatus);

// Reports
router.get('/reports/sales', getSalesReport);
router.get('/reports/low-stock', getLowStockProducts);

module.exports = router;
