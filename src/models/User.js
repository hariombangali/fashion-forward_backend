const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const addressSchema = new mongoose.Schema({
  label: { type: String, enum: ['Home', 'Office', 'Shop', 'Godown', 'Other'], default: 'Home' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true },
  line1: { type: String, required: true },
  line2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['customer', 'wholesaler', 'admin'], default: 'customer' },
  status: { type: String, enum: ['active', 'pending', 'rejected', 'blocked'], default: 'active' },
  avatar: String,
  addresses: [addressSchema],

  // Wholesaler-specific
  businessDetails: {
    shopName: String,
    gstNumber: String,
    businessProofUrl: String,
    shopPhotoUrl: String,
    aadharUrl: String,
    city: String,
  },

  // Cart (persistent)
  cart: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    size: String,
    color: String,
    quantity: { type: Number, default: 1 },
  }],

  // Wishlist
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],

  // OTP
  otp: String,
  otpExpiry: Date,

  // Password reset
  resetPasswordToken: String,
  resetPasswordExpiry: Date,
}, {
  timestamps: true,
});

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT
userSchema.methods.generateToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Ensure only one default address
userSchema.pre('save', function (next) {
  const defaults = this.addresses.filter(a => a.isDefault);
  if (defaults.length > 1) {
    this.addresses.forEach((a, i) => { a.isDefault = i === this.addresses.length - 1; });
  }
  if (this.addresses.length > 0 && defaults.length === 0) {
    this.addresses[0].isDefault = true;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
