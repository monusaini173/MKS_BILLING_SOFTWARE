const mongoose = require('mongoose');

const SHOP_TYPES = [
  'GARMENTS', 'SHOES', 'KIRANA', 'MOBILE', 'MEDICAL', 'COSMETICS', 'STATIONERY', 'HARDWARE', 'RESTAURANT', 'ELECTRONICS', 'JEWELLERY', 'GENERAL'
];

const shopSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  shopType: { type: String, required: true, enum: SHOP_TYPES },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerName: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  pincode: { type: String, trim: true },
  gstin: { type: String, trim: true, uppercase: true },
  logo: { type: String },
  isActive: { type: Boolean, default: true },
  subscriptionPlan: { 
    type: String, 
    enum: ['TRIAL', 'BASIC_MONTHLY', 'PRO_MONTHLY', 'ENTERPRISE_YEARLY', 'PREMIUM_MONTHLY', 'PREMIUM_YEARLY', 'ENTERPRISE', 'FREE'], 
    default: 'TRIAL' 
  },
  subscriptionExpiry: { 
    type: Date, 
    default: () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) 
  },
  trialStartedAt: { type: Date, default: Date.now },
  planAmount: { type: Number, default: 500 },
  invoicePrefix: { type: String, default: 'INV' },
  invoiceCounter: { type: Number, default: 1 },
  currency: { type: String, default: 'INR' },
  gstState: { type: String },
  isGSTRegistered: { type: Boolean, default: false },
  // 🏥 Medical Store Specialized Profile
  drugLicenseNumber: { type: String, trim: true }, // e.g. 20-B/21-B
  licenseType: { type: String, enum: ['RETAIL_20_21', 'WHOLESALE_20B_21B', 'BOTH', 'OTHER'], default: 'RETAIL_20_21' },
  licenseExpiryDate: { type: Date },
  pharmacistName: { type: String, trim: true },
  pharmacistRegNumber: { type: String, trim: true },
  invoiceFooter: { type: String, trim: true },
  // 💳 UPI QR Code Settings
  upiId: { type: String, trim: true },
  upiName: { type: String, trim: true },
  enableUpiQrOnInvoice: { type: Boolean, default: true },
  // 🏢 Multi-Branch Fields
  branchName: { type: String, trim: true, default: 'Main Branch' },
  branchCode: { type: String, trim: true, default: 'BR-1' },
  isMainBranch: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Shop', shopSchema);
module.exports.SHOP_TYPES = SHOP_TYPES;

