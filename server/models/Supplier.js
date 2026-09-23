const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },

  // 1. Supplier Basic Details
  name: { type: String, required: true, trim: true },
  companyName: { type: String, trim: true },
  mobile: { type: String, trim: true },
  altMobile: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },

  // 2. Business & Medical Regulatory Details
  gstin: { type: String, trim: true, uppercase: true },
  pan: { type: String, trim: true, uppercase: true },
  drugLicenseNumber: { type: String, trim: true }, // e.g. D.L. No. 20B/21B
  dlExpiryDate: { type: Date },
  fssaiNumber: { type: String, trim: true },
  contactPerson: { type: String, trim: true },
  supplierType: { 
    type: String, 
    enum: ['Wholesaler', 'Distributor', 'Manufacturer', 'Dealer', 'Direct Vendor', 'Importer', 'Pharma Agency', 'Other'],
    default: 'Distributor'
  },
  category: { type: String, trim: true },
  paymentTerms: { 
    type: String, 
    default: 'Net 30 Days'
  },
  bankName: { type: String, trim: true },
  accountNumber: { type: String, trim: true },
  ifscCode: { type: String, trim: true, uppercase: true },

  // 3. Account Details
  openingBalance: { type: Number, default: 0 },
  totalPurchases: { type: Number, default: 0 },
  totalPaid: { type: Number, default: 0 },
  pendingAmount: { type: Number, default: 0 },
  creditLimit: { type: Number, default: 0 },
  lastPurchaseDate: { type: Date },

  // Metadata
  isActive: { type: Boolean, default: true },
  notes: { type: String, trim: true },
}, { timestamps: true });

supplierSchema.index({ shopId: 1, mobile: 1 });
supplierSchema.index({ shopId: 1, companyName: 1 });

module.exports = mongoose.model('Supplier', supplierSchema);
