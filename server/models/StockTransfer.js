const mongoose = require('mongoose');

const stockTransferItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  barcode: { type: String },
  quantity: { type: Number, required: true, min: 1 },
  unit: { type: String, default: 'PIECE' },
  purchasePrice: { type: Number, default: 0 },
  salePrice: { type: Number, default: 0 },
  mrp: { type: Number, default: 0 }
}, { _id: false });

const stockTransferSchema = new mongoose.Schema({
  transferNumber: { type: String, required: true, unique: true },
  fromShop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  toShop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  fromShopName: { type: String, required: true },
  toShopName: { type: String, required: true },
  items: [stockTransferItemSchema],
  totalItems: { type: Number, default: 0 },
  totalQuantity: { type: Number, default: 0 },
  transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transferredByName: { type: String, required: true },
  status: { type: String, enum: ['COMPLETED', 'CANCELLED'], default: 'COMPLETED' },
  remarks: { type: String, trim: true },
  transferDate: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
