const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

brandSchema.index({ shopId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Brand', brandSchema);
