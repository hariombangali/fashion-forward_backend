const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: String,
  image: String,
  sku: String,
  size: String,
  color: String,
  quantity: { type: Number, required: true, min: 1 },
  pricePerPiece: { type: Number, required: true },
  subtotal: { type: Number, required: true },
}, { _id: false });

const statusHistorySchema = new mongoose.Schema({
  status: String,
  timestamp: { type: Date, default: Date.now },
  note: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userType: { type: String, enum: ['customer', 'wholesaler'], required: true },

  items: [orderItemSchema],

  shippingAddress: {
    fullName: String,
    phone: String,
    line1: String,
    line2: String,
    city: String,
    state: String,
    pincode: String,
  },

  // Pricing
  subtotal: { type: Number, required: true },
  shippingCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },

  // Payment
  paymentMode: { type: String, enum: ['COD'], default: 'COD' },

  // Status
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  statusHistory: [statusHistorySchema],

  // COD Confirmation
  codConfirmed: { type: Boolean, default: false },
  codConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  codConfirmedAt: Date,
  codNotes: String,

  // Shipping
  trackingNumber: String,
  courierPartner: { type: String, enum: ['DTDC', 'Delhivery', 'India Post', 'BlueDart', 'Shiprocket', 'Other', ''] },

  // Bill
  billPdfUrl: String,

  // Notifications
  whatsappSentToAdmin: { type: Boolean, default: false },
  whatsappSentToCustomer: { type: Boolean, default: false },
  emailSentToCustomer: { type: Boolean, default: false },

  // Cancellation
  cancelReason: String,
  cancelledBy: { type: String, enum: ['customer', 'admin', ''] },
  cancelledAt: Date,
}, {
  timestamps: true,
});

// Generate order number: ORD-2026-00001
orderSchema.statics.generateOrderNumber = async function () {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const lastOrder = await this.findOne({ orderNumber: { $regex: `^${prefix}` } })
    .sort({ orderNumber: -1 })
    .lean();

  let sequence = 1;
  if (lastOrder) {
    const lastSeq = parseInt(lastOrder.orderNumber.split('-')[2], 10);
    sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(5, '0')}`;
};

// Indexes
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
