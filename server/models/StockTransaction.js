const mongoose = require('mongoose');

const stockTransactionSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String },
  type: {
    type: String,
    enum: ['PURCHASE', 'SALE', 'SALE_RETURN', 'PURCHASE_RETURN', 'ADJUSTMENT', 'OPENING'],
    required: true
  },
  quantity: { type: Number, required: true }, // positive = in, negative = out
  balanceAfter: { type: Number },
  referenceId: { type: mongoose.Schema.Types.ObjectId }, // sale/purchase/return id
  referenceType: { type: String },
  referenceNumber: { type: String },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

stockTransactionSchema.index({ shopId: 1, productId: 1, createdAt: -1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
