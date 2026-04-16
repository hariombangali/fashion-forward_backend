const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { calculateItemPrice, calculateShipping, validateMOQ } = require('../services/pricing.service');
const { generateBillPDF } = require('../services/pdf.service');
const { sendOrderAlertToAdmin, sendOrderConfirmToCustomer, sendShippingUpdate } = require('../services/whatsapp.service');
const { sendOrderConfirmation } = require('../services/email.service');

/**
 * @desc    Create a new order from cart or direct items
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = async (req, res, next) => {
  try {
    const { items: directItems, shippingAddress, couponCode } = req.body;
    const user = await User.findById(req.user.id).populate('cart.product');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }

    // Determine items source: direct items or user cart
    let rawItems = directItems;
    if (!rawItems || rawItems.length === 0) {
      if (!user.cart || user.cart.length === 0) {
        return res.status(400).json({ success: false, message: 'No items to order. Provide items or add to cart.' });
      }
      rawItems = user.cart.map((ci) => ({
        product: ci.product._id || ci.product,
        size: ci.size,
        color: ci.color,
        quantity: ci.quantity,
      }));
    }

    const userType = user.role === 'wholesaler' ? 'wholesaler' : 'customer';

    // Validate items, check stock, calculate prices
    const orderItems = [];
    const stockUpdates = [];

    for (const item of rawItems) {
      const product = await Product.findById(item.product);
      if (!product || !product.active) {
        return res.status(400).json({
          success: false,
          message: `Product not found or inactive: ${item.product}`,
        });
      }

      const size = item.size;
      const currentStock = product.stock.get(size) || 0;
      if (currentStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}" size ${size}. Available: ${currentStock}, Requested: ${item.quantity}`,
        });
      }

      // MOQ validation for wholesalers
      if (userType === 'wholesaler') {
        const moqCheck = validateMOQ(product, item.quantity);
        if (!moqCheck.valid) {
          return res.status(400).json({
            success: false,
            message: `Minimum order quantity for "${product.name}" is ${moqCheck.moq}. You requested ${item.quantity}.`,
          });
        }
      }

      // Calculate price
      const pricePerPiece = calculateItemPrice(product, item.quantity, userType);
      const subtotal = pricePerPiece * item.quantity;

      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images && product.images.length > 0 ? product.images[0] : '',
        sku: product.sku,
        size,
        color: item.color || '',
        quantity: item.quantity,
        pricePerPiece,
        subtotal,
      });

      stockUpdates.push({
        productId: product._id,
        size,
        quantity: item.quantity,
      });
    }

    // Calculate totals
    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const shippingCharge = calculateShipping(subtotal, userType);

    // Apply coupon discount if provided
    let discount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() });
      if (!coupon) {
        return res.status(400).json({ success: false, message: 'Invalid coupon code' });
      }
      const validation = coupon.isValidFor(user._id, user.role, subtotal);
      if (!validation.valid) {
        return res.status(400).json({ success: false, message: validation.reason });
      }
      discount = coupon.calculateDiscount(subtotal);
      appliedCoupon = coupon;
    }

    const total = subtotal + shippingCharge - discount;

    // Generate order number
    const orderNumber = await Order.generateOrderNumber();

    // Create order
    const order = await Order.create({
      orderNumber,
      user: user._id,
      userType,
      items: orderItems,
      shippingAddress,
      subtotal,
      shippingCharge,
      discount,
      couponCode: couponCode ? couponCode.toUpperCase() : undefined,
      total,
      status: 'pending',
      statusHistory: [{ status: 'pending', note: 'Order placed' }],
    });

    // Decrement stock atomically
    for (const update of stockUpdates) {
      await Product.updateOne(
        { _id: update.productId },
        {
          $inc: {
            [`stock.${update.size}`]: -update.quantity,
            totalStock: -update.quantity,
          },
        }
      );
    }

    // Record coupon usage
    if (appliedCoupon && discount > 0) {
      await Coupon.findByIdAndUpdate(appliedCoupon._id, {
        $inc: { timesUsed: 1 },
        $push: {
          usedBy: {
            user: user._id,
            order: order._id,
            discountAmount: discount,
            usedAt: new Date(),
          },
        },
      });
    }

    // Clear user cart
    user.cart = [];
    await user.save();

    // Trigger notifications (non-blocking)
    sendOrderAlertToAdmin(order).catch((err) => console.error('WhatsApp admin alert failed:', err.message));
    sendOrderConfirmToCustomer(order, user).catch((err) => console.error('WhatsApp customer confirm failed:', err.message));
    sendOrderConfirmation(order, user).catch((err) => console.error('Email confirmation failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get logged-in user's orders (paginated, newest first)
 * @route   GET /api/orders/my
 * @access  Private
 */
const getMyOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({ user: req.user.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ user: req.user.id }),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single order by ID (owner or admin)
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check ownership or admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this order' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel order (customer — only if pending or confirmed)
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check ownership
    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel order with status "${order.status}". Only pending or confirmed orders can be cancelled.`,
      });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product },
        {
          $inc: {
            [`stock.${item.size}`]: item.quantity,
            totalStock: item.quantity,
          },
        }
      );
    }

    order.status = 'cancelled';
    order.cancelReason = reason || '';
    order.cancelledBy = 'customer';
    order.cancelledAt = new Date();
    order.statusHistory.push({
      status: 'cancelled',
      note: reason || 'Cancelled by customer',
      updatedBy: req.user.id,
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download order bill as PDF
 * @route   GET /api/orders/:id/bill
 * @access  Private
 */
const downloadBill = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email phone addresses');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check ownership or admin
    if (order.user._id.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to download this bill' });
    }

    const pdfBuffer = await generateBillPDF(order, order.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bill-${order.orderNumber}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  downloadBill,
};
