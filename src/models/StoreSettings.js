const mongoose = require('mongoose');

/**
 * Single-document model for site-wide settings.
 * There will only ever be ONE document with `singleton: 'main'`.
 */
const storeSettingsSchema = new mongoose.Schema(
  {
    singleton: { type: String, default: 'main', unique: true, required: true },

    // Branding
    storeName: { type: String, default: 'Fashion Forward' },
    logoUrl: String,
    faviconUrl: String,
    tagline: { type: String, default: 'Curating your style' },

    // Theme colors
    theme: {
      primaryColor: { type: String, default: '#4f46e5' }, // indigo-600
      accentColor: { type: String, default: '#ec4899' },  // pink-500
      gradientFrom: { type: String, default: 'from-indigo-600' },
      gradientVia: { type: String, default: 'via-purple-600' },
      gradientTo: { type: String, default: 'to-pink-500' },
    },

    // Announcement bar (top of page)
    announcement: {
      enabled: { type: Boolean, default: true },
      messages: {
        type: [String],
        default: [
          '🎉 FREE Shipping on orders above ₹999',
          '🔥 Use code WELCOME10 for 10% off your first order',
        ],
      },
      link: { type: String, default: '/shop' },
      bgGradient: {
        type: String,
        default: 'from-indigo-600 via-purple-600 to-pink-500',
      },
      textColor: { type: String, default: 'text-white' },
    },

    // Flash sale banner
    flashSale: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: 'Mega Diwali Sale' },
      subtitle: { type: String, default: 'Up to 60% OFF' },
      endsAt: Date,
      ctaText: { type: String, default: 'Shop Sale' },
      ctaLink: { type: String, default: '/shop' },
      bgGradient: {
        type: String,
        default: 'from-rose-500 via-red-500 to-orange-500',
      },
    },

    // Contact & social
    contact: {
      phone: String,
      whatsapp: String,
      email: String,
      address: String,
    },
    social: {
      facebook: String,
      instagram: String,
      twitter: String,
      youtube: String,
    },

    // Typography
    typography: {
      headingFont: { type: String, default: 'Inter' },
      bodyFont:    { type: String, default: 'Inter' },
    },

    // Dark mode default (users can override individually)
    darkModeDefault: { type: Boolean, default: false },

    // Shipping/policy toggles
    freeShippingThreshold: { type: Number, default: 999 },
    flatShippingRate: { type: Number, default: 80 },

    // Live notifications (FOMO)
    liveNotifications: {
      enabled: { type: Boolean, default: true },
      // Pick recent orders to show as notifications
      lookbackDays: { type: Number, default: 30 },
    },
  },
  { timestamps: true }
);

// Ensure there's always exactly one settings document
storeSettingsSchema.statics.getSingleton = async function () {
  let settings = await this.findOne({ singleton: 'main' });
  if (!settings) {
    settings = await this.create({ singleton: 'main' });
  }
  return settings;
};

module.exports = mongoose.model('StoreSettings', storeSettingsSchema);
