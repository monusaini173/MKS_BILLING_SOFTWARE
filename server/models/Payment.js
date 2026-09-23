const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  type: { type: String, enum: ['RECEIVED', 'PAID'], required: true, default: 'RECEIVED' },
  partyType: { type: String, enum: ['CUSTOMER', 'SUPPLIER'], default: 'CUSTOMER' },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  partyName: { type: String, default: 'Walk-in Customer' },
  payerName: { type: String }, // Kis name sa payment aaya
  customerMobile: { type: String },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT', 'PARTIAL'], default: 'CASH' },
  status: { type: String, enum: ['SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'], default: 'SUCCESS', index: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceType: { type: String, default: 'Sale' }, // Sale, Purchase
  referenceNumber: { type: String }, // Invoice No
  transactionId: { type: String }, // UPI Ref / Razorpay payment ID / UTR
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unit: { type: String, default: 'PCS' },
    rate: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  }],
  subtotal: { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  date: { type: Date, default: Date.now, index: true },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

paymentSchema.index({ shopId: 1, date: -1 });
paymentSchema.index({ shopId: 1, status: 1, date: -1 });

module.exports = mongoose.model('Payment', paymentSchema);

