const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Shop = require('../models/Shop');

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: '🚫 आपका खाता (Account) डीएक्टिवेट है। कृपया एडमिन से संपर्क करें।'
      });
    }

    // Check if shop is blocked (except for super admin)
    if (user.role !== 'SUPER_ADMIN' && user.shopId) {
      const shop = await Shop.findById(user.shopId).select('isActive shopType name');
      if (!shop || !shop.isActive) {
        return res.status(403).json({
          success: false,
          code: 'SHOP_BLOCKED',
          message: '🚫 आपकी दुकान (Shop) एडमिन द्वारा ब्लॉक / सस्पेंड कर दी गई है। कृपया एडमिन से संपर्क करें।'
        });
      }
      req.shop = shop;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized for this action.`
      });
    }
    next();
  };
};

const requireShop = async (req, res, next) => {
  try {
    let targetShopId = req.user.shopId;
    const requestedShopId = req.headers['x-shop-id'];

    if (requestedShopId && requestedShopId !== 'null' && requestedShopId !== 'undefined') {
      if (req.user.role === 'SUPER_ADMIN') {
        targetShopId = requestedShopId;
      } else if (req.user.role === 'SHOP_OWNER') {
        const ownedShop = await Shop.findOne({
          _id: requestedShopId,
          $or: [{ owner: req.user._id }, { _id: req.user.shopId }]
        });
        if (ownedShop) {
          targetShopId = ownedShop._id;
          req.shop = ownedShop;
        }
      }
    }

    if (!targetShopId) {
      return res.status(403).json({ success: false, message: 'Shop not assigned to this user.' });
    }
    req.shopId = targetShopId;
    
    if (!req.shop) {
      req.shop = await Shop.findById(req.shopId).select('shopType isActive name');
    }

    // Check if client passed X-Shop-Type header or fallback to shop document's shopType
    const headerShopType = req.headers['x-shop-type'];
    if (headerShopType && headerShopType !== 'undefined' && headerShopType !== 'null') {
      req.shopType = headerShopType;
    } else {
      req.shopType = req.shop ? req.shop.shopType : 'GARMENTS';
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect, authorize, requireShop };

