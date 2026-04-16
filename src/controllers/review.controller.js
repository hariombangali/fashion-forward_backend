const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');

/**
 * Recalculate and update a product's ratingsAvg and ratingsCount.
 * Only counts approved reviews.
 */
async function recalculateProductRatings(productId) {
  const result = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), approved: true } },
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
 * @desc    Create a review for a product (supports multipart for image uploads)
 * @route   POST /api/reviews
 * @access  Protected
 */
const createReview = async (req, res, next) => {
  try {
    const { productId, orderId, rating, title, comment } = req.body;

    if (!productId || !orderId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'productId, orderId, and rating are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID format' });
    }

    const ratingNum = Number(rating);
    if (ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const [product, order] = await Promise.all([
      Product.findById(productId),
      Order.findById(orderId),
    ]);

    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    if (!order)   return res.status(404).json({ success: false, message: 'Order not found' });

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

    // Verify the product was actually in this order
    const wasInOrder = order.items.some(
      (item) => item.product?.toString() === productId
    );
    if (!wasInOrder) {
      return res.status(400).json({
        success: false,
        message: 'This product was not in the selected order',
      });
    }

    // Handle uploaded images (from multer) or URLs (from body)
    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map((f) => f.path);
    } else if (req.body.images) {
      images = Array.isArray(req.body.images) ? req.body.images : [req.body.images];
    }

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      order: orderId,
      rating: ratingNum,
      title: title?.trim(),
      comment: comment?.trim(),
      images: images.slice(0, 3), // max 3
    });

    await recalculateProductRatings(productId);

    // Populate user name before returning
    await review.populate('user', 'name');

    res.status(201).json({
      success: true,
      data: review,
      message: 'Review submitted successfully',
    });
  } catch (error) {
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
 * @desc    Get all reviews for a product with filters + stats
 * @route   GET /api/reviews/product/:productId
 * @access  Public
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip  = (page - 1) * limit;

    const filter = { product: productId, approved: true };

    // Filter by rating (e.g. ?rating=5)
    if (req.query.rating) {
      const r = parseInt(req.query.rating, 10);
      if (r >= 1 && r <= 5) filter.rating = r;
    }

    // Filter: only with photos
    if (req.query.withPhotos === 'true') {
      filter.images = { $exists: true, $ne: [] };
    }

    // Sort options
    let sort = { createdAt: -1 };
    if (req.query.sort === 'oldest')        sort = { createdAt: 1 };
    else if (req.query.sort === 'highest')  sort = { rating: -1, createdAt: -1 };
    else if (req.query.sort === 'lowest')   sort = { rating: 1, createdAt: -1 };
    else if (req.query.sort === 'helpful')  sort = { 'helpful.length': -1, createdAt: -1 };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'name')
        .lean({ virtuals: true }),
      Review.countDocuments(filter),
    ]);

    // Add helpfulCount to each review
    const enriched = reviews.map((r) => ({
      ...r,
      helpfulCount: r.helpful?.length || 0,
      // Tell current user if they've already marked helpful
      markedHelpful: req.user
        ? r.helpful?.some((u) => u.toString() === req.user._id.toString())
        : false,
    }));

    res.status(200).json({
      success: true,
      data: {
        reviews: enriched,
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
 * @desc    Get rating stats (avg + distribution) for a product
 * @route   GET /api/reviews/stats/:productId
 * @access  Public
 */
const getReviewStats = async (req, res, next) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }

    const stats = await Review.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId), approved: true } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    // Build distribution: { 5: 10, 4: 5, 3: 2, 2: 1, 1: 0 }
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    let sum = 0;
    for (const row of stats) {
      distribution[row._id] = row.count;
      total += row.count;
      sum += row._id * row.count;
    }

    res.json({
      success: true,
      data: {
        average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
        total,
        distribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle helpful vote on a review
 * @route   POST /api/reviews/:id/helpful
 * @access  Protected
 */
const toggleHelpful = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const userId = req.user._id.toString();
    const alreadyHelpful = review.helpful.some((u) => u.toString() === userId);

    if (alreadyHelpful) {
      review.helpful = review.helpful.filter((u) => u.toString() !== userId);
    } else {
      review.helpful.push(req.user._id);
    }

    await review.save();

    res.json({
      success: true,
      data: {
        helpfulCount: review.helpful.length,
        markedHelpful: !alreadyHelpful,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get reviews written by the current user
 * @route   GET /api/reviews/mine
 * @access  Protected
 */
const getMyReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate('product', 'name slug images')
      .lean({ virtuals: true });

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get products the user can review (delivered orders, not yet reviewed)
 * @route   GET /api/reviews/reviewable
 * @access  Protected
 */
const getReviewable = async (req, res, next) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
      status: 'delivered',
    })
      .populate('items.product', 'name slug images')
      .sort({ createdAt: -1 })
      .lean();

    // Get products already reviewed by this user
    const existing = await Review.find({ user: req.user._id }).select('product').lean();
    const reviewedIds = new Set(existing.map((r) => r.product.toString()));

    const reviewable = [];
    for (const order of orders) {
      for (const item of order.items || []) {
        if (!item.product) continue;
        const pid = item.product._id.toString();
        if (reviewedIds.has(pid)) continue;

        reviewable.push({
          orderId: order._id,
          orderNumber: order.orderNumber,
          deliveredAt: order.updatedAt,
          product: item.product,
          size: item.size,
          color: item.color,
        });
      }
    }

    res.json({ success: true, data: reviewable });
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
      return res.status(400).json({ success: false, message: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const productId = review.product;
    await Review.findByIdAndDelete(id);
    await recalculateProductRatings(productId);

    res.json({ success: true, message: 'Review deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin — list all reviews with filters
 * @route   GET /api/reviews/admin/all
 * @access  Admin
 */
const adminGetAll = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.approved === 'false') filter.approved = false;
    if (req.query.approved === 'true')  filter.approved = true;
    if (req.query.rating) filter.rating = parseInt(req.query.rating, 10);

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip).limit(limit)
        .populate('user', 'name email')
        .populate('product', 'name slug images')
        .lean({ virtuals: true }),
      Review.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { reviews, page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Admin — toggle approval on a review
 * @route   PATCH /api/reviews/admin/:id/approve
 * @access  Admin
 */
const adminToggleApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const review = await Review.findById(id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    review.approved = !review.approved;
    await review.save();
    await recalculateProductRatings(review.product);

    res.json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getReviewStats,
  toggleHelpful,
  getMyReviews,
  getReviewable,
  deleteReview,
  adminGetAll,
  adminToggleApproval,
};
