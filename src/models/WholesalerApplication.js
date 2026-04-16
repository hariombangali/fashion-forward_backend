const mongoose = require('mongoose');

const wholesalerApplicationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  phone: { type: String, required: true, trim: true },
  shopName: { type: String, required: true },
  gstNumber: String,
  city: { type: String, required: true },
  businessProofUrl: String,
  shopPhotoUrl: String,
  aadharUrl: String,
  password: { type: String, required: true, select: false },
  message: String, // Optional message from applicant

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },

  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNote: String,
  reviewedAt: Date,
}, { timestamps: true });

wholesalerApplicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('WholesalerApplication', wholesalerApplicationSchema);
