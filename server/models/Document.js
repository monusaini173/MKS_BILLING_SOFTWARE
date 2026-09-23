const mongoose = require('mongoose');

const documentItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.Mixed, default: null },
  productName: { type: String, required: true },
  sku: { type: String },
  barcode: { type: String },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'PCS' },
  rate: { type: Number, required: true },
  mrp: { type: Number },
  discount: { type: Number, default: 0 },
  discountType: { type: String, enum: ['PERCENT', 'AMOUNT'], default: 'PERCENT' },
  gstPercent: { type: Number, default: 0 },
  cgst: { type: Number, default: 0 },
  sgst: { type: Number, default: 0 },
  igst: { type: Number, default: 0 },
  hsnCode: { type: String },
  subtotal: { type: Number, required: true },
  totalGst: { type: Number, default: 0 },
  total: { type: Number, required: true },
  batchNumber: { type: String },
  expiryDate: { type: Date }
});

const documentSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  documentType: {
    type: String,
    required: true,
    enum: [
      'PURCHASE_ORDER',
      'QUOTATION',
      'SALES_RETURN',
      'PURCHASE_RETURN',
      'DELIVERY_CHALLAN',
      'SALE_INVOICE',
      'PURCHASE_INVOICE'
    ],
    index: true
  },
  documentNumber: { type: String, required: true },
  documentDate: { type: Date, default: Date.now },
  validUntil: { type: Date },

  partyType: { type: String, enum: ['CUSTOMER', 'SUPPLIER'], required: true },
  partyId: { type: mongoose.Schema.Types.ObjectId },
  partyName: { type: String, required: true },
  partyMobile: { type: String },
  partyGstin: { type: String },
  partyAddress: { type: String },

  items: [documentItemSchema],

  subtotal: { type: Number, required: true, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  totalCgst: { type: Number, default: 0 },
  totalSgst: { type: Number, default: 0 },
  totalIgst: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, default: 0 },

  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'], default: 'CASH' },
  status: {
    type: String,
    enum: ['DRAFT', 'ISSUED', 'ACCEPTED', 'CONVERTED', 'CANCELLED', 'PAID', 'PENDING'],
    default: 'ISSUED'
  },

  convertedToInvoiceId: { type: mongoose.Schema.Types.ObjectId },
  convertedType: { type: String },
  convertedAt: { type: Date },

  notes: { type: String },
  termsConditions: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

documentSchema.index({ shopId: 1, documentType: 1, documentNumber: 1 }, { unique: true });
documentSchema.index({ shopId: 1, documentDate: -1 });

module.exports = mongoose.model('Document', documentSchema);
