const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, unique: true },
  // Invoice Settings
  invoicePrefix: { type: String, default: 'INV' },
  invoiceFooter: { type: String, default: 'Thank you for your business!' },
  termsConditions: { type: String, default: 'Goods once sold will not be returned.' },
  showLogo: { type: Boolean, default: true },
  showSignature: { type: Boolean, default: false },
  // GST Settings
  isGSTRegistered: { type: Boolean, default: false },
  gstin: { type: String },
  gstState: { type: String },
  defaultGstPercent: { type: Number, default: 18 },
  gstInclusive: { type: Boolean, default: false },
  isInterState: { type: Boolean, default: false },
  // Payment & Credit Settings
  enableCredit: { type: Boolean, default: true },
  enableCreditLimitBlock: { type: Boolean, default: true },
  defaultCreditLimit: { type: Number, default: 10000 },
  blockMessage: { type: String, default: 'इस ग्राहक का पिछला उधार सीमा से अधिक हो गया है। कृपया पहले पुराना बकाया जमा करवाएं, फिर नया बिल बनाएं।' },
  enableUPI: { type: Boolean, default: true },
  enableCard: { type: Boolean, default: true },
  upiId: { type: String },
  // Notification Settings
  lowStockAlert: { type: Boolean, default: true },
  expiryAlert: { type: Boolean, default: true },
  expiryAlertDays: { type: Number, default: 30 },
  // Print Settings
  printFormat: { type: String, enum: ['A4', 'A5', 'THERMAL'], default: 'A4' },
  autoPrint: { type: Boolean, default: false },
  // Backup Settings
  autoBackup: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
