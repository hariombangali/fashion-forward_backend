const Coupon = require('../models/Coupon');

/**
 * @desc    Validate a coupon code against user and subtotal
 * @route   POST /api/coupons/validate
 */
const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }
    if (subtotal === undefined || subtotal === null) {
      return res.status(400).json({ success: false, message: 'Subtotal is required' });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return res.status(400).json({
        success: false,
        data: { valid: false, reason: 'Invalid coupon code' },
      });
    }

    const validation = coupon.isValidFor(
      req.user?._id,
      req.user?.role,
      Number(subtotal)
    );

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        data: {
          valid: false,
          reason: validation.reason,
        },
      });
    }

    const discount = coupon.calculateDiscount(Number(subtotal));

    res.json({
      success: true,
      data: {
        valid: true,
        coupon: {
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minOrderValue: coupon.minOrderValue,
        },
        discount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — list all coupons
 * @route   GET /api/coupons/admin
 */
const getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — get single coupon by id
 * @route   GET /api/coupons/admin/:id
 */
const getCouponById = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id).lean();
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, data: coupon });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — create coupon
 * @route   POST /api/coupons
 */
const createCoupon = async (req, res, next) => {
  try {
    const body = { ...req.body };

    // Uppercase the code
    if (body.code) {
      body.code = body.code.toUpperCase().trim();
    }

    // Check uniqueness
    const existing = await Coupon.findOne({ code: body.code });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A coupon with this code already exists' });
    }

    const coupon = await Coupon.create(body);
    res.status(201).json({ success: true, data: coupon, message: 'Coupon created' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — update coupon
 * @route   PUT /api/coupons/:id
 */
const updateCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    const body = { ...req.body };

    // Uppercase the code if provided
    if (body.code) {
      body.code = body.code.toUpperCase().trim();

      // Check uniqueness if code changed
      if (body.code !== coupon.code) {
        const existing = await Coupon.findOne({ code: body.code });
        if (existing) {
          return res.status(400).json({ success: false, message: 'A coupon with this code already exists' });
        }
      }
    }

    Object.assign(coupon, body);
    await coupon.save();
    res.json({ success: true, data: coupon, message: 'Coupon updated' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — delete coupon
 * @route   DELETE /api/coupons/:id
 */
const deleteCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Admin — toggle coupon active status
 * @route   PUT /api/coupons/:id/toggle
 */
const toggleCouponActive = async (req, res, next) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }
    coupon.active = !coupon.active;
    await coupon.save();
    res.json({ success: true, data: coupon });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Public — get active, visible coupons for homepage display
 * @route   GET /api/coupons/public
 */
const getPublicActiveCoupons = async (req, res, next) => {
  try {
    const now = new Date();

    const coupons = await Coupon.find({
      active: true,
      expiresAt: { $gt: now },
      startsAt: { $lte: now },
    })
      .select('code description discountType discountValue minOrderValue expiresAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: coupons });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  validateCoupon,
  getCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCouponActive,
  getPublicActiveCoupons,
};
