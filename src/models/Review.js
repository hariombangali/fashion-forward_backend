const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
  order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order',   required: true },

  rating:  { type: Number, required: true, min: 1, max: 5 },
  title:   { type: String, trim: true, maxlength: 120 },
  comment: { type: String, trim: true, maxlength: 2000 },
  images:  [String],            // up to 3 Cloudinary URLs

  // Verified = true because we only allow reviews from delivered orders
  verified: { type: Boolean, default: true },

  // Admin moderation — auto-approved by default; admin can hide spam
  approved: { type: Boolean, default: true },

  // Users who marked this review helpful (array of userIds)
  helpful:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

// One review per user per product
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

// Virtual: helpfulCount
reviewSchema.virtual('helpfulCount').get(function () {
  return this.helpful?.length || 0;
});

reviewSchema.set('toJSON', { virtuals: true });
reviewSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Review', reviewSchema);
