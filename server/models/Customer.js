const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  gstin: { type: String, trim: true, uppercase: true },
  totalPurchases: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 10000 },
  isCreditBlocked: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  notes: { type: String },
}, { timestamps: true });

customerSchema.index({ shopId: 1, mobile: 1 });

module.exports = mongoose.model('Customer', customerSchema);
