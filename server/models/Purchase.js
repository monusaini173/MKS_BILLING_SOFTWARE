const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.Mixed, default: null },
  productName: { type: String, required: true },
  sku: { type: String },
  barcode: { type: String },
  quantity: { type: Number, required: true, min: 0 },
  freeQuantity: { type: Number, default: 0 }, // e.g. Buy 10 + Get 2 Free
  batchNumber: { type: String, trim: true },
  expiryDate: { type: Date },
  rackLocation: { type: String, trim: true },
  unit: { type: String, default: 'PCS' },
  purchasePrice: { type: Number, required: true },
  mrp: { type: Number },
  sellingPrice: { type: Number },
  gstPercent: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  hsnCode: { type: String },
  subtotal: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  total: { type: Number, required: true },
});

const purchaseSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  purchaseNumber: { type: String, required: true },
  purchaseDate: { type: Date, default: Date.now },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: { type: String },
  supplierInvoice: { type: String },
  items: [purchaseItemSchema],
  subtotal: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  totalCgst: { type: Number, default: 0 },
  totalSgst: { type: Number, default: 0 },
  totalIgst: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'], default: 'CASH' },
  status: { type: String, enum: ['PENDING', 'PAID', 'PARTIAL', 'CANCELLED'], default: 'PAID' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

purchaseSchema.index({ shopId: 1, purchaseNumber: 1 }, { unique: true });
purchaseSchema.index({ shopId: 1, purchaseDate: -1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
