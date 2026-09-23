const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  name: { type: String, required: true, trim: true },
  regNumber: { type: String, trim: true }, // Medical Council Reg. No.
  mobile: { type: String, trim: true },
  clinic: { type: String, trim: true }, // Clinic / Hospital Name
  specialization: { type: String, trim: true }, // MBBS, MD, Pediatrician, etc.
  address: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

doctorSchema.index({ shopId: 1, name: 1 });
doctorSchema.index({ shopId: 1, mobile: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
