const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },

    // Discount
    discountType: {
      type: String,
      enum: ['percentage', 'flat'],
      default: 'percentage',
    },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number }, // caps percentage-based discount (e.g., 20% up to ₹500)

    // Conditions
    minOrderValue: { type: Number, default: 0 },
    applicableRole: {
      type: String,
      enum: ['all', 'customer', 'wholesaler'],
      default: 'all',
    },

    // Validity
    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    active: { type: Boolean, default: true },

    // Limits
    maxUses: { type: Number, default: 0 }, // 0 = unlimited
    maxUsesPerUser: { type: Number, default: 1 },
    timesUsed: { type: Number, default: 0 },

    // Usage tracking
    usedBy: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
        discountAmount: Number,
        usedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Check if coupon is valid for a user + subtotal
couponSchema.methods.isValidFor = function (userId, userRole, subtotal) {
  const now = new Date();

  if (!this.active) return { valid: false, reason: 'Coupon is not active' };
  if (this.startsAt && this.startsAt > now) {
    return { valid: false, reason: 'Coupon not yet valid' };
  }
  if (this.expiresAt && this.expiresAt < now) {
    return { valid: false, reason: 'Coupon has expired' };
  }
  if (this.maxUses > 0 && this.timesUsed >= this.maxUses) {
    return { valid: false, reason: 'Coupon usage limit reached' };
  }
  if (subtotal < this.minOrderValue) {
    return {
      valid: false,
      reason: `Minimum order value is ₹${this.minOrderValue}`,
    };
  }
  if (this.applicableRole !== 'all' && this.applicableRole !== userRole) {
    return {
      valid: false,
      reason: `Coupon is only for ${this.applicableRole}s`,
    };
  }
  if (userId) {
    const userUsageCount = this.usedBy.filter(
      (u) => u.user?.toString() === userId.toString()
    ).length;
    if (userUsageCount >= this.maxUsesPerUser) {
      return { valid: false, reason: 'You have already used this coupon' };
    }
  }
  return { valid: true };
};

// Calculate discount amount
couponSchema.methods.calculateDiscount = function (subtotal) {
  let discount = 0;
  if (this.discountType === 'percentage') {
    discount = Math.round((subtotal * this.discountValue) / 100);
    if (this.maxDiscount && discount > this.maxDiscount) {
      discount = this.maxDiscount;
    }
  } else {
    discount = this.discountValue;
  }
  return Math.min(discount, subtotal);
};

couponSchema.index({ code: 1 });
couponSchema.index({ active: 1, expiresAt: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
