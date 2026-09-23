const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true },
  designation: { type: String, default: 'Salesman / Helper', trim: true },
  salaryType: { type: String, enum: ['MONTHLY', 'DAILY'], default: 'MONTHLY' },
  salaryAmount: { type: Number, default: 0 },
  joiningDate: { type: Date, default: Date.now },
  address: { type: String, trim: true },
  facePhoto: { type: String }, // Base64 registered face thumbnail
  faceDescriptor: [{ type: Number }], // Biometric facial feature vector
  isFaceRegistered: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  advances: [{
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    notes: { type: String, trim: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Staff', staffSchema);
