const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true },
  total: { type: Number, required: true },
});

const returnSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  returnType: { type: String, enum: ['SALE_RETURN', 'PURCHASE_RETURN'], required: true },
  returnNumber: { type: String, required: true },
  returnDate: { type: Date, default: Date.now },
  originalId: { type: mongoose.Schema.Types.ObjectId }, // sale or purchase id
  originalNumber: { type: String },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  partyName: { type: String },
  items: [returnItemSchema],
  totalAmount: { type: Number, required: true },
  reason: { type: String },
  refundMethod: { type: String, enum: ['CASH', 'CREDIT', 'UPI', 'BANK_TRANSFER'] },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Return', returnSchema);
