const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const WholesalerApplication = require('../models/WholesalerApplication');
const { sendWholesalerApproval, sendWholesalerRejection } = require('../services/email.service');
const { sendShippingUpdate } = require('../services/whatsapp.service');

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/admin/dashboard
 * @access  Admin
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      todaysOrders,
      todaysRevenue,
      pendingOrders,
      lowStockProducts,
      totalCustomers,
      totalWholesalers,
      pendingApplications,
      dailySales,
    ] = await Promise.all([
      // Today's orders count
      Order.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),

      // Today's revenue
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'cancelled' } } },
        { $group: { _id: null, revenue: { $sum: '$total' } } },
      ]),

      // Pending orders count
      Order.countDocuments({ status: 'pending' }),

      // Low stock products count (totalStock < 5)
      Product.countDocuments({ active: true, totalStock: { $lt: 5 } }),

      // Total customers
      User.countDocuments({ role: 'customer' }),

      // Total wholesalers
      User.countDocuments({ role: 'wholesaler' }),

      // Pending wholesaler applications
      WholesalerApplication.countDocuments({ status: 'pending' }),

      // Last 30 days daily sales data
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', revenue: 1, orders: 1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        todaysOrders,
        todaysRevenue: todaysRevenue.length > 0 ? todaysRevenue[0].revenue : 0,
        pendingOrders,
        lowStockProducts,
        totalCustomers,
        totalWholesalers,
        pendingApplications,
        dailySales,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all orders with filters and pagination
 * @route   GET /api/admin/orders
 * @access  Admin
 */
const getAllOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.userType) {
      filter.userType = req.query.userType;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        filter.createdAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        const dateTo = new Date(req.query.dateTo);
        dateTo.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = dateTo;
      }
    }
    if (req.query.search) {
      filter.orderNumber = { $regex: req.query.search, $options: 'i' };
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('user', 'name phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
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
 * @desc    Update order status (admin)
 * @route   PUT /api/admin/orders/:id/status
 * @access  Admin
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, note, trackingNumber, courierPartner } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const validStatuses = ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = await Order.findById(req.params.id).populate('user', 'name phone email');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    order.statusHistory.push({
      status,
      note: note || `Status updated to ${status}`,
      updatedBy: req.user.id,
    });

    if (status === 'shipped') {
      if (trackingNumber) order.trackingNumber = trackingNumber;
      if (courierPartner) order.courierPartner = courierPartner;

      // Trigger WhatsApp shipping update (non-blocking)
      if (trackingNumber) {
        sendShippingUpdate(order, order.user).catch((err) =>
          console.error('WhatsApp shipping update failed:', err.message)
        );
      }
    }

    // If admin cancels, restore stock
    if (status === 'cancelled') {
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
      order.cancelledBy = 'admin';
      order.cancelledAt = new Date();
      order.cancelReason = note || 'Cancelled by admin';
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Confirm COD order
 * @route   PUT /api/admin/orders/:id/confirm-cod
 * @access  Admin
 */
const confirmCOD = async (req, res, next) => {
  try {
    const { notes } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.codConfirmed = true;
    order.codConfirmedBy = req.user.id;
    order.codConfirmedAt = new Date();
    order.codNotes = notes || '';
    order.status = 'confirmed';
    order.statusHistory.push({
      status: 'confirmed',
      note: 'COD confirmed by admin',
      updatedBy: req.user.id,
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'COD order confirmed',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get wholesaler applications with status filter
 * @route   GET /api/admin/wholesaler-applications
 * @access  Admin
 */
const getWholesalerApplications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const [applications, total] = await Promise.all([
      WholesalerApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WholesalerApplication.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: applications,
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
 * @desc    Approve wholesaler application
 * @route   PUT /api/admin/wholesaler-applications/:id/approve
 * @access  Admin
 */
const approveWholesaler = async (req, res, next) => {
  try {
    const application = await WholesalerApplication.findById(req.params.id).select('+password');
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Application already ${application.status}` });
    }

    // Check if user with same email or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email: application.email }, { phone: application.phone }],
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email or phone already exists',
      });
    }

    // Create wholesaler user
    // IMPORTANT: Use `new User()` + `save({ validateBeforeSave: false })` with
    // markModified trick, OR use insertMany to BYPASS the pre-save hash hook.
    // The application.password is ALREADY hashed, so we must not re-hash it.
    const wholesaler = new User({
      name: application.name,
      email: application.email,
      phone: application.phone,
      password: 'temp-placeholder', // will be overwritten below
      role: 'wholesaler',
      status: 'active',
      businessDetails: {
        shopName: application.shopName,
        gstNumber: application.gstNumber || '',
        businessProofUrl: application.businessProofUrl || '',
        shopPhotoUrl: application.shopPhotoUrl || '',
        aadharUrl: application.aadharUrl || '',
        city: application.city,
      },
    });
    // Save once — pre-save hook hashes the placeholder
    await wholesaler.save();
    // Now directly update password to the already-hashed value (bypassing hook)
    await User.updateOne(
      { _id: wholesaler._id },
      { $set: { password: application.password } }
    );

    // Mark application as approved
    application.status = 'approved';
    application.reviewedBy = req.user.id;
    application.reviewedAt = new Date();
    application.reviewNote = req.body.note || 'Approved';
    await application.save();

    // Send approval email (non-blocking)
    sendWholesalerApproval(application).catch((err) =>
      console.error('Wholesaler approval email failed:', err.message)
    );

    res.status(200).json({
      success: true,
      message: 'Wholesaler application approved and user account created',
      data: { application, wholesaler: { _id: wholesaler._id, name: wholesaler.name, email: wholesaler.email } },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reject wholesaler application
 * @route   PUT /api/admin/wholesaler-applications/:id/reject
 * @access  Admin
 */
const rejectWholesaler = async (req, res, next) => {
  try {
    const { reviewNote } = req.body;

    const application = await WholesalerApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Application already ${application.status}` });
    }

    application.status = 'rejected';
    application.reviewedBy = req.user.id;
    application.reviewNote = reviewNote || '';
    application.reviewedAt = new Date();
    await application.save();

    // Send rejection email (non-blocking)
    sendWholesalerRejection(application).catch((err) =>
      console.error('Wholesaler rejection email failed:', err.message)
    );

    res.status(200).json({
      success: true,
      message: 'Wholesaler application rejected',
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all customers (paginated)
 * @route   GET /api/admin/customers
 * @access  Admin
 */
const getAllCustomers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      User.find({ role: 'customer' })
        .select('-cart -wishlist -otp -otpExpiry -resetPasswordToken -resetPasswordExpiry')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ role: 'customer' }),
    ]);

    res.status(200).json({
      success: true,
      data: customers,
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
 * @desc    Get all wholesalers (paginated)
 * @route   GET /api/admin/wholesalers
 * @access  Admin
 */
const getAllWholesalers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [wholesalers, total] = await Promise.all([
      User.find({ role: 'wholesaler' })
        .select('-cart -wishlist -otp -otpExpiry -resetPasswordToken -resetPasswordExpiry')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments({ role: 'wholesaler' }),
    ]);

    res.status(200).json({
      success: true,
      data: wholesalers,
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
 * @desc    Block or unblock a user
 * @route   PUT /api/admin/users/:id/toggle-status
 * @access  Admin
 */
const toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot change admin status' });
    }

    user.status = user.status === 'blocked' ? 'active' : 'blocked';
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.status === 'blocked' ? 'blocked' : 'unblocked'} successfully`,
      data: { _id: user._id, name: user.name, status: user.status },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get sales report aggregated by date range
 * @route   GET /api/admin/reports/sales
 * @access  Admin
 */
const getSalesReport = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    if (!dateFrom || !dateTo) {
      return res.status(400).json({ success: false, message: 'dateFrom and dateTo are required' });
    }

    const startDate = new Date(dateFrom);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);

    const report = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          items: { $sum: { $size: '$items' } },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: '$_id', revenue: 1, orders: 1, items: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get products with low stock
 * @route   GET /api/admin/products/low-stock
 * @access  Admin
 */
const getLowStockProducts = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 5;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = { active: true, totalStock: { $lt: threshold } };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .select('sku name images totalStock stock sizes')
        .sort({ totalStock: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: products,
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

module.exports = {
  getDashboardStats,
  getAllOrders,
  updateOrderStatus,
  confirmCOD,
  getWholesalerApplications,
  approveWholesaler,
  rejectWholesaler,
  getAllCustomers,
  getAllWholesalers,
  toggleUserStatus,
  getSalesReport,
  getLowStockProducts,
};
