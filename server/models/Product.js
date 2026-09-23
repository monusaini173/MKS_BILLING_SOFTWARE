const mongoose = require('mongoose');

// Batch Sub-Schema for Multiple Batches per Medicine
const batchSchema = new mongoose.Schema({
  batchNumber: { type: String, required: true, trim: true },
  expiryDate: { type: Date, required: true },
  quantity: { type: Number, default: 0 },
  mrp: { type: Number },
  purchasePrice: { type: Number, default: 0 },
  sellingPrice: { type: Number },
  rackLocation: { type: String, trim: true },
  barcode: { type: String, trim: true },
  isSaleable: { type: Boolean, default: true },
  damagedQty: { type: Number, default: 0 },
}, { timestamps: true });

// Dynamic product schema supporting all 8 shop types
const productSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  shopType: { type: String, required: true },

  // Common fields
  name: { type: String, required: true, trim: true },
  sku: { type: String, trim: true },
  barcode: { type: String, trim: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  category: { type: String, trim: true },
  brand: { type: String, trim: true },
  image: { type: String },

  // Pricing
  purchasePrice: { type: Number, default: 0 },
  sellingPrice: { type: Number, required: true },
  mrp: { type: Number },
  gstPercent: { type: Number, default: 0 },
  gstInclusive: { type: Boolean, default: false },
  hsnCode: { type: String, trim: true },

  // Stock
  quantity: { type: Number, default: 0 },
  minStockLevel: { type: Number, default: 5 },
  maxStockLevel: { type: Number },
  unit: { type: String, default: 'PCS' },

  // Garments / Shoes
  size: { type: String },
  color: { type: String },
  fabric: { type: String },
  model: { type: String },

  // Mobile
  ram: { type: String },
  storage: { type: String },
  imeiNumber: { type: String },
  serialNumber: { type: String },
  warranty: { type: String },

  // 💊 Medical & Pharmacy Master
  genericName: { type: String, trim: true },
  company: { type: String, trim: true },
  manufacturer: { type: String, trim: true },
  medicineType: { 
    type: String, 
    enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Powder', 'Inhaler', 'Spray', 'Other'],
    default: 'Tablet'
  },
  packaging: { 
    type: String, 
    enum: ['Strip', 'Box', 'Bottle', 'Tube', 'Piece', 'Pack'],
    default: 'Strip'
  },
  tabletsPerStrip: { type: Number, default: 10 },
  batchNumber: { type: String, trim: true },
  expiryDate: { type: Date },
  prescriptionRequired: { type: Boolean, default: false },
  scheduleType: { 
    type: String, 
    enum: ['NONE', 'SCHEDULE_H', 'SCHEDULE_H1', 'SCHEDULE_X', 'OTC'],
    default: 'NONE'
  },
  rack: { type: String, trim: true }, // e.g. Rack A
  shelf: { type: String, trim: true }, // e.g. Shelf 2
  rackLocation: { type: String, trim: true }, // e.g. Rack A - Shelf 2
  batches: [batchSchema], // Multi-batch support

  // Cosmetics
  shade: { type: String },

  // Hardware
  material: { type: String },
  supplier: { type: String },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

productSchema.index({ shopId: 1, barcode: 1 });
productSchema.index({ shopId: 1, sku: 1 });
productSchema.index({ shopId: 1, name: 'text' });

module.exports = mongoose.model('Product', productSchema);
