const mongoose = require('mongoose');

const wholesaleTierSchema = new mongoose.Schema({
  minQty: { type: Number, required: true },
  maxQty: Number, // null means unlimited
  pricePerPiece: { type: Number, required: true },
}, { _id: false });

const colorVariantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  hex: String,
  images: [String], // Cloudinary URLs
}, { _id: true });

const productSchema = new mongoose.Schema({
  sku: { type: String, unique: true, required: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },
  description: { type: String, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  subCategory: String,

  // Images
  images: [String], // Main Cloudinary URLs (min 1)

  // Variants
  sizes: [{ type: String, enum: ['S', 'M', 'L', 'XL', 'XXL', 'Free Size', '28', '30', '32', '34', '36', '38', '40', '42', '44'] }],
  colors: [colorVariantSchema],
  fabric: { type: String, enum: ['Cotton', 'Silk', 'Polyester', 'Georgette', 'Chiffon', 'Rayon', 'Linen', 'Crepe', 'Velvet', 'Net', 'Denim', 'Wool', 'Blend', 'Other'] },

  // Retail pricing
  retailPrice: { type: Number, required: true }, // Selling price
  retailMRP: { type: Number, required: true },   // Original/slashed price

  // Wholesale pricing (tier-based)
  wholesaleTiers: [wholesaleTierSchema],
  wholesaleMOQ: { type: Number, default: 10 },

  // Stock (size-wise)
  stock: { type: Map, of: Number, default: {} },
  // e.g. { "S": 20, "M": 35, "L": 40, "XL": 25 }

  totalStock: { type: Number, default: 0 },
  weightGrams: { type: Number, default: 300 },

  // Visibility
  visibility: {
    retail: { type: Boolean, default: true },
    wholesale: { type: Boolean, default: false },
  },

  // Metadata
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  tags: [String],

  // Reviews summary (denormalized)
  ratingsAvg: { type: Number, default: 0 },
  ratingsCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Auto-generate slug from name
productSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    // Append SKU for uniqueness
    this.slug = `${this.slug}-${this.sku.toLowerCase()}`;
  }
  next();
});

// Calculate total stock from size-wise stock
productSchema.pre('save', function (next) {
  if (this.stock) {
    let total = 0;
    for (const [, qty] of this.stock) {
      total += qty;
    }
    this.totalStock = total;
  }
  next();
});

// Get wholesale price for a given quantity
productSchema.methods.getWholesalePrice = function (quantity) {
  if (!this.wholesaleTiers || this.wholesaleTiers.length === 0) return null;

  // Sort tiers by minQty ascending
  const sorted = [...this.wholesaleTiers].sort((a, b) => a.minQty - b.minQty);

  let applicableTier = null;
  for (const tier of sorted) {
    if (quantity >= tier.minQty && (!tier.maxQty || quantity <= tier.maxQty)) {
      applicableTier = tier;
    }
  }
  // If quantity exceeds all maxQty, use highest tier
  if (!applicableTier && quantity >= sorted[sorted.length - 1].minQty) {
    applicableTier = sorted[sorted.length - 1];
  }

  return applicableTier ? applicableTier.pricePerPiece : null;
};

// Discount percentage
productSchema.virtual('discountPercent').get(function () {
  if (this.retailMRP > 0 && this.retailPrice < this.retailMRP) {
    return Math.round(((this.retailMRP - this.retailPrice) / this.retailMRP) * 100);
  }
  return 0;
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Indexes
productSchema.index({ name: 'text', tags: 'text', description: 'text' });
productSchema.index({ category: 1, active: 1 });
productSchema.index({ 'visibility.retail': 1, active: 1 });
productSchema.index({ 'visibility.wholesale': 1, active: 1 });


module.exports = mongoose.model('Product', productSchema);
