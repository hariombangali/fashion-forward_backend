const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const { uploadReview } = require('../config/cloudinary');
const {
  createReview,
  getProductReviews,
  getReviewStats,
  toggleHelpful,
  getMyReviews,
  getReviewable,
  deleteReview,
  adminGetAll,
  adminToggleApproval,
} = require('../controllers/review.controller');

// Optional-auth helper — attaches req.user if token is valid, but doesn't reject
const optionalProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return protect(req, res, next);
    }
  } catch (_) {}
  return next();
};

// ── Customer / protected ──────────────────────────────
router.get('/mine', protect, getMyReviews);
router.get('/reviewable', protect, getReviewable);
router.post('/', protect, uploadReview.array('images', 3), createReview);
router.post('/:id/helpful', protect, toggleHelpful);
router.delete('/:id', protect, deleteReview);

// ── Admin ─────────────────────────────────────────────
router.get('/admin/all', protect, authorize('admin'), adminGetAll);
router.patch('/admin/:id/approve', protect, authorize('admin'), adminToggleApproval);

// ── Public ────────────────────────────────────────────
router.get('/stats/:productId', getReviewStats);
router.get('/product/:productId', optionalProtect, getProductReviews);

// Legacy route (kept for backwards compat) — GET /api/reviews/:productId
router.get('/:productId', optionalProtect, getProductReviews);

module.exports = router;
