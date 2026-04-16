const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

/**
 * Recalculate and update a product's ratingsAvg and ratingsCount.
 */
async function recalculateProductRatings(productId) {
  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: '$product',
        ratingsAvg: { $avg: '$rating' },
        ratingsCount: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsAvg: Math.round(result[0].ratingsAvg * 10) / 10,
      ratingsCount: result[0].ratingsCount,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      ratingsAvg: 0,
      ratingsCount: 0,
    });
  }
}

/**
 * @desc    Create a review for a product
 * @route   POST /api/reviews
 * @access  Protected
 */
const createReview = async (req, res, next) => {
  try {
    const { productId, orderId, rating, comment, images } = req.body;

    // Validate required fields
    if (!productId || !orderId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'productId, orderId, and rating are required',
      });
    }

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Check product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    // Check order exists, belongs to user, and is delivered
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only review products from your own orders',
      });
    }

    if (order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        message: 'You can only review products from delivered orders',
      });
    }

    // Create review (unique index will prevent duplicates)
    const review = await Review.create({
      product: productId,
      user: req.user._id,
      order: orderId,
      rating,
      comment,
      images: images || [],
    });

    // Recalculate product ratings
    await recalculateProductRatings(productId);

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted successfully',
    });
  } catch (error) {
    // Handle duplicate review
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product',
      });
    }
    next(error);
  }
};

/**
 * @desc    Get all reviews for a product (paginated, newest first)
 * @route   GET /api/reviews/:productId
 * @access  Public
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid product ID',
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { product: productId };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'name')
        .lean(),
      Review.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        reviews,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a review (own review or admin)
 * @route   DELETE /api/reviews/:id
 * @access  Protected
 */
const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review ID',
      });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Only the review author or an admin can delete
    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this review',
      });
    }

    const productId = review.product;
    await Review.findByIdAndDelete(id);

    // Recalculate product ratings after deletion
    await recalculateProductRatings(productId);

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  deleteReview,
};
