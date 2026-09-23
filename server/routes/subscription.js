const express = require('express');
const router = express.Router();
const {
  getSubscriptionStatus,
  createRazorpaySubscriptionOrder,
  verifyRazorpaySubscriptionPayment,
  upgradeSubscription
} = require('../controllers/sharedController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

// Status
router.get('/status', getSubscriptionStatus);

// Direct upgrade
router.post('/upgrade', upgradeSubscription);

// Razorpay Order Creation (both path styles supported)
router.post('/create-order', createRazorpaySubscriptionOrder);
router.post('/razorpay/create-order', createRazorpaySubscriptionOrder);

// Razorpay Payment Verification (both path styles supported)
router.post('/verify-payment', verifyRazorpaySubscriptionPayment);
router.post('/razorpay/verify-payment', verifyRazorpaySubscriptionPayment);

module.exports = router;
