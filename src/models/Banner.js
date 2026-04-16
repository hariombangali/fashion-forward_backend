const mongoose = require('mongoose');

const GRADIENT_PRESETS = [
  'from-pink-500 via-rose-400 to-orange-400',
  'from-indigo-600 via-purple-500 to-fuchsia-500',
  'from-emerald-600 via-teal-500 to-cyan-500',
  'from-slate-900 via-indigo-900 to-purple-900',
  'from-amber-500 via-orange-500 to-red-500',
  'from-sky-500 via-blue-500 to-indigo-600',
  'from-rose-600 via-pink-600 to-fuchsia-500',
  'from-violet-600 via-purple-500 to-indigo-500',
];

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    description: { type: String, trim: true },

    // Background — image OR gradient (if no image, gradient is used)
    imageUrl: String,
    gradient: {
      type: String,
      default: 'from-indigo-600 via-purple-500 to-fuchsia-500',
    },

    // Image display settings
    imageFit: {
      type: String,
      enum: ['cover', 'contain', 'fill', 'none'],
      default: 'cover',
    },
    imagePosition: {
      type: String,
      enum: ['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
      default: 'center',
    },
    overlayOpacity: { type: Number, default: 50, min: 0, max: 100 }, // 0-100 (%)
    textPosition: {
      type: String,
      enum: ['left', 'center', 'right'],
      default: 'left',
    },

    // Call to action
    ctaText: { type: String, default: 'Shop Now' },
    ctaLink: { type: String, default: '/shop' },

    // Display
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },

    // Optional tags
    placement: {
      type: String,
      enum: ['home-hero', 'home-secondary', 'promo'],
      default: 'home-hero',
    },
  },
  { timestamps: true }
);

bannerSchema.index({ active: 1, sortOrder: 1 });
bannerSchema.index({ placement: 1, active: 1, sortOrder: 1 });

bannerSchema.statics.GRADIENT_PRESETS = GRADIENT_PRESETS;

module.exports = mongoose.model('Banner', bannerSchema);
