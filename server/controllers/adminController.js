const mongoose = require('mongoose');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const ShopType = require('../models/ShopType');
const SystemSetting = require('../models/SystemSetting');
const { generateAccessToken, generateRefreshToken } = require('../utils/helpers');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');


// ==========================================
// 1. ADMIN DASHBOARD STATS
// ==========================================
const getAdminDashboardStats = async (req, res) => {
  try {
    const totalShops = await Shop.countDocuments();
    const activeShops = await Shop.countDocuments({ isActive: true });
    const blockedShops = totalShops - activeShops;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const newShopsThisMonth = await Shop.countDocuments({ createdAt: { $gte: startOfMonth } });
    const totalUsers = await User.countDocuments();

    // Aggregated Revenue Across All Tenants
    const todaySalesAgg = await Sale.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
    ]);
    const todaySalesVolume = todaySalesAgg[0]?.total || 0;
    const todayInvoiceCount = todaySalesAgg[0]?.count || 0;

    const monthlySalesAgg = await Sale.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
    ]);
    const monthlySalesVolume = monthlySalesAgg[0]?.total || 0;
    const monthlyInvoiceCount = monthlySalesAgg[0]?.count || 0;

    // Subscription Breakdown
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const expiringSubscriptions = await Shop.find({
      subscriptionExpiry: { $gte: now, $lte: sevenDaysFromNow }
    }).select('name shopType ownerName mobile subscriptionPlan subscriptionExpiry planAmount').limit(20);

    const expiredShopsCount = await Shop.countDocuments({
      subscriptionExpiry: { $lt: now }
    });

    const subscriptionPlansCount = await Shop.aggregate([
      { $group: { _id: '$subscriptionPlan', count: { $sum: 1 }, totalRevenue: { $sum: '$planAmount' } } }
    ]);

    const shopTypeDistribution = await Shop.aggregate([
      { $group: { _id: '$shopType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Recent 10 Registered Shops
    const recentShops = await Shop.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name shopType ownerName mobile email subscriptionPlan subscriptionExpiry isActive createdAt');

    const subRevAgg = await Shop.aggregate([
      { $group: { _id: null, total: { $sum: '$planAmount' } } }
    ]);
    const subscriptionRevenue = subRevAgg[0]?.total || 0;


    res.json({
      success: true,
      data: {
        totalShops,
        activeShops,
        blockedShops,
        newShopsThisMonth,
        totalUsers,
        todaySalesVolume,
        todayInvoiceCount,
        monthlySalesVolume,
        monthlyInvoiceCount,
        subscriptionRevenue,
        expiredShopsCount,
        expiringSubscriptions,
        subscriptionPlansCount,
        shopTypeDistribution,
        recentShops
      }
    });

  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 2. SHOP MANAGEMENT (MULTI-TENANT)
// ==========================================
const getAllShops = async (req, res) => {
  try {
    const { search, shopType, status, plan, page = 1, limit = 25 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { gstin: { $regex: search, $options: 'i' } },
      ];
    }

    if (shopType && shopType !== 'ALL') {
      query.shopType = shopType;
    }

    if (status === 'ACTIVE') query.isActive = true;
    else if (status === 'BLOCKED' || status === 'INACTIVE') query.isActive = false;

    if (plan && plan !== 'ALL') {
      query.subscriptionPlan = plan;
    }

    const total = await Shop.countDocuments(query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const shops = await Shop.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Enrich with days remaining and expiry calculation
    const enrichedShops = shops.map(shop => {
      const doc = shop.toObject();
      const now = new Date();
      const expiry = new Date(doc.subscriptionExpiry || now);
      const diffMs = expiry.getTime() - now.getTime();
      doc.daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      doc.isExpired = diffMs <= 0;
      return doc;
    });

    res.json({
      success: true,
      data: enrichedShops,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getShopById = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    // Fetch related tenant metrics
    const totalSales = await Sale.countDocuments({ shopId: shop._id });
    const totalProducts = await Product.countDocuments({ shopId: shop._id });
    const totalCustomers = await Customer.countDocuments({ shopId: shop._id });
    const users = await User.find({ shopId: shop._id }).select('-password');

    const salesVolumeAgg = await Sale.aggregate([
      { $match: { shopId: shop._id } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);

    const shopObj = shop.toObject();
    const now = new Date();
    const expiry = new Date(shopObj.subscriptionExpiry || now);
    const diffMs = expiry.getTime() - now.getTime();
    shopObj.daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    shopObj.isExpired = diffMs <= 0;

    res.json({
      success: true,
      data: {
        shop: shopObj,
        metrics: {
          totalSales,
          totalSalesVolume: salesVolumeAgg[0]?.total || 0,
          totalProducts,
          totalCustomers
        },
        users
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createShop = async (req, res) => {
  try {
    const { name, shopType = 'KIRANA', ownerName, mobile, email, password, address, city, state, gstin, plan = 'TRIAL', trialDays = 3 } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Shop Name, Email and Password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists.' });
    }

    const expiryDate = new Date(Date.now() + (Number(trialDays) || 3) * 24 * 60 * 60 * 1000);

    const shop = await Shop.create({
      name: name.trim(),
      shopType: shopType.toUpperCase(),
      ownerName: ownerName || name,
      mobile: mobile || '',
      email: email.toLowerCase().trim(),
      address: address || '',
      city: city || '',
      state: state || 'Rajasthan',
      gstin: gstin ? gstin.toUpperCase().trim() : '',
      subscriptionPlan: plan,
      subscriptionExpiry: expiryDate,
      planAmount: plan === 'PRO_MONTHLY' ? 500 : plan === 'ENTERPRISE_YEARLY' ? 5000 : 0,
      isActive: true
    });

    const user = await User.create({
      name: ownerName || name,
      email: email.toLowerCase().trim(),
      password,
      role: 'SHOP_OWNER',
      shopId: shop._id,
      mobile: mobile || ''
    });

    res.status(201).json({
      success: true,
      message: `Shop "${shop.name}" registered successfully.`,
      data: { shop, user: { _id: user._id, name: user.name, email: user.email } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShop = async (req, res) => {
  try {
    const { name, shopType, ownerName, mobile, email, address, city, state, gstin, isActive } = req.body;
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    if (name) shop.name = name.trim();
    if (shopType) shop.shopType = shopType.toUpperCase();
    if (ownerName) shop.ownerName = ownerName.trim();
    if (mobile !== undefined) shop.mobile = mobile;
    if (email !== undefined) shop.email = email.toLowerCase().trim();
    if (address !== undefined) shop.address = address;
    if (city !== undefined) shop.city = city;
    if (state !== undefined) shop.state = state;
    if (gstin !== undefined) shop.gstin = gstin ? gstin.toUpperCase().trim() : '';

    if (typeof isActive === 'boolean') {
      shop.isActive = isActive;
      if (!isActive) {
        // Immediate Session Revocation and Account Block for all users under this shop
        await User.updateMany(
          { shopId: shop._id, role: { $ne: 'SUPER_ADMIN' } },
          { isActive: false, refreshToken: null }
        );
      } else {
        await User.updateMany(
          { shopId: shop._id },
          { isActive: true }
        );
      }
    }

    await shop.save();

    res.json({ success: true, message: 'Shop details updated successfully.', data: shop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleShopStatus = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    shop.isActive = !shop.isActive;
    await shop.save();

    // Revoke all active sessions and toggle users of this shop
    if (!shop.isActive) {
      await User.updateMany(
        { shopId: shop._id, role: { $ne: 'SUPER_ADMIN' } },
        { isActive: false, refreshToken: null }
      );
    } else {
      await User.updateMany(
        { shopId: shop._id },
        { isActive: true }
      );
    }

    res.json({
      success: true,
      message: `Shop "${shop.name}" has been ${shop.isActive ? 'UNBLOCKED / ACTIVATED' : 'BLOCKED / DEACTIVATED'}.`,
      data: shop
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🔥 3. SHOP LOGIN / IMPERSONATE (1-CLICK)
// ==========================================
const impersonateShop = async (req, res) => {
  try {
    const targetShop = await Shop.findById(req.params.id);
    if (!targetShop) return res.status(404).json({ success: false, message: 'Target shop not found.' });

    // Find the primary owner user of this target shop
    let targetUser = await User.findOne({ shopId: targetShop._id, role: 'SHOP_OWNER' });
    if (!targetUser) {
      targetUser = await User.findOne({ shopId: targetShop._id });
    }

    // If no user exists for this shop, automatically create a linked owner user
    if (!targetUser) {
      const uniqueEmail = targetShop.email || `shop_${targetShop._id.toString().slice(-6)}@mksbilling.com`;
      targetUser = await User.create({
        name: targetShop.ownerName || targetShop.name,
        email: uniqueEmail.toLowerCase(),
        mobile: targetShop.mobile || '9876543210',
        password: 'password123',
        role: 'SHOP_OWNER',
        shopId: targetShop._id,
        isActive: true
      });
    }

    const token = generateAccessToken(targetUser._id);

    res.json({
      success: true,
      message: `Now logging into ${targetShop.name} (${targetShop.shopType}) as Platform Owner.`,
      data: {
        token,
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: 'SHOP_OWNER',
          isImpersonating: true,
          adminName: req.user.name
        },
        shop: targetShop
      }
    });

  } catch (error) {
    console.error('Impersonate shop error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 4. SUBSCRIPTION MANAGEMENT
// ==========================================
const getAllSubscriptions = async (req, res) => {
  try {
    const { plan, status, search, page = 1, limit = 25 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    if (plan && plan !== 'ALL') query.subscriptionPlan = plan;

    const now = new Date();
    if (status === 'EXPIRED') query.subscriptionExpiry = { $lt: now };
    else if (status === 'ACTIVE') query.subscriptionExpiry = { $gte: now };
    else if (status === 'EXPIRING_SOON') {
      const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      query.subscriptionExpiry = { $gte: now, $lte: soon };
    }

    const total = await Shop.countDocuments(query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const shops = await Shop.find(query)
      .select('name shopType ownerName mobile email subscriptionPlan subscriptionExpiry planAmount isActive createdAt')
      .sort({ subscriptionExpiry: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const enriched = shops.map(s => {
      const doc = s.toObject();
      const expiry = new Date(doc.subscriptionExpiry || now);
      const diffMs = expiry.getTime() - now.getTime();
      doc.daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      doc.isExpired = diffMs <= 0;
      return doc;
    });

    res.json({
      success: true,
      data: enriched,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShopSubscription = async (req, res) => {
  try {
    const { plan, addDays, customExpiryDate, planAmount, isLifetimeFree } = req.body;
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    if (plan) shop.subscriptionPlan = plan;
    if (planAmount !== undefined) shop.planAmount = Number(planAmount);

    if (isLifetimeFree) {
      shop.subscriptionPlan = 'ENTERPRISE_YEARLY';
      shop.subscriptionExpiry = new Date('2099-12-31');
      shop.planAmount = 0;
    } else if (customExpiryDate) {
      shop.subscriptionExpiry = new Date(customExpiryDate);
    } else if (addDays) {
      const now = new Date();
      const base = shop.subscriptionExpiry && shop.subscriptionExpiry > now ? new Date(shop.subscriptionExpiry) : now;
      shop.subscriptionExpiry = new Date(base.getTime() + Number(addDays) * 24 * 60 * 60 * 1000);
    }

    shop.isActive = true;
    await shop.save();

    res.json({
      success: true,
      message: `Subscription for "${shop.name}" updated successfully. Plan: ${shop.subscriptionPlan}, Expiry: ${shop.subscriptionExpiry.toLocaleDateString('en-IN')}`,
      data: shop
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 5. USER & EMPLOYEE DIRECTORY
// ==========================================
const getAllUsers = async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 25 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }

    if (role && role !== 'ALL') query.role = role;
    if (status === 'ACTIVE') query.isActive = true;
    else if (status === 'BLOCKED') query.isActive = false;

    const total = await User.countDocuments(query);
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .populate('shopId', 'name shopType ownerName mobile isActive')
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: users,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role === 'SUPER_ADMIN' && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot block your own Super Admin account.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.name} is now ${user.isActive ? 'Active' : 'Blocked'}.`,
      data: user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, mobile, password, role = 'EMPLOYEE', shopId, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, Email and Password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ success: false, message: `User with email "${normalizedEmail}" already exists.` });
    }

    let finalShopId = null;
    if (shopId && typeof shopId === 'string' && mongoose.Types.ObjectId.isValid(shopId)) {
      finalShopId = new mongoose.Types.ObjectId(shopId);
    } else if (role !== 'SUPER_ADMIN') {
      const anyShop = await Shop.findOne({ isActive: true });
      if (anyShop) finalShopId = anyShop._id;
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      mobile: mobile ? String(mobile).trim() : '9876543210',
      password: password,
      role: role || 'EMPLOYEE',
      shopId: finalShopId,
      permissions: Array.isArray(permissions) ? permissions : ['BILLING', 'PRODUCTS'],
      isActive: true
    });

    const populatedUser = await User.findById(user._id).populate('shopId', 'name shopType ownerName mobile');

    res.status(201).json({
      success: true,
      message: `User "${user.name}" (${user.role}) created successfully.`,
      data: populatedUser
    });
  } catch (error) {
    console.error('Create user admin error:', error);
    res.status(500).json({ success: false, message: error.message || 'Could not create user.' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.role === 'SUPER_ADMIN' && user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own Super Admin account.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `User "${user.name}" deleted successfully.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: `Password for "${user.name}" (${user.email}) has been reset.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 6. DYNAMIC SHOP TYPES ENGINE
// ==========================================
const DEFAULT_SYSTEM_SHOP_TYPES = [
  { key: 'KIRANA', label: 'Kirana & Grocery', labelHindi: 'किराना व जनरल स्टोर', emoji: '🛒', icon: 'fa-solid fa-basket-shopping', accentColor: '#10b981', accentBg: '#ecfdf5', defaultCategories: ['दाल व अनाज (Grains)', 'तेल व घी (Oils)', 'मसाले (Spices)', 'स्नैक्स (Snacks)', 'सफाई उत्पाद (Cleaning)', 'चाय व चीनी (Tea & Sugar)'], isSystem: true },
  { key: 'GARMENTS', label: 'Garments & Clothing', labelHindi: 'कपड़ा व गारमेंट्स', emoji: '👕', icon: 'fa-solid fa-shirt', accentColor: '#f59e0b', accentBg: '#fffbeb', defaultCategories: ['शर्ट व टी-शर्ट (Shirts)', 'जींस व ट्राउजर (Jeans)', 'कुर्ती व सूट (Suits)', 'साड़ी व लहंगा (Sarees)', 'किड्स वियर (Kids)', 'विंटर वियर (Winter)'], isSystem: true },
  { key: 'SHOES', label: 'Footwear & Shoes', labelHindi: 'जूते व चप्पल', emoji: '👟', icon: 'fa-solid fa-shoe-prints', accentColor: '#3b82f6', accentBg: '#eff6ff', defaultCategories: ['मेंस शूज़ (Men)', 'लेडीज सैंडल (Women)', 'चप्पल व स्लीपर्स (Slippers)', 'स्पोर्ट्स शूज़ (Sports)', 'किड्स फुटवियर (Kids)', 'फॉर्मल शूज़ (Formal)'], isSystem: true },
  { key: 'MOBILE', label: 'Mobile & Electronics', labelHindi: 'मोबाइल व इलेक्ट्रॉनिक्स', emoji: '📱', icon: 'fa-solid fa-mobile-screen', accentColor: '#8b5cf6', accentBg: '#f5f3ff', defaultCategories: ['स्मार्टफोन (Phones)', 'ईयरफोन व बड्स (Audio)', 'चार्जर व केबल (Accessories)', 'कवर व ग्लास (Covers)', 'स्मार्टवॉच (Watches)', 'रिपेयरिंग पार्ट्स (Parts)'], isSystem: true },
  { key: 'MEDICAL', label: 'Medical & Pharmacy', labelHindi: 'दवा व मेडिकल स्टोर', emoji: '💊', icon: 'fa-solid fa-pills', accentColor: '#ef4444', accentBg: '#fef2f2', defaultCategories: ['टैबलेट्स व कैप्सूल (Tablets)', 'सिरप (Syrups)', 'एंटीबायोटिक्स (Antibiotics)', 'दर्द निवारक (Painkillers)', 'फर्स्ट एड (First Aid)', 'बेबी केयर (Baby Care)'], isSystem: true },
  { key: 'COSMETICS', label: 'Cosmetics & Beauty', labelHindi: 'कॉस्मेटिक्स व ब्यूटी', emoji: '💄', icon: 'fa-solid fa-wand-magic-sparkles', accentColor: '#ec4899', accentBg: '#fdf2f8', defaultCategories: ['मेकअप किट (Makeup)', 'लिपस्टिक व नेलपेंट (Lips & Nails)', 'स्किन केयर (Skin Care)', 'हेयर केयर (Hair)', 'परफ्यूम व डियो (Fragrances)', 'फेस वॉश (Cleansers)'], isSystem: true },
  { key: 'STATIONERY', label: 'Stationery & Books', labelHindi: 'स्टेशनरी व बुक स्टोर', emoji: '📚', icon: 'fa-solid fa-book', accentColor: '#14b8a6', accentBg: '#f0fdfa', defaultCategories: ['नोटबुक व रजिस्टर (Copies)', 'पेन व पेंसिल (Pens)', 'कलर्स व आर्ट (Art)', 'फाइल्स व फोल्डर (Files)', 'स्कूल स्टेशनरी (School)', 'ऑफिस सामग्री (Office)'], isSystem: true },
  { key: 'HARDWARE', label: 'Hardware & Sanitary', labelHindi: 'हार्डवेयर व सेनेटरी', emoji: '🔧', icon: 'fa-solid fa-wrench', accentColor: '#64748b', accentBg: '#f8fafc', defaultCategories: ['पाइप व फिटिंग्स (Pipes)', 'पेंट्स व ब्रश (Paints)', 'टूल्स व औजार (Tools)', 'कील व नट-बोल्ट (Fasteners)', 'बिजली का सामान (Electrical)', 'सेनेटरी (Sanitary)'], isSystem: true }
];

const getShopTypes = async (req, res) => {
  try {
    let types = await ShopType.find().sort({ createdAt: 1 });
    if (types.length === 0 || types.some(t => !t.defaultCategories || t.defaultCategories.length === 0)) {
      // Re-seed or update default types
      for (const def of DEFAULT_SYSTEM_SHOP_TYPES) {
        await ShopType.findOneAndUpdate(
          { key: def.key },
          { $set: def },
          { upsert: true, new: true }
        );
      }
      types = await ShopType.find().sort({ createdAt: 1 });
    }
    res.json({ success: true, data: types });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const createShopType = async (req, res) => {
  try {
    const { key, label, labelHindi, emoji, icon, accentColor, accentBg, description, defaultCategories } = req.body;
    if (!key || !label || !labelHindi) {
      return res.status(400).json({ success: false, message: 'Key, English Label and Hindi Label are required.' });
    }

    const formattedKey = key.toUpperCase().trim().replace(/\s+/g, '_');
    const existing = await ShopType.findOne({ key: formattedKey });
    if (existing) {
      return res.status(400).json({ success: false, message: `Shop type with key "${formattedKey}" already exists.` });
    }

    const shopType = await ShopType.create({
      key: formattedKey,
      label: label.trim(),
      labelHindi: labelHindi.trim(),
      emoji: emoji || '🏬',
      icon: icon || 'fa-solid fa-store',
      accentColor: accentColor || '#4f46e5',
      accentBg: accentBg || '#eef2ff',
      description: description || '',
      defaultCategories: Array.isArray(defaultCategories) ? defaultCategories : [],
      isActive: true,
      isSystem: false
    });

    res.status(201).json({ success: true, message: `Shop type "${shopType.label}" created successfully.`, data: shopType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShopType = async (req, res) => {
  try {
    const shopType = await ShopType.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!shopType) return res.status(404).json({ success: false, message: 'Shop type not found.' });
    res.json({ success: true, message: 'Shop type updated successfully.', data: shopType });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShopType = async (req, res) => {
  try {
    const shopType = await ShopType.findById(req.params.id);
    if (!shopType) return res.status(404).json({ success: false, message: 'Shop type not found.' });
    if (shopType.isSystem) {
      return res.status(400).json({ success: false, message: 'System default shop types cannot be deleted.' });
    }
    await ShopType.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Shop type deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 7. SYSTEM & PLATFORM SETTINGS
// ==========================================
const getSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = await SystemSetting.create({
        appName: 'MKS Billing Software',
        tagline: 'All-in-One Multi-Tenant POS & GST Invoicing System',
        supportPhone: '9876543210',
        supportEmail: 'owner@mksbilling.com',
        supportWhatsApp: '9876543210',
        defaultTrialDays: 3,
        subscriptionPlans: [
          { key: 'BASIC_MONTHLY', name: 'Starter Plan', nameHindi: 'स्टार्टर प्लान', price: 299, days: 30, features: ['Unlimited Invoices', 'Stock Management', 'Basic Reports'], canSendWhatsApp: false, isPopular: false },
          { key: 'PRO_MONTHLY', name: 'Pro WhatsApp Plan', nameHindi: 'प्रो व्हाट्सएप प्लान', price: 500, days: 30, features: ['Unlimited Invoices', '1-Click WhatsApp PDF Share', 'Multi-User Cashier Support', 'Automated Daily Sales Report', 'Barcode & IMEI Scanning'], canSendWhatsApp: true, isPopular: true },
          { key: 'ENTERPRISE_YEARLY', name: 'Yearly VIP Business Plan', nameHindi: 'वार्षिक वीआईपी बिजनेस प्लान', price: 5000, days: 365, features: ['Everything in Pro Plan', '365 Days Uninterrupted Billing', 'Priority VIP Technical Support', 'Free Store Onboarding & Training', 'Custom Invoice Branding'], canSendWhatsApp: true, isPopular: false }
        ]
      });
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateSystemSettings = async (req, res) => {
  try {
    let settings = await SystemSetting.findOne();
    if (!settings) {
      settings = new SystemSetting(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json({ success: true, message: 'System settings updated successfully.', data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 8. PLATFORM ANALYTICS & REPORTS
// ==========================================
const getPlatformReports = async (req, res) => {
  try {
    const { range = 'MONTH' } = req.query;
    let startDate = new Date();

    if (range === 'WEEK') startDate.setDate(startDate.getDate() - 7);
    else if (range === 'MONTH') startDate.setMonth(startDate.getMonth() - 1);
    else if (range === 'YEAR') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setMonth(startDate.getMonth() - 1);

    // Sales by Day
    const salesByDate = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          totalSales: { $sum: '$grandTotal' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top Performing Shops by Sales
    const topShops = await Sale.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$shopId',
          totalSales: { $sum: '$grandTotal' },
          invoiceCount: { $sum: 1 }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'shops',
          localField: '_id',
          foreignField: '_id',
          as: 'shopDetails'
        }
      },
      { $unwind: '$shopDetails' },
      {
        $project: {
          shopId: '$_id',
          shopName: '$shopDetails.name',
          shopType: '$shopDetails.shopType',
          ownerName: '$shopDetails.ownerName',
          mobile: '$shopDetails.mobile',
          totalSales: 1,
          invoiceCount: 1
        }
      }
    ]);

    // Summary Platform Metrics
    const allSalesAgg = await Sale.aggregate([
      { $group: { _id: null, totalSales: { $sum: '$grandTotal' }, totalInvoices: { $sum: 1 } } }
    ]);
    const totalSalesVolume = allSalesAgg[0]?.totalSales || 0;
    const totalInvoicesCount = allSalesAgg[0]?.totalInvoices || 0;

    const totalShopsCount = await Shop.countDocuments();
    const activeShopsCount = await Shop.countDocuments({ isActive: true });

    const subRevAgg = await Shop.aggregate([
      { $group: { _id: null, total: { $sum: '$planAmount' } } }
    ]);
    const totalSubscriptionRevenue = subRevAgg[0]?.total || 0;

    const popularShopTypeAgg = await Shop.aggregate([
      { $group: { _id: '$shopType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const mostPopularShopType = popularShopTypeAgg[0] ? `${popularShopTypeAgg[0]._id} (${popularShopTypeAgg[0].count} stores)` : 'Kirana & Grocery';

    // New shops registered in the selected timeframe
    const newShopsCount = await Shop.countDocuments({ createdAt: { $gte: startDate } });

    res.json({
      success: true,
      data: {
        range,
        totalSalesVolume,
        totalInvoicesCount,
        totalShopsCount,
        activeShopsCount,
        totalSubscriptionRevenue,
        mostPopularShopType,
        newShopsCount,
        salesByDate,
        topShops
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


module.exports = {
  getAdminDashboardStats,
  getAllShops,
  getShopById,
  createShop,
  updateShop,
  toggleShopStatus,
  impersonateShop,
  getAllSubscriptions,
  updateShopSubscription,
  getAllUsers,
  createUser,
  deleteUser,
  toggleUserStatus,
  resetUserPassword,
  getShopTypes,
  createShopType,
  updateShopType,
  deleteShopType,
  getSystemSettings,
  updateSystemSettings,
  getPlatformReports
};
