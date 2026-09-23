const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  type: {
    type: String,
    enum: [
      'LOW_STOCK',
      'OUT_OF_STOCK',
      'EXPIRY_ALERT',
      'PENDING_PAYMENT',
      'PAYMENT_RECEIVED',
      'SUBSCRIPTION_ACTIVATED',
      'SUBSCRIPTION_EXPIRING',
      'SUBSCRIPTION_EXPIRED',
      'DAILY_SUMMARY',
      'GENERAL',
      'SYSTEM',
      'SALE',
      'RETURN',
      'ORDER'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  referenceId: { type: mongoose.Schema.Types.ObjectId },
  referenceType: { type: String },
  isRead: { type: Boolean, default: false },
  priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' },
}, { timestamps: true });

notificationSchema.index({ shopId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
