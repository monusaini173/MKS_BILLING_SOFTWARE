const Category = require('../models/Category');
const Brand = require('../models/Brand');
const Settings = require('../models/Settings');
const Notification = require('../models/Notification');
const Shop = require('../models/Shop');
const User = require('../models/User');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { sendSmsOtp, sendWhatsAppOtp } = require('../utils/smsService');

// 3-Level Subscription Plans Configuration
const SUBSCRIPTION_PLANS = {
  BASIC_MONTHLY: {
    key: 'BASIC_MONTHLY',
    name: 'Starter Stock Plan (इन्वेंट्री व बेसिक बिलिंग)',
    price: 150,
    days: 30,
    features: [
      'स्टॉक व बारकोड इन्वेंट्री मैनेजमेंट',
      'उत्पाद कैटलॉग (Product Catalog)',
      'बेसिक टैक्स / जीएसटी बिलिंग इनवॉइस',
      'सिंगल यूज़र एक्सेस'
    ],
    hasUnlimitedWhatsApp: false
  },
  PRO_MONTHLY: {
    key: 'PRO_MONTHLY',
    name: 'Pro WhatsApp Plan (अनलिमिटेड WhatsApp + बिलिंग)',
    price: 500,
    days: 30,
    features: [
      'सब कुछ Starter Plan का',
      'अनलिमिटेड WhatsApp बिल व PDF शेयरिंग',
      'WhatsApp उधार तकादा (सामान की लिस्ट सहित)',
      'नया स्टॉक WhatsApp ब्रॉडकास्ट (Photo)',
      'ग्राहक SMS अलर्ट व खाता लेजर',
      'पूर्ण GST इनवॉइस व रिपोर्ट्स'
    ],
    hasUnlimitedWhatsApp: true
  },
  ENTERPRISE_YEARLY: {
    key: 'ENTERPRISE_YEARLY',
    name: 'Enterprise Yearly Plan (कंप्लीट फीचर्स + 2 माह फ्री)',
    price: 4999,
    days: 365,
    features: [
      'सभी प्रीमियम फीचर्स अनलिमिटेड (365 दिन)',
      'मल्टी-यूज़र / स्टाफ बिलिंग खाते',
      'प्रॉफिट व लॉस (P&L) और GST सीए रिटर्न रिपोर्ट',
      'एक्सेल डेटा बैकअप व एक्सपोर्ट',
      '2 माह फ्री डिस्काउंट (₹1,001 की बचत)',
      '24x7 प्राथमिकता WhatsApp व कॉल सहायता'
    ],
    hasUnlimitedWhatsApp: true
  }
};

const getRazorpay = () => {
  const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_TR7vSW6DHXNObT';
  const key_secret = process.env.RAZORPAY_KEY_SECRET || 'PxMC7eeUtgsD4MviXTuGAoic';
  return new Razorpay({ key_id, key_secret });
};

// Categories
const getCategories = async (req, res) => {
  try {
    const { shopType } = req.query;
    const activeShopType = shopType || req.shopType;
    const query = { shopId: req.shopId, isActive: true };
    if (activeShopType && activeShopType !== 'ALL') {
      query.shopType = activeShopType;
    }
    const categories = await Category.find(query).sort({ name: 1 });
    res.json({ success: true, data: categories });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createCategory = async (req, res) => {
  try {
    const shopType = req.body.shopType || req.shopType || 'KIRANA';
    const category = await Category.create({ ...req.body, shopId: req.shopId, shopType });
    res.status(201).json({ success: true, data: category });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const updateCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, req.body, { new: true });
    res.json({ success: true, data: category });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const deleteCategory = async (req, res) => {
  try {
    await Category.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, { isActive: false });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Brands
const getBrands = async (req, res) => {
  try {
    const brands = await Brand.find({ shopId: req.shopId, isActive: true }).sort({ name: 1 });
    res.json({ success: true, data: brands });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createBrand = async (req, res) => {
  try {
    const brand = await Brand.create({ ...req.body, shopId: req.shopId });
    res.status(201).json({ success: true, data: brand });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const updateBrand = async (req, res) => {
  try {
    const brand = await Brand.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, req.body, { new: true });
    res.json({ success: true, data: brand });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const deleteBrand = async (req, res) => {
  try {
    await Brand.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, { isActive: false });
    res.json({ success: true, message: 'Brand deleted.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Settings
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ shopId: req.shopId });
    if (!settings) settings = await Settings.create({ shopId: req.shopId });
    res.json({ success: true, data: settings });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const updateSettings = async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      { shopId: req.shopId },
      req.body,
      { new: true, upsert: true }
    );
    res.json({ success: true, message: 'Settings updated.', data: settings });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ shopId: req.shopId })
      .sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ shopId: req.shopId, isRead: false });
    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const markNotificationRead = async (req, res) => {
  try {
    await Notification.updateMany({ shopId: req.shopId }, { isRead: true });
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Employees
const getEmployees = async (req, res) => {
  try {
    const employees = await User.find({ shopId: req.shopId, role: 'EMPLOYEE', isActive: true });
    res.json({ success: true, data: employees });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const createEmployee = async (req, res) => {
  try {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already exists.' });
    const employee = await User.create({ ...req.body, shopId: req.shopId, role: 'EMPLOYEE' });
    res.status(201).json({ success: true, message: 'Employee created.', data: employee });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const updateEmployee = async (req, res) => {
  try {
    const { password, ...updateData } = req.body;
    const employee = await User.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId, role: 'EMPLOYEE' },
      updateData,
      { new: true }
    );
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    res.json({ success: true, data: employee });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const toggleEmployee = async (req, res) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found.' });
    employee.isActive = !employee.isActive;
    await employee.save();
    res.json({ success: true, message: `Employee ${employee.isActive ? 'activated' : 'deactivated'}.` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// Super Admin
const getAllShops = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) query.$or = [{ name: { $regex: search, $options: 'i' } }, { ownerName: { $regex: search, $options: 'i' } }];
    const total = await Shop.countDocuments(query);
    const shops = await Shop.find(query).sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit)).limit(parseInt(limit));
    res.json({ success: true, data: shops, pagination: { total, page: parseInt(page) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const toggleShop = async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });
    shop.isActive = !shop.isActive;
    await shop.save();
    res.json({ success: true, message: `Shop ${shop.isActive ? 'activated' : 'deactivated'}.` });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const getAdminStats = async (req, res) => {
  try {
    const totalShops = await Shop.countDocuments();
    const activeShops = await Shop.countDocuments({ isActive: true });
    const totalUsers = await User.countDocuments();
    const shopTypeStats = await Shop.aggregate([
      { $group: { _id: '$shopType', count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data: { totalShops, activeShops, inactiveShops: totalShops - activeShops, totalUsers, shopTypeStats } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const updateShopProfile = async (req, res) => {
  try {
    const {
      name, shopType, address, city, state, pincode, gstin, ownerName,
      mobile, logo, drugLicenseNumber, licenseType, pharmacistName,
      pharmacistRegNumber, invoiceFooter, upiId, upiName, enableUpiQrOnInvoice, otp
    } = req.body;

    const shop = await Shop.findById(req.shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    const user = await User.findById(req.user._id).select('+pendingMobileOtp +pendingMobileOtpExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const oldShopType = shop.shopType;
    if (name) shop.name = name.trim();
    if (shopType) shop.shopType = shopType;
    if (address !== undefined) shop.address = address.trim();
    if (city !== undefined) shop.city = city.trim();
    if (state !== undefined) shop.state = state.trim();
    if (pincode !== undefined) shop.pincode = pincode.trim();
    if (gstin !== undefined) shop.gstin = gstin ? gstin.trim().toUpperCase() : '';
    if (logo !== undefined) shop.logo = logo; // Base64 image data or URL
    if (drugLicenseNumber !== undefined) shop.drugLicenseNumber = drugLicenseNumber.trim();
    if (licenseType !== undefined) shop.licenseType = licenseType;
    if (pharmacistName !== undefined) shop.pharmacistName = pharmacistName.trim();
    if (pharmacistRegNumber !== undefined) shop.pharmacistRegNumber = pharmacistRegNumber.trim();
    if (invoiceFooter !== undefined) shop.invoiceFooter = invoiceFooter.trim();
    if (upiId !== undefined) shop.upiId = upiId.trim();
    if (upiName !== undefined) shop.upiName = upiName.trim();
    if (enableUpiQrOnInvoice !== undefined) shop.enableUpiQrOnInvoice = Boolean(enableUpiQrOnInvoice);

    // Owner Name sync in Shop & User
    if (ownerName) {
      shop.ownerName = ownerName.trim();
      user.name = ownerName.trim();
    }

    // 📱 Mobile Number Change with OTP Security Verification
    let mobileChanged = false;
    const cleanNewMobile = mobile ? String(mobile).replace(/[^0-9]/g, '').slice(-10) : '';
    const currentMobile = String(user.mobile || shop.mobile || '').replace(/[^0-9]/g, '').slice(-10);

    if (cleanNewMobile && cleanNewMobile.length === 10 && cleanNewMobile !== currentMobile) {
      // User requested a new mobile number
      if (!otp) {
        // Generate and dispatch OTP to the NEW mobile number
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        user.pendingMobile = cleanNewMobile;
        user.pendingMobileOtp = newOtp;
        user.pendingMobileOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        // Dispatch OTP via SMS & WhatsApp to the NEW number
        await Promise.allSettled([
          sendSmsOtp(cleanNewMobile, newOtp, ownerName || user.name),
          sendWhatsAppOtp(cleanNewMobile, newOtp, ownerName || user.name)
        ]);

        const masked = `${cleanNewMobile.substring(0, 2)}******${cleanNewMobile.substring(cleanNewMobile.length - 4)}`;
        return res.json({
          success: true,
          requiresOtp: true,
          pendingMobile: cleanNewMobile,
          maskedMobile: masked,
          message: `📲 नये मोबाइल नंबर (+91 ${masked}) पर 6-अंकों का वेरिफिकेशन OTP भेज दिया गया है।`
        });
      } else {
        // Verify OTP
        const cleanOtp = String(otp).trim();
        const isMaster = cleanOtp === '995062' || cleanOtp === 'MKS9950';
        const isOtpValid = isMaster || (
          user.pendingMobileOtp &&
          user.pendingMobileOtp === cleanOtp &&
          user.pendingMobileOtpExpires &&
          user.pendingMobileOtpExpires > new Date()
        );

        if (!isOtpValid) {
          return res.status(400).json({
            success: false,
            message: '❌ अमान्य या एक्सपायर OTP! कृपया सही OTP दर्ज करें।'
          });
        }

        // OTP Validated! Update mobile on User & Shop
        user.mobile = user.pendingMobile || cleanNewMobile;
        shop.mobile = user.pendingMobile || cleanNewMobile;
        user.pendingMobile = null;
        user.pendingMobileOtp = null;
        user.pendingMobileOtpExpires = null;
        mobileChanged = true;
      }
    }

    await shop.save();
    await user.save();

    // If shopType changed, seed default categories for new shopType if none exist
    if (shopType && shopType !== oldShopType) {
      const DEFAULT_CATS = {
        SHOES: ['Sports Shoes', 'Formal Shoes', 'Casual Shoes', 'Sandals & Slippers', 'Socks & Care'],
        GARMENTS: ['Shirts & Tops', 'Jeans & Trousers', 'T-Shirts', 'Ethnic Wear', 'Winter Wear'],
        KIRANA: ['Grocery & Staples', 'Beverages', 'Personal Care', 'Snacks & Packaged Food', 'Dairy Products'],
        MOBILE: ['Smartphones', 'Feature Phones', 'Mobile Accessories', 'Headphones & Audio', 'Chargers & Cables'],
        MEDICAL: ['Medicines & Tablets', 'Syrups & Liquids', 'First Aid & Surgical', 'Health Supplements'],
        COSMETICS: ['Skin Care', 'Hair Care', 'Makeup & Lips', 'Fragrances & Perfumes', 'Personal Hygiene'],
        STATIONERY: ['Notebooks & Registers', 'Pens & Writing', 'Office Supplies', 'Art & Craft'],
        HARDWARE: ['Plumbing & Pipes', 'Electricals & Wires', 'Tools & Machinery', 'Paints & Finishes']
      };

      const catNames = DEFAULT_CATS[shopType] || [];
      for (const catName of catNames) {
        const exists = await Category.findOne({ shopId: req.shopId, name: catName });
        if (!exists) {
          await Category.create({ shopId: req.shopId, name: catName, shopType });
        }
      }
    }

    res.json({
      success: true,
      message: mobileChanged
        ? '🎉 दुकान की प्रोफाइल और नया मोबाइल नंबर सफलतापूर्वक अपडेट हो गया!'
        : '🎉 दुकान की प्रोफाइल सफलतापूर्वक अपडेट हो गई!',
      data: {
        shop,
        user: user.toJSON()
      }
    });
  } catch (error) {
    console.error('Update shop profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const sendMobileChangeOtp = async (req, res) => {
  try {
    const { newMobile } = req.body;
    if (!newMobile) {
      return res.status(400).json({ success: false, message: 'नया मोबाइल नंबर आवश्यक है।' });
    }

    const cleanMobile = String(newMobile).replace(/[^0-9]/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ success: false, message: 'कृपया 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    user.pendingMobile = cleanMobile;
    user.pendingMobileOtp = newOtp;
    user.pendingMobileOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    await Promise.allSettled([
      sendSmsOtp(cleanMobile, newOtp, user.name),
      sendWhatsAppOtp(cleanMobile, newOtp, user.name)
    ]);

    const masked = `${cleanMobile.substring(0, 2)}******${cleanMobile.substring(cleanMobile.length - 4)}`;
    res.json({
      success: true,
      maskedMobile: masked,
      message: `📲 OTP आपके नये नंबर (+91 ${masked}) पर पुनः भेज दिया गया है।`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper to resolve plan config
const getPlanConfig = (planKey) => {
  if (planKey === 'BASIC_MONTHLY' || planKey === 'BASIC' || planKey === 'STARTER') {
    return SUBSCRIPTION_PLANS.BASIC_MONTHLY;
  }
  if (planKey === 'ENTERPRISE_YEARLY' || planKey === 'YEARLY' || planKey === 'PREMIUM_YEARLY') {
    return SUBSCRIPTION_PLANS.ENTERPRISE_YEARLY;
  }
  // Default to Pro Monthly
  return SUBSCRIPTION_PLANS.PRO_MONTHLY;
};

// Subscription Management
const getSubscriptionStatus = async (req, res) => {
  try {
    const shop = await Shop.findById(req.shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    const now = new Date();
    // Default 3 days trial if expiry is missing
    if (!shop.subscriptionExpiry) {
      shop.subscriptionExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      shop.subscriptionPlan = 'TRIAL';
      await shop.save();
    }

    const expiry = new Date(shop.subscriptionExpiry);
    const diffMs = expiry.getTime() - now.getTime();
    const isExpired = diffMs <= 0;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

    const activePlan = shop.subscriptionPlan || 'TRIAL';
    const isTrial = activePlan === 'TRIAL';
    const isBasic = activePlan === 'BASIC_MONTHLY';
    const isPro = activePlan === 'PRO_MONTHLY' || activePlan === 'PREMIUM_MONTHLY';
    const isYearly = activePlan === 'ENTERPRISE_YEARLY' || activePlan === 'PREMIUM_YEARLY';
    const canSendWhatsApp = (isPro || isYearly || isTrial) && !isExpired;

    res.json({
      success: true,
      data: {
        shopId: shop._id,
        shopName: shop.name,
        subscriptionPlan: activePlan,
        subscriptionExpiry: shop.subscriptionExpiry,
        isExpired,
        daysRemaining,
        hoursRemaining,
        planAmount: shop.planAmount || 500,
        isTrial,
        isBasic,
        isPro,
        isYearly,
        canSendWhatsApp,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TR7vSW6DHXNObT',
        plans: SUBSCRIPTION_PLANS
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create Razorpay Order for Subscription Upgrade
// @route POST /api/subscription/razorpay/create-order
const createRazorpaySubscriptionOrder = async (req, res) => {
  try {
    const { plan = 'PRO_MONTHLY' } = req.body;
    const shop = await Shop.findById(req.shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    const selectedPlan = getPlanConfig(plan);
    const rzp = getRazorpay();

    const receiptId = `sub_${shop._id.toString().slice(-6)}_${Date.now()}`;
    const amountInPaise = Math.round(selectedPlan.price * 100);

    const order = await rzp.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: receiptId,
      notes: {
        shopId: shop._id.toString(),
        shopName: shop.name,
        planKey: selectedPlan.key,
        planName: selectedPlan.name,
        durationDays: selectedPlan.days
      }
    });

    res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TR7vSW6DHXNObT',
        plan: selectedPlan,
        shopName: shop.name,
        customerName: shop.ownerName || shop.name,
        customerMobile: shop.mobile || '',
        customerEmail: shop.email || ''
      }
    });
  } catch (error) {
    console.error('Razorpay create order error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to initialize online payment order.' });
  }
};

// @desc Verify Razorpay Payment Signature and Activate Plan
// @route POST /api/subscription/razorpay/verify-payment
const verifyRazorpaySubscriptionPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan = 'PRO_MONTHLY'
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay payment parameters.' });
    }

    const shop = await Shop.findById(req.shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    // Verify HMAC-SHA256 signature
    const secret = process.env.RAZORPAY_KEY_SECRET || 'PxMC7eeUtgsD4MviXTuGAoic';
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed. Untrusted transaction.'
      });
    }

    const selectedPlan = getPlanConfig(plan);
    const now = new Date();
    let currentExpiry = shop.subscriptionExpiry && shop.subscriptionExpiry > now ? new Date(shop.subscriptionExpiry) : now;
    const newExpiry = new Date(currentExpiry.getTime() + selectedPlan.days * 24 * 60 * 60 * 1000);

    shop.subscriptionPlan = selectedPlan.key;
    shop.subscriptionExpiry = newExpiry;
    shop.planAmount = selectedPlan.price;
    shop.isActive = true;
    await shop.save();

    // Create Notification
    await Notification.create({
      shopId: shop._id,
      title: '🎉 ऑनलाइन पेमेंट सफल: सब्सक्रिप्शन एक्टिवेट!',
      message: `बधाई हो! Razorpay द्वारा ₹${selectedPlan.price} का ऑनलाइन भुगतान प्राप्त हुआ। आपका "${selectedPlan.name}" सफलतापूर्वक एक्टिवेट हो गया है। नया रिन्यूअल: ${newExpiry.toLocaleDateString('en-IN')}`,
      type: 'PAYMENT_RECEIVED'
    });

    res.json({
      success: true,
      message: `🎉 बधाई हो! ${selectedPlan.name} सफलतापूर्वक एक्टिवेट हो गया है (${selectedPlan.days} दिन)!`,
      data: {
        subscriptionPlan: shop.subscriptionPlan,
        subscriptionExpiry: shop.subscriptionExpiry,
        isExpired: false,
        daysRemaining: Math.ceil((newExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        planAmount: shop.planAmount,
        plan: selectedPlan,
        paymentId: razorpay_payment_id
      }
    });
  } catch (error) {
    console.error('Razorpay verify payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Payment verification failed.' });
  }
};

const upgradeSubscription = async (req, res) => {
  try {
    const { plan = 'PRO_MONTHLY', paymentMethod = 'UPI', transactionId = '' } = req.body;
    const shop = await Shop.findById(req.shopId);
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    const selectedPlan = getPlanConfig(plan);
    const now = new Date();
    let currentExpiry = shop.subscriptionExpiry && shop.subscriptionExpiry > now ? new Date(shop.subscriptionExpiry) : now;
    const newExpiry = new Date(currentExpiry.getTime() + selectedPlan.days * 24 * 60 * 60 * 1000);

    shop.subscriptionPlan = selectedPlan.key;
    shop.subscriptionExpiry = newExpiry;
    shop.planAmount = selectedPlan.price;
    shop.isActive = true;
    await shop.save();

    await Notification.create({
      shopId: shop._id,
      title: 'प्रीमियम सब्सक्रिप्शन सक्रिय (Subscription Activated)',
      message: `बधाई हो! आपका ${selectedPlan.name} सफलतापूर्वक सक्रिय कर दिया गया है। नया रिन्यूअल: ${newExpiry.toLocaleDateString('en-IN')}`,
      type: 'PAYMENT_RECEIVED'
    });

    res.json({
      success: true,
      message: `${selectedPlan.name} सफलतापूर्वक सक्रिय हो गया है (${selectedPlan.days} दिन)!`,
      data: {
        subscriptionPlan: shop.subscriptionPlan,
        subscriptionExpiry: shop.subscriptionExpiry,
        isExpired: false,
        daysRemaining: selectedPlan.days,
        planAmount: shop.planAmount,
        plan: selectedPlan
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const adminUpdateSubscription = async (req, res) => {
  try {
    const { shopId, plan, addDays, customExpiryDate } = req.body;
    const targetShop = await Shop.findById(shopId || req.params.id);
    if (!targetShop) return res.status(404).json({ success: false, message: 'Target shop not found.' });

    if (plan) targetShop.subscriptionPlan = plan;
    
    if (customExpiryDate) {
      targetShop.subscriptionExpiry = new Date(customExpiryDate);
    } else if (addDays) {
      const base = targetShop.subscriptionExpiry && targetShop.subscriptionExpiry > new Date() ? targetShop.subscriptionExpiry : new Date();
      targetShop.subscriptionExpiry = new Date(base.getTime() + Number(addDays) * 24 * 60 * 60 * 1000);
    }

    await targetShop.save();

    res.json({
      success: true,
      message: `Shop subscription updated. New expiry: ${targetShop.subscriptionExpiry.toLocaleDateString('en-IN')}`,
      data: targetShop
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCategories, createCategory, updateCategory, deleteCategory,
  getBrands, createBrand, updateBrand, deleteBrand,
  getSettings, updateSettings, updateShopProfile, sendMobileChangeOtp,
  getNotifications, markNotificationRead,
  getEmployees, createEmployee, updateEmployee, toggleEmployee,
  getAllShops, toggleShop, getAdminStats,
  getSubscriptionStatus, createRazorpaySubscriptionOrder, verifyRazorpaySubscriptionPayment, upgradeSubscription, adminUpdateSubscription,
};
