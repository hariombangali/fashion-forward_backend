const { z } = require('zod');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const WholesalerApplication = require('../models/WholesalerApplication');

// --- Zod Schemas ---

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  phone: z.string().min(10, 'Phone must be at least 10 digits').trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().min(10).trim().optional(),
});

const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const addressSchema = z.object({
  label: z.enum(['Home', 'Office', 'Shop', 'Godown', 'Other']).optional(),
  fullName: z.string().min(1, 'Full name is required').trim(),
  phone: z.string().min(10, 'Phone is required').trim(),
  line1: z.string().min(1, 'Address line 1 is required').trim(),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required').trim(),
  state: z.string().min(1, 'State is required').trim(),
  pincode: z.string().min(6, 'Pincode is required').trim(),
  isDefault: z.boolean().optional(),
});

const wholesalerApplySchema = z.object({
  name: z.string().min(2, 'Name is required').trim(),
  email: z.string().email('Invalid email').toLowerCase().trim(),
  phone: z.string().min(10, 'Phone is required').trim(),
  shopName: z.string().min(1, 'Shop name is required').trim(),
  gstNumber: z.string().optional(),
  city: z.string().min(1, 'City is required').trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  message: z.string().optional(),
});

// --- Controllers ---

/**
 * @desc    Register a new customer account
 * @route   POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { phone: data.phone }],
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === data.email
          ? 'Email already registered'
          : 'Phone number already registered',
      });
    }

    const user = await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password, // hashed in pre-save hook
      role: 'customer',
    });

    const token = user.generateToken();

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    next(error);
  }
};

/**
 * @desc    Login with email + password
 * @route   POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await User.findOne({ email: data.email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Check if user is blocked
    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Please contact support.',
      });
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const token = user.generateToken();

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    res.status(200).json({
      success: true,
      data: {
        token,
        user: userObj,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    next(error);
  }
};

/**
 * @desc    Get current logged-in user
 * @route   GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('wishlist', 'name slug images retailPrice retailMRP')
      .populate('cart.product', 'name slug images retailPrice retailMRP stock sizes colors');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile (name, email, phone)
 * @route   PUT /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    // Check for duplicate email/phone if being updated
    if (data.email || data.phone) {
      const conditions = [];
      if (data.email) conditions.push({ email: data.email });
      if (data.phone) conditions.push({ phone: data.phone });

      const existing = await User.findOne({
        _id: { $ne: req.user._id },
        $or: conditions,
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: existing.email === data.email
            ? 'Email already in use'
            : 'Phone number already in use',
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: data },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: user,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    next(error);
  }
};

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const data = changePasswordSchema.parse(req.body);

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isMatch = await user.comparePassword(data.oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    user.password = data.newPassword; // hashed in pre-save hook
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    next(error);
  }
};

/**
 * @desc    Add a new address
 * @route   POST /api/auth/addresses
 */
const addAddress = async (req, res, next) => {
  try {
    // Accept both `line1/line2` and `addressLine1/addressLine2` field names
    const body = { ...req.body };
    if (body.addressLine1 && !body.line1) body.line1 = body.addressLine1;
    if (body.addressLine2 && !body.line2) body.line2 = body.addressLine2;
    delete body.addressLine1;
    delete body.addressLine2;

    const data = addressSchema.parse(body);

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // If this is marked as default, unset others
    if (data.isDefault) {
      user.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    user.addresses.push(data);
    await user.save();

    res.status(201).json({
      success: true,
      data: user.addresses,
      message: 'Address added successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    next(error);
  }
};

/**
 * @desc    Update an existing address
 * @route   PUT /api/auth/addresses/:addressId
 */
const updateAddress = async (req, res, next) => {
  try {
    // Accept both line1/line2 and addressLine1/addressLine2
    const body = { ...req.body };
    if (body.addressLine1 && !body.line1) body.line1 = body.addressLine1;
    if (body.addressLine2 && !body.line2) body.line2 = body.addressLine2;
    delete body.addressLine1;
    delete body.addressLine2;

    const data = addressSchema.parse(body);
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    // If this is marked as default, unset others
    if (data.isDefault) {
      user.addresses.forEach((addr) => { addr.isDefault = false; });
    }

    Object.assign(address, data);
    await user.save();

    res.status(200).json({
      success: true,
      data: user.addresses,
      message: 'Address updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    next(error);
  }
};

/**
 * @desc    Delete an address
 * @route   DELETE /api/auth/addresses/:addressId
 */
const deleteAddress = async (req, res, next) => {
  try {
    const { addressId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }

    user.addresses.pull(addressId);
    await user.save();

    res.status(200).json({
      success: true,
      data: user.addresses,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Apply for wholesaler account
 * @route   POST /api/auth/apply-wholesaler
 */
const applyWholesaler = async (req, res, next) => {
  try {
    const data = wholesalerApplySchema.parse(req.body);

    // Check if an application already exists for this email
    const existingApp = await WholesalerApplication.findOne({ email: data.email });
    if (existingApp) {
      return res.status(400).json({
        success: false,
        message: existingApp.status === 'pending'
          ? 'An application is already pending for this email'
          : 'An application already exists for this email',
      });
    }

    // Check if a user with this email already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account with this email already exists',
      });
    }

    // Hash password before saving to the application
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Build file URLs from req.files if provided (multer/cloudinary)
    const files = {};
    if (req.files) {
      if (req.files.businessProof && req.files.businessProof[0]) {
        files.businessProofUrl = req.files.businessProof[0].path;
      }
      if (req.files.shopPhoto && req.files.shopPhoto[0]) {
        files.shopPhotoUrl = req.files.shopPhoto[0].path;
      }
      if (req.files.aadhar && req.files.aadhar[0]) {
        files.aadharUrl = req.files.aadhar[0].path;
      }
    }

    const application = await WholesalerApplication.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      shopName: data.shopName,
      gstNumber: data.gstNumber || undefined,
      city: data.city,
      password: hashedPassword,
      message: data.message || undefined,
      ...files,
    });

    res.status(201).json({
      success: true,
      data: {
        _id: application._id,
        name: application.name,
        email: application.email,
        status: application.status,
      },
      message: 'Wholesaler application submitted successfully. We will review and get back to you.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors.map((e) => e.message).join(', '),
      });
    }
    next(error);
  }
};

/**
 * @desc    Forgot password — send reset email
 * @route   POST /api/auth/forgot-password
 */
const crypto = require('crypto');
const { sendPasswordReset } = require('../services/email.service');

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // Don't reveal if email exists
      return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes
    await user.save({ validateBeforeSave: false });

    // Send email
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendPasswordReset(user.email, resetUrl);

    res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password with token
 * @route   POST /api/auth/reset-password/:token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const { token } = req.params;

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successful. You can now login.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  applyWholesaler,
  forgotPassword,
  resetPassword,
};
