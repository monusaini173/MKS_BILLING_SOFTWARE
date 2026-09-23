const jwt = require('jsonwebtoken');
const Shop = require('../models/Shop');

const generateAccessToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '365d',
  });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '365d',
  });
};

const generateInvoiceNumber = async (shopId, prefix = 'INV') => {
  const shop = await Shop.findById(shopId);
  const counter = shop.invoiceCounter || 1;
  const invoiceNumber = `${shop.invoicePrefix || prefix}-${String(counter).padStart(5, '0')}`;
  await Shop.findByIdAndUpdate(shopId, { $inc: { invoiceCounter: 1 } });
  return invoiceNumber;
};

const generatePurchaseNumber = (shopId) => {
  const timestamp = Date.now().toString().slice(-6);
  return `PUR-${timestamp}`;
};

const generateReturnNumber = (type) => {
  const timestamp = Date.now().toString().slice(-6);
  const prefix = type === 'SALE_RETURN' ? 'SR' : 'PR';
  return `${prefix}-${timestamp}`;
};

const calculateGST = (amount, gstPercent, isInter = false, gstInclusive = false) => {
  let baseAmount = amount;
  let gstAmount = 0;

  if (gstInclusive) {
    // Extract GST from inclusive price
    baseAmount = (amount * 100) / (100 + gstPercent);
    gstAmount = amount - baseAmount;
  } else {
    gstAmount = (amount * gstPercent) / 100;
  }

  const result = {
    baseAmount: parseFloat(baseAmount.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    cgst: 0,
    sgst: 0,
    igst: 0,
  };

  if (isInter) {
    result.igst = parseFloat(gstAmount.toFixed(2));
  } else {
    result.cgst = parseFloat((gstAmount / 2).toFixed(2));
    result.sgst = parseFloat((gstAmount / 2).toFixed(2));
  }

  return result;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateInvoiceNumber,
  generatePurchaseNumber,
  generateReturnNumber,
  calculateGST,
};
