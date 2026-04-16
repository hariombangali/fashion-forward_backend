const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const {
  createReview,
  getProductReviews,
  deleteReview,
} = require('../controllers/review.controller');

// POST /api/reviews — submit a review (protected)
router.post('/', protect, createReview);

// GET /api/reviews/:productId — get reviews for a product (public)
router.get('/:productId', getProductReviews);

// DELETE /api/reviews/:id — delete a review (protected)
router.delete('/:id', protect, deleteReview);

module.exports = router;
