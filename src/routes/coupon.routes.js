const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  validateCoupon,
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponActive,
  getPublicActiveCoupons,
} = require('../controllers/coupon.controller');

// Public / optional auth
router.post('/validate', optionalAuth, validateCoupon);
router.get('/public', getPublicActiveCoupons);

// Admin
router.get('/admin', protect, authorize('admin'), getCoupons);
router.get('/admin/:id', protect, authorize('admin'), getCouponById);
router.post('/', protect, authorize('admin'), createCoupon);
router.put('/:id/toggle', protect, authorize('admin'), toggleCouponActive);
router.put('/:id', protect, authorize('admin'), updateCoupon);
router.delete('/:id', protect, authorize('admin'), deleteCoupon);

module.exports = router;
