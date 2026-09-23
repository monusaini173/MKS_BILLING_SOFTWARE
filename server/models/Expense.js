const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
  category: {
    type: String,
    required: true,
    trim: true,
    default: 'OTHER'
  },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now, index: true },
  description: { 
    type: String, 
    trim: true, 
    default: function() { return this.category || 'दुकान खर्च'; } 
  },
  paidTo: { type: String, trim: true, default: '' },
  paymentMethod: { type: String, enum: ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CREDIT'], default: 'CASH' },
  reference: { type: String, trim: true, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

expenseSchema.index({ shopId: 1, date: -1 });
expenseSchema.index({ shopId: 1, category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);


