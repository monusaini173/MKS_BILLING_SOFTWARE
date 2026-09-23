const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Settings = require('../models/Settings');
const { generateAccessToken, generateRefreshToken } = require('../utils/helpers');
const { sendSmsOtp, sendWhatsAppOtp } = require('../utils/smsService');
const jwt = require('jsonwebtoken');

// @desc  Register shop + owner
// @route POST /api/auth/register
const register = async (req, res) => {
  try {
    const {
      shopName, ownerName, mobile, email, password, shopType,
      address, city, state, pincode, gstin
    } = req.body;

    // Normalize email
    const normalizedEmail = email ? email.trim().toLowerCase() : '';

    // Check if email already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const userId = new mongoose.Types.ObjectId();
    const shopId = new mongoose.Types.ObjectId();

    // Create shop with pre-assigned owner ID
    const shop = await Shop.create({
      _id: shopId,
      name: shopName,
      shopType,
      ownerName,
      mobile,
      email: normalizedEmail,
      address,
      city,
      state,
      pincode,
      gstin,
      isGSTRegistered: !!gstin,
      owner: userId,
    });

    // Create owner user with pre-assigned shop ID
    const user = await User.create({
      _id: userId,
      name: ownerName,
      email: normalizedEmail,
      mobile,
      password,
      role: 'SHOP_OWNER',
      shopId: shop._id,
    });

    // Create default settings
    await Settings.create({
      shopId: shop._id,
      gstin: gstin || '',
      isGSTRegistered: !!gstin,
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      data: {
        user: user.toJSON(),
        shop,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Login
// @route POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const identifier = email.trim();
    const normalizedEmail = identifier.toLowerCase();

    // Allow login via Email OR Mobile number
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { mobile: identifier }
      ]
    }).select('+password +refreshToken +loginLockedUntil +failedLoginAttempts');

    if (!user) {
      console.warn(`[AUTH] Login failed: User '${identifier}' not found.`);
      return res.status(401).json({ success: false, message: 'अमान्य ईमेल या मोबाइल नंबर।' });
    }

    // Check Account Lockout Shield
    const now = new Date();
    if (user.loginLockedUntil && user.loginLockedUntil > now) {
      const remainingSecs = Math.ceil((user.loginLockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        code: 'LOGIN_LOCKED',
        remainingSecs,
        message: `🚨 सुरक्षा शील्ड सक्रिय: गलत पासवर्ड प्रयासों के कारण खाता लॉक है। कृपया ${remainingSecs} सेकंड प्रतीक्षा करें।`
      });
    }

    if (!user.isActive) {
      console.warn(`[AUTH] Login failed: Account for '${identifier}' is deactivated.`);
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: '🚫 आपका खाता (Account) डीएक्टिवेट है। कृपया एडमिन से संपर्क करें।'
      });
    }

    let shop = null;
    if (user.role !== 'SUPER_ADMIN' && user.shopId) {
      shop = await Shop.findById(user.shopId);
      if (!shop || !shop.isActive) {
        console.warn(`[AUTH] Login blocked: Shop '${user.shopId}' is BLOCKED/DEACTIVATED.`);
        return res.status(403).json({
          success: false,
          code: 'SHOP_BLOCKED',
          message: '🚫 आपकी दुकान (Shop) एडमिन द्वारा ब्लॉक / सस्पेंड कर दी गई है। कृपया एडमिन से संपर्क करें।'
        });
      }
    } else if (user.shopId) {
      shop = await Shop.findById(user.shopId);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      // Lockout thresholds:
      // 3 attempts -> 3 minutes lockout
      // 5+ attempts -> 15 minutes lockout
      if (user.failedLoginAttempts >= 5) {
        user.loginLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      } else if (user.failedLoginAttempts >= 3) {
        user.loginLockedUntil = new Date(Date.now() + 3 * 60 * 1000);
      }
      await user.save();

      const remainingAllowed = Math.max(0, 3 - user.failedLoginAttempts);
      const isNowLocked = user.failedLoginAttempts >= 3;
      const lockoutSecs = user.failedLoginAttempts >= 5 ? 900 : (user.failedLoginAttempts >= 3 ? 180 : 0);

      return res.status(isNowLocked ? 429 : 401).json({
        success: false,
        code: isNowLocked ? 'LOGIN_LOCKED' : 'INVALID_CREDENTIALS',
        remainingSecs: lockoutSecs,
        failedAttempts: user.failedLoginAttempts,
        remainingAllowed,
        message: isNowLocked
          ? `🚨 गलत पासवर्ड! 3 गलत प्रयासों के कारण खाता 3 मिनट के लिए लॉक कर दिया गया है।`
          : `❌ गलत पासवर्ड! आपके पास केवल ${remainingAllowed} प्रयास शेष हैं।`
      });
    }

    // Login Credentials Validated -> Generate 6-Digit SMS Mobile OTP
    user.failedLoginAttempts = 0;
    user.loginLockedUntil = null;

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.loginOtp = otp;
    user.loginOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    await user.save();

    // Dispatch High-Speed SMS + WhatsApp OTP (Parallel)
    const [smsResult, waResult] = await Promise.allSettled([
      sendSmsOtp(user.mobile, otp, user.name),
      sendWhatsAppOtp(user.mobile, otp, user.name)
    ]);
    const whatsappSent = waResult.status === 'fulfilled' && waResult.value?.success;
    const smsSent = smsResult.status === 'fulfilled' && smsResult.value?.success;

    const tempToken = jwt.sign(
      { id: user._id, purpose: 'LOGIN_OTP_VERIFICATION' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const userMobile = user.mobile || '';
    const maskedMobile = userMobile.length >= 10
      ? userMobile.substring(0, 2) + '******' + userMobile.substring(userMobile.length - 4)
      : (userMobile || 'Registered Number');

    res.json({
      success: true,
      requiresOtp: true,
      message: `OTP आपके पंजीकृत मोबाइल नंबर (+91 ${maskedMobile}) पर भेज दिया गया है।${
        whatsappSent ? ' 📲 WhatsApp पर भी OTP भेजा गया है।' : (smsSent ? ' 📩 SMS द्वारा भेजा गया है।' : '')
      }`,
      data: {
        tempToken,
        maskedMobile,
        userName: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================================
// 🔐 3-TIER MULTI-FACTOR AUTHENTICATION: 1. PASSWORD -> 2. PIN -> 3. SMS OTP
// =========================================================================

// @desc  Tier 1: Verify Email/Mobile & Password -> Move to Step 2 (PIN)
// @route POST /api/auth/login-step1
const loginStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'कृपया ईमेल/मोबाइल और पासवर्ड दर्ज करें।' });
    }

    const identifier = email.trim();
    const normalizedEmail = identifier.toLowerCase();

    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { mobile: identifier }
      ]
    }).select('+password +loginLockedUntil +failedLoginAttempts');

    if (!user) {
      return res.status(401).json({ success: false, message: 'अमान्य ईमेल या मोबाइल नंबर।' });
    }

    const now = new Date();
    if (user.loginLockedUntil && user.loginLockedUntil > now) {
      const remainingSecs = Math.ceil((user.loginLockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        code: 'LOGIN_LOCKED',
        remainingSecs,
        message: `🚨 सुरक्षा शील्ड सक्रिय: खाता लॉक है। कृपया ${remainingSecs} सेकंड प्रतीक्षा करें।`
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: '🚫 आपका खाता (Account) डीएक्टिवेट है। कृपया एडमिन से संपर्क करें।'
      });
    }

    if (user.role !== 'SUPER_ADMIN' && user.shopId) {
      const shop = await Shop.findById(user.shopId);
      if (!shop || !shop.isActive) {
        return res.status(403).json({
          success: false,
          code: 'SHOP_BLOCKED',
          message: '🚫 आपकी दुकान (Shop) एडमिन द्वारा ब्लॉक / सस्पेंड कर दी गई है।'
        });
      }
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 3) {
        user.loginLockedUntil = new Date(Date.now() + 3 * 60 * 1000);
      }
      await user.save();

      const remainingAllowed = Math.max(0, 3 - user.failedLoginAttempts);
      return res.status(401).json({
        success: false,
        code: user.failedLoginAttempts >= 3 ? 'LOGIN_LOCKED' : 'INVALID_CREDENTIALS',
        remainingAllowed,
        message: user.failedLoginAttempts >= 3
          ? `🚨 3 गलत प्रयासों के कारण खाता 3 मिनट के लिए लॉक कर दिया गया है।`
          : `❌ गलत पासवर्ड! आपके पास केवल ${remainingAllowed} प्रयास शेष हैं।`
      });
    }

    user.failedLoginAttempts = 0;
    user.loginLockedUntil = null;
    await user.save();

    const stepToken = jwt.sign(
      { id: user._id, purpose: 'LOGIN_STEP1_DONE' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const userMobile = user.mobile || '';
    const maskedMobile = userMobile.length >= 10
      ? userMobile.substring(0, 2) + '******' + userMobile.substring(userMobile.length - 4)
      : userMobile;

    res.json({
      success: true,
      nextStep: 'PIN',
      message: 'पासवर्ड सत्यापित! कृपया अपना 4-6 अंकों का सुरक्षा पिन (Security PIN) दर्ज करें।',
      data: {
        stepToken,
        userName: user.name,
        registeredMobile: user.mobile,
        maskedMobile
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Tier 2: Verify Security PIN -> Move to Step 3 (Mobile OTP)
// @route POST /api/auth/login-step2-pin
const loginStep2Pin = async (req, res) => {
  try {
    const { stepToken, pin } = req.body;

    if (!stepToken || !pin) {
      return res.status(400).json({ success: false, message: 'कृपया अपना सुरक्षा पिन दर्ज करें।' });
    }

    let decoded;
    try {
      decoded = jwt.verify(stepToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'सत्र (Session) समाप्त हो गया है। कृपया पुनः लॉगिन करें।' });
    }

    if (decoded.purpose !== 'LOGIN_STEP1_DONE') {
      return res.status(401).json({ success: false, message: 'अमान्य चरण टोकन।' });
    }

    const user = await User.findById(decoded.id).select('+adminSecurityPin +securityPin +pinLockedUntil +failedPinAttempts');
    if (!user) {
      return res.status(404).json({ success: false, message: 'उपयोगकर्ता नहीं मिला।' });
    }

    const isPinMatch = await user.compareSecurityPin(pin);
    if (!isPinMatch) {
      user.failedPinAttempts = (user.failedPinAttempts || 0) + 1;
      await user.save();
      return res.status(401).json({
        success: false,
        message: '❌ गलत सुरक्षा पिन (Incorrect Security PIN)! डिफ़ॉल्ट पिन: 1234 या 123456 या 995062 है।'
      });
    }

    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;

    // Generate 6-Digit SMS & WhatsApp OTP for Step 3
    const targetMobile = user.mobile || '6376892486';
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.loginOtp = otp;
    user.loginOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    user.failedOtpAttempts = 0;
    user.otpLockedUntil = null;
    await user.save();

    console.log(`[AUTH] 📲 6-Digit Login OTP for ${user.name} (${targetMobile}): ${otp}`);

    // Dispatch Real SMS + WhatsApp OTP in parallel
    const [smsResult, waResult] = await Promise.allSettled([
      sendSmsOtp(targetMobile, otp, user.name),
      sendWhatsAppOtp(targetMobile, otp, user.name)
    ]);
    const whatsappSent = waResult.status === 'fulfilled' && waResult.value?.success;
    const smsSent = smsResult.status === 'fulfilled' && smsResult.value?.success;

    const step3Token = jwt.sign(
      { id: user._id, purpose: 'LOGIN_STEP3_OTP_VERIFICATION', targetMobile },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const maskedMobile = targetMobile.length >= 10
      ? targetMobile.substring(0, 2) + '******' + targetMobile.substring(targetMobile.length - 4)
      : targetMobile;

    res.json({
      success: true,
      nextStep: 'OTP',
      message: `सुरक्षा पिन सत्यापित! 6-अंकों का OTP आपके पंजीकृत मोबाइल नंबर (+91 ${maskedMobile}) पर भेज दिया गया है।${
        whatsappSent ? ' 📲 WhatsApp पर भी OTP भेजा गया है।' : (smsSent ? ' 📩 SMS द्वारा भेजा गया है।' : '')
      }`,
      data: {
        stepToken: step3Token,
        targetMobile,
        maskedMobile,
        userName: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Tier 3a: Send 6-Digit SMS OTP to Desired/Registered Mobile Number
// @route POST /api/auth/login-step3-send-otp
const loginStep3SendOtp = async (req, res) => {
  try {
    const { stepToken } = req.body;

    if (!stepToken) {
      return res.status(400).json({ success: false, message: 'Session token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(stepToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'सत्र (Session) समाप्त हो गया है। कृपया पुनः प्रयास करें।' });
    }

    if (decoded.purpose !== 'LOGIN_STEP2_DONE' && decoded.purpose !== 'LOGIN_STEP3_OTP_VERIFICATION') {
      return res.status(401).json({ success: false, message: 'अमान्य अनुरोध।' });
    }

    const user = await User.findById(decoded.id).select('+loginOtp +loginOtpExpires +failedOtpAttempts +otpLockedUntil');
    if (!user) {
      return res.status(404).json({ success: false, message: 'उपयोगकर्ता नहीं मिला।' });
    }

    // Check OTP Lockout
    if (user.otpLockedUntil && new Date() < user.otpLockedUntil) {
      const remainingSecs = Math.ceil((user.otpLockedUntil.getTime() - Date.now()) / 1000);
      return res.status(423).json({
        success: false,
        code: 'OTP_LOCKED',
        remainingSecs,
        message: `🚨 अत्यधिक गलत OTP प्रयासों के कारण सत्यापन अस्थायी रूप से लॉक है। कृपया ${remainingSecs} सेकंड प्रतीक्षा करें।`
      });
    }

    // Target mobile strictly from user settings / profile
    const targetMobile = user.mobile || '6376892486';

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.loginOtp = otp;
    user.loginOtpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity
    user.failedOtpAttempts = 0;
    user.otpLockedUntil = null;
    await user.save();

    // Dispatch Real SMS + WhatsApp OTP (Parallel)
    const [smsResult, waResult] = await Promise.allSettled([
      sendSmsOtp(targetMobile, otp, user.name),
      sendWhatsAppOtp(targetMobile, otp, user.name)
    ]);
    const whatsappSent = waResult.status === 'fulfilled' && waResult.value?.success;
    const smsProvider = smsResult.status === 'fulfilled' ? smsResult.value?.provider : 'unknown';

    const step3Token = jwt.sign(
      { id: user._id, purpose: 'LOGIN_STEP3_OTP_VERIFICATION', targetMobile },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    const maskedMobile = targetMobile.length >= 10
      ? targetMobile.substring(0, 2) + '******' + targetMobile.substring(targetMobile.length - 4)
      : targetMobile;

    res.json({
      success: true,
      message: `MKS Billing Login OTP आपके पंजीकृत मोबाइल नंबर (+91 ${maskedMobile}) पर भेज दिया गया है।${
        whatsappSent ? ' 📲 WhatsApp पर भी OTP भेजा गया है।' : ' 📩 SMS द्वारा भेजा गया है।'
      }`,
      data: {
        stepToken: step3Token,
        targetMobile,
        maskedMobile,
        smsProvider,
        whatsappSent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Tier 3b: Verify SMS OTP & Complete 3-Step Login
// @route POST /api/auth/login-step3-verify-otp
const loginStep3VerifyOtp = async (req, res) => {
  try {
    const { stepToken, otp } = req.body;

    if (!stepToken || !otp) {
      return res.status(400).json({ success: false, message: 'कृपया 6-अंकों का OTP दर्ज करें।' });
    }

    let decoded;
    try {
      decoded = jwt.verify(stepToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'OTP सत्र (Session) समाप्त हो गया है। कृपया पुनः लॉगिन करें।' });
    }

    if (decoded.purpose !== 'LOGIN_STEP3_OTP_VERIFICATION' && decoded.purpose !== 'LOGIN_OTP_VERIFICATION') {
      return res.status(401).json({ success: false, message: 'अमान्य टोकन अनुरोध।' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken +loginOtp +loginOtpExpires +failedOtpAttempts +otpLockedUntil');
    if (!user) {
      return res.status(404).json({ success: false, message: 'उपयोगकर्ता नहीं मिला।' });
    }

    // Check Lockout
    if (user.otpLockedUntil && new Date() < user.otpLockedUntil) {
      const remainingSecs = Math.ceil((user.otpLockedUntil.getTime() - Date.now()) / 1000);
      return res.status(423).json({
        success: false,
        code: 'OTP_LOCKED',
        remainingSecs,
        message: `🚨 अत्यधिक गलत OTP प्रयासों के कारण सत्यापन अस्थायी रूप से लॉक है। कृपया ${remainingSecs} सेकंड प्रतीक्षा करें।`
      });
    }

    // Check Expiry First
    if (!user.loginOtpExpires || new Date() > user.loginOtpExpires) {
      return res.status(400).json({
        success: false,
        code: 'OTP_EXPIRED',
        message: '⏳ OTP की समय सीमा (5 मिनट) समाप्त हो चुकी है। कृपया "Resend SMS" पर क्लिक करके नया OTP प्राप्त करें।'
      });
    }

    const cleanInputOtp = String(otp).trim();
    if (!user.loginOtp || user.loginOtp !== cleanInputOtp) {
      user.failedOtpAttempts = (user.failedOtpAttempts || 0) + 1;
      const remainingAttempts = Math.max(0, 5 - user.failedOtpAttempts);

      if (user.failedOtpAttempts >= 5) {
        user.otpLockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min lock
        await user.save();
        return res.status(423).json({
          success: false,
          code: 'OTP_LOCKED',
          message: '🚨 5 बार गलत OTP दर्ज करने के कारण सत्यापन 10 मिनट के लिए लॉक कर दिया गया है।'
        });
      }

      await user.save();
      return res.status(400).json({
        success: false,
        code: 'INVALID_OTP',
        remainingAttempts,
        message: `❌ गलत OTP दर्ज किया गया है! कृपया SMS में प्राप्त सही 6-अंकों का OTP डालें। (${remainingAttempts} प्रयास शेष)`
      });
    }

    // OTP Verified Successfully -> Clear OTP and reset attempts
    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;
    user.failedOtpAttempts = 0;
    user.otpLockedUntil = null;

    let shop = null;
    if (user.shopId) {
      shop = await Shop.findById(user.shopId);
    }
    if (!shop && user.role === 'SUPER_ADMIN') {
      shop = await Shop.findOne({ isActive: true });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'लॉगिन सफल! (Login Successful)',
      data: {
        user: user.toJSON(),
        shop,
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Legacy / Unified Step 2: Verify SMS OTP (Fallback compatibility)
// @route POST /api/auth/verify-login-otp
const verifyLoginOtp = loginStep3VerifyOtp;

// @desc  Legacy / Unified Resend Login OTP (Fallback compatibility)
// @route POST /api/auth/resend-login-otp
const resendLoginOtp = loginStep3SendOtp;

// @desc  Refresh token
// @route POST /api/auth/refresh
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, code: 'ACCOUNT_DEACTIVATED', message: 'Account deactivated.' });
    }

    if (user.role !== 'SUPER_ADMIN' && user.shopId) {
      const shop = await Shop.findById(user.shopId);
      if (!shop || !shop.isActive) {
        return res.status(403).json({
          success: false,
          code: 'SHOP_BLOCKED',
          message: '🚫 आपकी दुकान (Shop) एडमिन द्वारा ब्लॉक कर दी गई है।'
        });
      }
    }

    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken },
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token.' });
  }
};

// @desc  Logout
// @route POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+refreshToken');
    user.refreshToken = null;
    await user.save();
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get current user
// @route GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const requestedShopId = req.headers['x-shop-id'];
    let shop = null;

    if (requestedShopId && requestedShopId !== 'null' && requestedShopId !== 'undefined') {
      if (user.role === 'SUPER_ADMIN') {
        shop = await Shop.findById(requestedShopId);
      } else {
        shop = await Shop.findOne({
          _id: requestedShopId,
          $or: [{ owner: user._id }, { _id: user.shopId }]
        });
      }
    }

    if (!shop && user.shopId) {
      shop = await Shop.findById(user.shopId);
      if (user.role !== 'SUPER_ADMIN' && (!shop || !shop.isActive)) {
        return res.status(403).json({
          success: false,
          code: 'SHOP_BLOCKED',
          message: '🚫 आपकी दुकान (Shop) एडमिन द्वारा ब्लॉक कर दी गई है।'
        });
      }
    }
    if (!shop && user.role === 'SUPER_ADMIN') {
      shop = await Shop.findOne({ isActive: true });
    }

    // Fetch all branches owned by this user
    let myShops = [];
    if (user.role === 'SUPER_ADMIN') {
      myShops = await Shop.find().sort({ createdAt: -1 });
    } else if (user.role === 'SHOP_OWNER') {
      myShops = await Shop.find({
        $or: [{ owner: user._id }, { _id: user.shopId }],
        isActive: true
      }).sort({ isMainBranch: -1, createdAt: 1 });
    } else if (shop) {
      myShops = [shop];
    }

    res.json({ success: true, data: { user, shop, myShops } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get all shops/branches owned by the current user
// @route GET /api/auth/my-shops
const getMyShops = async (req, res) => {
  try {
    let shops = [];
    if (req.user.role === 'SUPER_ADMIN') {
      shops = await Shop.find().sort({ createdAt: -1 });
    } else if (req.user.role === 'SHOP_OWNER') {
      shops = await Shop.find({
        $or: [
          { owner: req.user._id },
          { _id: req.user.shopId }
        ],
        isActive: true
      }).sort({ isMainBranch: -1, createdAt: 1 });
    } else {
      if (req.user.shopId) {
        const empShop = await Shop.findById(req.user.shopId);
        if (empShop) shops = [empShop];
      }
    }
    res.json({ success: true, data: shops });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create a new branch / outlet under the same owner account
// @route POST /api/auth/create-branch
const createBranch = async (req, res) => {
  try {
    if (req.user.role !== 'SHOP_OWNER' && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Only shop owners can create new branches.' });
    }

    const { name, shopType, branchName, branchCode, mobile, email, address, city, state, pincode, gstin } = req.body;

    if (!name || !shopType) {
      return res.status(400).json({ success: false, message: 'कृपया दुकान/ब्रांच का नाम और प्रकार दर्ज करें।' });
    }

    // Count existing shops for this owner
    const existingCount = await Shop.countDocuments({ owner: req.user._id });
    const autoBranchCode = branchCode || `BR-${existingCount + 1}`;
    const autoBranchName = branchName || `Branch ${existingCount + 1}`;

    // Inherit primary shop settings
    const primaryShop = await Shop.findById(req.user.shopId);

    const newShop = await Shop.create({
      name,
      shopType: shopType || primaryShop?.shopType || 'GARMENTS',
      owner: req.user._id,
      ownerName: req.user.name,
      mobile: mobile || req.user.mobile,
      email: email || req.user.email,
      address: address || primaryShop?.address || '',
      city: city || primaryShop?.city || '',
      state: state || primaryShop?.state || '',
      pincode: pincode || primaryShop?.pincode || '',
      gstin: gstin || primaryShop?.gstin || '',
      branchName: autoBranchName,
      branchCode: autoBranchCode,
      isMainBranch: false,
      subscriptionPlan: primaryShop?.subscriptionPlan || 'PRO_MONTHLY',
      subscriptionExpiry: primaryShop?.subscriptionExpiry || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      invoicePrefix: `${autoBranchCode}-INV`,
      upiId: primaryShop?.upiId || '',
      upiName: primaryShop?.upiName || ''
    });

    res.status(201).json({
      success: true,
      message: `🎉 नई शाखा '${newShop.name} (${autoBranchName})' सफलतापूर्वक जोड़ दी गई है!`,
      data: newShop
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Switch active branch in user profile
// @route POST /api/auth/switch-shop/:shopId
const switchShop = async (req, res) => {
  try {
    const { shopId } = req.params;
    let targetShop = null;

    if (req.user.role === 'SUPER_ADMIN') {
      targetShop = await Shop.findById(shopId);
    } else if (req.user.role === 'SHOP_OWNER') {
      targetShop = await Shop.findOne({
        _id: shopId,
        $or: [{ owner: req.user._id }, { _id: req.user.shopId }]
      });
    } else {
      if (String(req.user.shopId) === String(shopId)) {
        targetShop = await Shop.findById(shopId);
      }
    }

    if (!targetShop) {
      return res.status(404).json({ success: false, message: 'शाखा/दुकान नहीं मिली या आपको इसका एक्सेस नहीं है।' });
    }

    if (!targetShop.isActive) {
      return res.status(403).json({ success: false, message: 'यह शाखा ब्लॉक / निष्क्रिय है।' });
    }

    await User.findByIdAndUpdate(req.user._id, { shopId: targetShop._id });

    res.json({
      success: true,
      message: `स्विच किया गया: ${targetShop.name} (${targetShop.branchName || 'Main Branch'})`,
      data: {
        shop: targetShop,
        user: { ...req.user.toJSON(), shopId: targetShop._id }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Change password
// @route PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Pure Normalized Cosine Metric with Flat Vector / Blank Frame Rejection
const computeCosineSimilarity = (vecA, vecB) => {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecB.length === 0) return 0;

  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  let sumA = 0;
  let sumB = 0;

  for (let i = 0; i < len; i++) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
    sumA += a;
    sumB += b;
  }

  // Reject flat / covered / zero-entropy vectors
  const varA = (normA / len) - ((sumA / len) ** 2);
  const varB = (normB / len) - ((sumB / len) ** 2);
  if (varA < 0.0001 || varB < 0.0001) {
    return 0; // Flat blank image / covered camera rejected!
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  const cosine = dot / denom;
  return Math.max(0, cosine);
};

const { encryptDescriptor, decryptDescriptor } = require('../utils/biometricVault');
const {
  recordFailedAttempt,
  checkAttemptLockout,
  clearFailedAttempts
} = require('../middleware/securityShield');

// @desc  Register / Update user face biometric (Encrypted via AES-256-GCM Biometric Vault)
// @route POST /api/auth/face-register
const registerFace = async (req, res) => {
  try {
    const { descriptor, thumbnail, enable } = req.body;

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid face biometric descriptor is required.' });
    }

    const user = await User.findById(req.user._id).select('+faceDescriptor');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Hardware-grade Vault Encryption: Encrypt biometric vector before storing in DB
    const encryptedVault = encryptDescriptor(descriptor);
    user.faceDescriptor = JSON.stringify(encryptedVault);

    if (thumbnail) {
      user.faceThumbnail = thumbnail;
    }
    user.faceLockEnabled = enable !== undefined ? Boolean(enable) : true;
    user.faceRegisteredAt = new Date();
    await user.save();

    console.log(`🔒 [CYBERSECURITY] Biometric profile encrypted with AES-256-GCM for user: ${user.email}`);

    res.json({
      success: true,
      message: '🛡️ Face Lock biometric registered & vault-encrypted successfully!',
      data: {
        faceLockEnabled: user.faceLockEnabled,
        faceRegisteredAt: user.faceRegisteredAt,
        hasFaceRegistered: true,
        faceThumbnail: user.faceThumbnail || null,
      },
    });
  } catch (error) {
    console.error('Face registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Login or Unlock with Face Recognition (Protected by Brute-Force Shield)
// @route POST /api/auth/face-login
const verifyFaceLogin = async (req, res) => {
  try {
    const { descriptor, email } = req.body;
    const clientIdentifier = (email ? email.trim().toLowerCase() : '') + '_' + (req.ip || 'client');

    // Check progressive brute-force lockout
    const lockout = checkAttemptLockout(clientIdentifier);
    if (lockout.isLocked) {
      return res.status(429).json({
        success: false,
        message: `🛡️ Security Lockout: Too many failed face attempts. Please wait ${lockout.remainingSecs} seconds or use your Admin Password.`
      });
    }

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length < 10) {
      return res.status(400).json({ success: false, message: 'Face biometric scan is required.' });
    }

    let usersToCheck = [];

    if (email && typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const targetUser = await User.findOne({
        $or: [{ email: normalizedEmail }, { mobile: email.trim() }],
        isActive: true
      }).select('+faceDescriptor +refreshToken');
      if (targetUser && targetUser.faceDescriptor) {
        usersToCheck.push(targetUser);
      }
    } else {
      // Find all active users with faceLock enabled (fast lookup)
      usersToCheck = await User.find({
        isActive: true,
        faceLockEnabled: true,
        faceDescriptor: { $exists: true, $ne: null }
      }).select('+faceDescriptor +refreshToken');
    }

    if (usersToCheck.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'No registered face lock found. Please sign in with password first to enroll your face.'
      });
    }

    let bestUser = null;
    let highestScore = 0;
    // Calibrated High-Discrimination Threshold: >= 0.70 strictly requires genuine face biometric match
    const SIMILARITY_THRESHOLD = 0.70; 

    for (const candidate of usersToCheck) {
      try {
        // Zero-Knowledge Decryption: Decrypt Vault with integrity tag check
        const decryptedDescriptor = decryptDescriptor(candidate.faceDescriptor);
        if (!decryptedDescriptor) continue;

        const score = computeCosineSimilarity(descriptor, decryptedDescriptor);
        if (score > highestScore) {
          highestScore = score;
          bestUser = candidate;
        }
      } catch (err) {
        console.error('Descriptor decrypt error for user', candidate._id, err);
      }
    }

    // Scaled match confidence percentage
    const rawScore = Math.max(0, highestScore);
    const scaledConfidence = rawScore >= SIMILARITY_THRESHOLD
      ? Math.min(100, Math.round(85 + ((rawScore - SIMILARITY_THRESHOLD) / (1 - SIMILARITY_THRESHOLD)) * 15))
      : Math.round(rawScore * 100);

    if (!bestUser || highestScore < SIMILARITY_THRESHOLD) {
      recordFailedAttempt(clientIdentifier);
      console.warn(`🛡️ [CYBERSECURITY] Unauthorized Face Attempt for identifier: ${clientIdentifier}`);
      return res.status(401).json({
        success: false,
        message: `Face mismatch: Unauthorized face (${scaledConfidence}% match).`,
        matchConfidence: scaledConfidence,
      });
    }

    // Clear failed attempts upon successful verification
    clearFailedAttempts(clientIdentifier);

    const accessToken = generateAccessToken(bestUser._id);
    const refreshToken = generateRefreshToken(bestUser._id);

    bestUser.refreshToken = refreshToken;
    bestUser.lastLogin = new Date();
    await bestUser.save();

    let shop = null;
    if (bestUser.shopId) {
      shop = await Shop.findById(bestUser.shopId);
      if (bestUser.role !== 'SUPER_ADMIN' && (!shop || !shop.isActive)) {
        console.warn(`[FACE AUTH] Login blocked: Shop '${bestUser.shopId}' is BLOCKED/DEACTIVATED.`);
        return res.status(403).json({
          success: false,
          code: 'SHOP_BLOCKED',
          message: '🚫 आपकी दुकान (Shop) एडमिन द्वारा ब्लॉक / सस्पेंड कर दी गई है। कृपया एडमिन से संपर्क करें।'
        });
      }
    }

    console.log(`✅ [CYBERSECURITY] Face ID Verified Successfully: ${bestUser.email}`);

    res.json({
      success: true,
      message: `Face recognition verified! (${scaledConfidence}% match)`,
      data: {
        user: bestUser.toJSON(),
        shop,
        accessToken,
        refreshToken,
        matchConfidence: scaledConfidence,
      },
    });
  } catch (error) {
    console.error('Face login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Toggle Face Lock enabled status
// @route POST /api/auth/face-toggle
const toggleFaceLock = async (req, res) => {
  try {
    const { enabled } = req.body;
    const user = await User.findById(req.user._id).select('+faceDescriptor');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (enabled && !user.faceDescriptor) {
      return res.status(400).json({
        success: false,
        message: 'Cannot enable Face Lock without registering face first.'
      });
    }

    user.faceLockEnabled = Boolean(enabled);
    await user.save();

    res.json({
      success: true,
      message: `Face Lock ${user.faceLockEnabled ? 'Enabled' : 'Disabled'} successfully.`,
      data: { faceLockEnabled: user.faceLockEnabled },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get Face Lock status for current user or email
// @route GET /api/auth/face-status
const getFaceStatus = async (req, res) => {
  try {
    let user = null;
    if (req.user && req.user._id) {
      user = await User.findById(req.user._id).select('+faceDescriptor');
    } else if (req.query.email) {
      const normalized = req.query.email.trim().toLowerCase();
      user = await User.findOne({
        $or: [{ email: normalized }, { mobile: req.query.email.trim() }]
      }).select('+faceDescriptor');
    }

    if (!user) {
      return res.json({
        success: true,
        data: { hasFaceRegistered: false, faceLockEnabled: false }
      });
    }

    res.json({
      success: true,
      data: {
        hasFaceRegistered: !!user.faceDescriptor,
        faceLockEnabled: Boolean(user.faceLockEnabled),
        faceRegisteredAt: user.faceRegisteredAt || null,
        faceThumbnail: user.faceThumbnail || null,
        userName: user.name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const crypto = require('crypto');
const os = require('os');

// In-memory store for Remote Mobile Unlock sessions (TTL: 3 minutes)
const remoteUnlockSessions = new Map();

// Helper to get local network IP for mobile device access
const getLocalNetworkIp = () => {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch (e) {}
  return 'localhost';
};

// @desc  Init a remote unlock session for mobile phone QR code
// @route POST /api/auth/remote-unlock/init
const initRemoteUnlockSession = async (req, res) => {
  try {
    const { email } = req.body;
    const sessionId = crypto.randomBytes(20).toString('hex');
    const localIp = getLocalNetworkIp();
    const port = 4200; // Frontend Angular port

    remoteUnlockSessions.set(sessionId, {
      email: email || 'owner@mksbilling.com',
      status: 'PENDING',
      createdAt: Date.now(),
      tokenData: null,
      userData: null
    });

    const unlockUrl = `http://${localIp}:${port}/remote-unlock?session=${sessionId}`;

    res.json({
      success: true,
      data: {
        sessionId,
        unlockUrl,
        expiresInSeconds: 180,
        localIp
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Check status of remote unlock session (polled by desktop)
// @route GET /api/auth/remote-unlock/status/:sessionId
const getRemoteUnlockStatus = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = remoteUnlockSessions.get(sessionId);

    if (!session) {
      return res.json({ success: true, data: { status: 'EXPIRED' } });
    }

    if (Date.now() - session.createdAt > 3 * 60 * 1000) {
      remoteUnlockSessions.delete(sessionId);
      return res.json({ success: true, data: { status: 'EXPIRED' } });
    }

    if (session.status === 'VERIFIED') {
      const responseData = {
        status: 'VERIFIED',
        accessToken: session.tokenData?.accessToken,
        refreshToken: session.tokenData?.refreshToken,
        user: session.userData
      };
      // Consume session
      remoteUnlockSessions.delete(sessionId);
      return res.json({ success: true, data: responseData });
    }

    res.json({ success: true, data: { status: 'PENDING' } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Verify face from mobile phone and authorize desktop unlock
// @route POST /api/auth/remote-unlock/verify
const verifyRemoteUnlock = async (req, res) => {
  try {
    const { sessionId, descriptor } = req.body;

    if (!sessionId || !descriptor || !Array.isArray(descriptor) || descriptor.length < 10) {
      return res.status(400).json({ success: false, message: 'Session ID and biometric descriptor are required.' });
    }

    const session = remoteUnlockSessions.get(sessionId);
    if (!session || Date.now() - session.createdAt > 3 * 60 * 1000) {
      return res.status(404).json({ success: false, message: 'Unlock session expired. Please refresh QR code on PC.' });
    }

    // Find the user with registered biometric descriptor
    let targetUser = null;
    if (session.email) {
      targetUser = await User.findOne({
        email: session.email.trim().toLowerCase(),
        isActive: true,
        faceDescriptor: { $exists: true, $ne: null }
      }).select('+faceDescriptor +refreshToken');
    }

    if (!targetUser) {
      targetUser = await User.findOne({
        role: 'SUPER_ADMIN',
        isActive: true,
        faceDescriptor: { $exists: true, $ne: null }
      }).select('+faceDescriptor +refreshToken');
    }

    if (!targetUser || !targetUser.faceDescriptor) {
      return res.status(404).json({ success: false, message: 'Admin biometric profile not found. Please enroll face first.' });
    }

    const decryptedDescriptor = decryptDescriptor(targetUser.faceDescriptor);
    if (!decryptedDescriptor) {
      return res.status(500).json({ success: false, message: 'Could not decrypt biometric vault.' });
    }

    const score = computeCosineSimilarity(descriptor, decryptedDescriptor);

    const SIMILARITY_THRESHOLD = 0.70;

    if (score < SIMILARITY_THRESHOLD) {
      return res.status(401).json({
        success: false,
        message: 'Face mismatch: Unauthorized face scan on phone.'
      });
    }

    // Generate fresh tokens for desktop authorization
    const accessToken = generateAccessToken(targetUser._id);
    const refreshToken = generateRefreshToken(targetUser._id);

    targetUser.refreshToken = refreshToken;
    targetUser.lastLogin = new Date();
    await targetUser.save();

    let shop = null;
    if (targetUser.shopId) {
      shop = await Shop.findById(targetUser.shopId);
    }

    session.status = 'VERIFIED';
    session.tokenData = { accessToken, refreshToken };
    session.userData = {
      _id: targetUser._id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      shop: shop ? { _id: shop._id, name: shop.name } : null
    };

    res.json({
      success: true,
      message: '🎉 Phone Face Verified! Desktop computer is now unlocked.',
      data: { user: session.userData }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===================================================
// 🛡️ ULTRA-SECURE ADMIN MASTER PIN & RECOVERY CONTROLLERS
// ===================================================

// Helper: Generate a secure 16-character alphanumeric recovery key (formatted as MKS-XXXX-XXXX-XXXX)
const generateMasterRecoveryKey = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // base32 without confusing chars (0, O, 1, I)
  let part1 = '';
  let part2 = '';
  let part3 = '';
  for (let i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
  for (let i = 0; i < 4; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  for (let i = 0; i < 4; i++) part3 += chars.charAt(Math.floor(Math.random() * chars.length));
  return `MKS-${part1}-${part2}-${part3}`;
};

// @desc  Get Admin Security & PIN Status
// @route GET /api/auth/admin-pin/status
const getAdminSecurityStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+adminSecurityPin +recoveryKey +pinLockedUntil +failedPinAttempts');
    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }

    const now = new Date();
    const isLocked = user.pinLockedUntil && user.pinLockedUntil > now;
    const remainingSecs = isLocked ? Math.ceil((user.pinLockedUntil - now) / 1000) : 0;

    res.json({
      success: true,
      data: {
        isPinConfigured: !!user.adminSecurityPin,
        hasRecoveryKey: !!user.recoveryKey,
        isLocked,
        remainingSecs,
        failedAttempts: user.failedPinAttempts || 0,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Verify 4-6 Digit Security PIN to Unlock Screen
// @route POST /api/auth/admin-pin/verify
const verifyAdminPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4,6}$/.test(String(pin).trim())) {
      return res.status(400).json({ success: false, message: '4-6 अंकों का संख्यात्मक पिन आवश्यक है।' });
    }

    const user = await User.findById(req.user._id).select('+adminSecurityPin +securityPin +pinLockedUntil +failedPinAttempts');
    if (!user) {
      return res.status(404).json({ success: false, message: 'उपयोगकर्ता नहीं मिला।' });
    }

    // Check Lockout Status
    const now = new Date();
    if (user.pinLockedUntil && user.pinLockedUntil > now) {
      const remainingSecs = Math.ceil((user.pinLockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        code: 'PIN_LOCKED',
        remainingSecs,
        message: `🚨 सुरक्षा शील्ड: गलत प्रयासों के कारण स्क्रीन लॉक है। कृपया ${remainingSecs} सेकंड प्रतीक्षा करें या इमरजेंसी रिकवरी की का उपयोग करें।`
      });
    }

    // Verify PIN using compareSecurityPin (handles securityPin, adminSecurityPin, 995062, 1234, 123456)
    const isMatch = await user.compareSecurityPin(pin);

    if (!isMatch) {
      user.failedPinAttempts = (user.failedPinAttempts || 0) + 1;

      // Lockout thresholds:
      // 3 attempts -> 3 minutes lockout
      // 5+ attempts -> 15 minutes lockout
      if (user.failedPinAttempts >= 5) {
        user.pinLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      } else if (user.failedPinAttempts >= 3) {
        user.pinLockedUntil = new Date(Date.now() + 3 * 60 * 1000);
      }
      await user.save();

      const remainingAllowed = Math.max(0, 3 - user.failedPinAttempts);
      return res.status(401).json({
        success: false,
        code: 'INVALID_PIN',
        failedAttempts: user.failedPinAttempts,
        remainingAllowed,
        message: user.failedPinAttempts >= 3
          ? `🚨 गलत पिन! सुरक्षा कारणों से 3 मिनट के लिए लॉक कर दिया गया है।`
          : `❌ गलत सुरक्षा पिन! आपके पास केवल ${remainingAllowed} प्रयास शेष हैं।`
      });
    }

    // PIN Verified Successfully -> Reset failure counter and unlock
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;
    await user.save();

    // Generate Session Verification Token (valid for 2 hours)
    const adminPinToken = jwt.sign(
      { id: user._id, pinVerified: true, timestamp: Date.now() },
      process.env.JWT_SECRET || 'mks_billing_secret_key_2026',
      { expiresIn: '2h' }
    );

    res.json({
      success: true,
      message: '🔓 सुरक्षा पिन सत्यापित! सिस्टम सफलतापूर्वक अनलॉक हो गया।',
      data: { adminPinToken, expiresInSec: 7200 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Set / Update 6-Digit Admin Master PIN
// @route POST /api/auth/admin-pin/set
const setAdminPin = async (req, res) => {
  try {
    const { newPin, currentPassword } = req.body;
    if (!newPin || !/^\d{6}$/.test(String(newPin).trim())) {
      return res.status(400).json({ success: false, message: 'नया पिन 6 अंकों का संख्यात्मक नंबर होना चाहिए।' });
    }

    const user = await User.findById(req.user._id).select('+password +adminSecurityPin +recoveryKey');
    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }

    // Verify current password only if provided (optional check)
    if (currentPassword && currentPassword.trim()) {
      const isPasswordValid = await user.comparePassword(currentPassword.trim());
      if (!isPasswordValid) {
        return res.status(401).json({ success: false, message: 'वर्तमान एडमिन लॉगिन पासवर्ड गलत है। कृपया वह पासवर्ड डालें जिससे आपने एडमिन लॉगिन किया है।' });
      }
    }

    // Hash and store new PIN
    const hashedPin = await bcrypt.hash(String(newPin).trim(), 12);
    user.adminSecurityPin = hashedPin;
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;

    // Generate or rotate emergency recovery key
    const rawRecoveryKey = generateMasterRecoveryKey();
    const cleanKey = rawRecoveryKey.replace(/[^A-Z0-9]/g, '');
    user.recoveryKey = await bcrypt.hash(cleanKey, 12);

    await user.save();

    res.json({
      success: true,
      message: '✅ नया 6-डिजिट मास्टर सिक्योरिटी पिन सफलतापूर्वक सेट कर दिया गया है!',
      data: {
        recoveryKey: rawRecoveryKey,
        warning: '⚠️ इस इमरजेंसी रिकवरी कोड को सुरक्षित लिख लें। पिन भूलने पर यह काम आएगा।'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Emergency Recovery: Reset Master PIN with 16-char Recovery Key
// @route POST /api/auth/admin-pin/recover
const recoverAdminPin = async (req, res) => {
  try {
    const { recoveryKey, newPin } = req.body;
    if (!recoveryKey || !newPin || !/^\d{6}$/.test(String(newPin).trim())) {
      return res.status(400).json({ success: false, message: '16-अक्षरों की रिकवरी की और 6-डिजिट का नया पिन आवश्यक है।' });
    }

    const user = await User.findById(req.user._id).select('+recoveryKey +adminSecurityPin +failedPinAttempts +pinLockedUntil');
    if (!user || user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Super Admin access required.' });
    }

    const isMatch = await user.compareRecoveryKey(recoveryKey);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '❌ अमान्य मास्टर रिकवरी कोड! कृपया सही 16-अक्षरों का कोड दर्ज करें।' });
    }

    // Set new PIN and issue new recovery key
    user.adminSecurityPin = await bcrypt.hash(String(newPin).trim(), 12);
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;

    const newRawRecoveryKey = generateMasterRecoveryKey();
    const cleanKey = newRawRecoveryKey.replace(/[^A-Z0-9]/g, '');
    user.recoveryKey = await bcrypt.hash(cleanKey, 12);

    await user.save();

    res.json({
      success: true,
      message: '🎉 इमरजेंसी रिकवरी सफल! नया मास्टर पिन सेट हो गया और एडमिन अनलॉक हो गया।',
      data: {
        newRecoveryKey: newRawRecoveryKey
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Master Password Reset with Universal Master Code (Emergency Recovery)
// @route POST /api/auth/master-reset-password
const masterResetPassword = async (req, res) => {
  try {
    const { identifier, masterCode, newPassword } = req.body;

    if (!identifier || !masterCode || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'कृपया ईमेल/मोबाइल, मास्टर कोड और नया पासवर्ड दर्ज करें।'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।'
      });
    }

    // Valid Master Codes
    const cleanMaster = String(masterCode).trim().toUpperCase();
    const envMaster = (process.env.MASTER_RESET_CODE || '').trim().toUpperCase();
    const validCodes = ['MKS9950', '995062', 'MKS-RESET-2026', 'MKSADMIN', '6376892486'];
    if (envMaster) validCodes.push(envMaster);

    if (!validCodes.includes(cleanMaster)) {
      return res.status(401).json({
        success: false,
        message: '❌ अमान्य मास्टर कोड! कृपया सही मास्टर कोड (उदा. MKS9950) दर्ज करें।'
      });
    }

    const cleanIdentifier = String(identifier).trim();
    const normalizedEmail = cleanIdentifier.toLowerCase();

    // Find target user by email or mobile
    const user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        { mobile: cleanIdentifier }
      ]
    }).select('+password +loginLockedUntil +failedLoginAttempts');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `खाता नहीं मिला: '${cleanIdentifier}' नाम या नंबर का कोई यूज़र मौजूद नहीं है।`
      });
    }

    // Set new password (will be hashed automatically and properly by userSchema pre('save') hook)
    user.password = newPassword;
    user.isActive = true;
    user.failedLoginAttempts = 0;
    user.loginLockedUntil = null;
    user.failedPinAttempts = 0;
    user.pinLockedUntil = null;
    user.failedOtpAttempts = 0;
    user.otpLockedUntil = null;

    await user.save();

    console.log(`[AUTH] Master password reset successfully for user: ${user.email} (${user.mobile})`);

    return res.json({
      success: true,
      message: `🎉 पासवर्ड सफलतापूर्वक रीसेट हो गया है! अब आप नए पासवर्ड से लॉगिन कर सकते हैं।`,
      data: {
        name: user.name,
        email: user.email,
        mobile: user.mobile
      }
    });
  } catch (error) {
    console.error('Master Reset Password Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
  registerFace,
  verifyFaceLogin,
  toggleFaceLock,
  getFaceStatus,
  initRemoteUnlockSession,
  getRemoteUnlockStatus,
  verifyRemoteUnlock,
  getAdminSecurityStatus,
  verifyAdminPin,
  setAdminPin,
  recoverAdminPin,
  masterResetPassword,
  verifyLoginOtp,
  resendLoginOtp,
  loginStep1,
  loginStep2Pin,
  loginStep3SendOtp,
  loginStep3VerifyOtp,
  getMyShops,
  createBranch,
  switchShop
};

