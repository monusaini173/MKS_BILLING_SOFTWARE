const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyLoginOtp,
  resendLoginOtp,
  loginStep1,
  loginStep2Pin,
  loginStep3SendOtp,
  loginStep3VerifyOtp,
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
  getMyShops,
  createBranch,
  switchShop
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  faceAuthLimiter,
  loginLimiter,
  validateBiometricPayload
} = require('../middleware/securityShield');

// Standard & 3-Tier Multi-Factor Authentication with Shield
router.post('/register', register);
router.post('/login', loginLimiter, login);
router.post('/master-reset-password', loginLimiter, masterResetPassword);
router.post('/login/verify-otp', loginLimiter, verifyLoginOtp);
router.post('/login/resend-otp', loginLimiter, resendLoginOtp);

// 🏢 Multi-Branch & Multi-Shop Endpoints
router.get('/my-shops', protect, getMyShops);
router.post('/create-branch', protect, createBranch);
router.post('/switch-shop/:shopId', protect, switchShop);

// 🔐 3-Tier Login Workflow: 1. Password -> 2. PIN -> 3. Mobile SMS OTP
router.post('/login-step1', loginLimiter, loginStep1);
router.post('/login-step2-pin', loginLimiter, loginStep2Pin);
router.post('/login-step3-send-otp', loginLimiter, loginStep3SendOtp);
router.post('/login-step3-verify-otp', loginLimiter, loginStep3VerifyOtp);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

// 🛡️ Ultra-Secure Admin Master PIN & Emergency Recovery Routes
router.get('/admin-pin/status', protect, getAdminSecurityStatus);
router.post('/admin-pin/verify', protect, verifyAdminPin);
router.post('/admin-pin/set', protect, setAdminPin);
router.post('/admin-pin/recover', protect, recoverAdminPin);

// Face Lock Biometric Endpoints with Hardware-grade Integrity & Rate-Limiting
router.post('/face-register', protect, validateBiometricPayload, registerFace);
router.post('/face-login', faceAuthLimiter, validateBiometricPayload, verifyFaceLogin);
router.post('/face-toggle', protect, toggleFaceLock);
router.get('/face-status', getFaceStatus);

// Remote Mobile Phone QR Unlock Endpoints with Secure Shield
router.post('/remote-unlock/init', faceAuthLimiter, initRemoteUnlockSession);
router.get('/remote-unlock/status/:sessionId', getRemoteUnlockStatus);
router.post('/remote-unlock/verify', faceAuthLimiter, validateBiometricPayload, verifyRemoteUnlock);

module.exports = router;

