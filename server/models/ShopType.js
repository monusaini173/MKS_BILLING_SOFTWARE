const mongoose = require('mongoose');

const shopTypeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, uppercase: true, trim: true },
  label: { type: String, required: true, trim: true },
  labelHindi: { type: String, required: true, trim: true },
  emoji: { type: String, default: '🏬' },
  icon: { type: String, default: 'fa-solid fa-store' },
  accentColor: { type: String, default: '#4f46e5' },
  accentBg: { type: String, default: '#eef2ff' },
  description: { type: String },
  defaultCategories: [{ type: String }],
  customFieldLabels: [{
    key: { type: String },
    label: { type: String },
    labelHindi: { type: String },
    type: { type: String, enum: ['TEXT', 'NUMBER', 'DATE', 'SELECT'], default: 'TEXT' },
    required: { type: Boolean, default: false }
  }],
  isActive: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: false } // System defaults vs custom added by admin
}, { timestamps: true });

module.exports = mongoose.model('ShopType', shopTypeSchema);
