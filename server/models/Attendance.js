const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },
  date: { type: String, required: true }, // Format: 'YYYY-MM-DD'
  status: { 
    type: String, 
    enum: ['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'], 
    default: 'PRESENT' 
  },
  inTime: { type: String },
  outTime: { type: String },
  selfiePhoto: { type: String }, // Base64 selfie taken on mobile camera
  notes: { type: String, trim: true }
}, { timestamps: true });

// Ensure one attendance per staff per day
attendanceSchema.index({ shop: 1, staff: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
