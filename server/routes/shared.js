const express = require('express');
const router = express.Router();
const {
  getCategories, createCategory, updateCategory, deleteCategory,
  getBrands, createBrand, updateBrand, deleteBrand,
  getSettings, updateSettings, updateShopProfile, sendMobileChangeOtp,
  getNotifications, markNotificationRead,
  getEmployees, createEmployee, updateEmployee, toggleEmployee,
  getAllShops, toggleShop, getAdminStats,
  getSubscriptionStatus, createRazorpaySubscriptionOrder, verifyRazorpaySubscriptionPayment, upgradeSubscription, adminUpdateSubscription,
} = require('../controllers/sharedController');
const { protect, requireShop, authorize } = require('../middleware/auth');

// Categories
const catRouter = express.Router();
catRouter.use(protect, requireShop);
catRouter.route('/').get(getCategories).post(createCategory);
catRouter.route('/:id').put(updateCategory).delete(deleteCategory);

// Brands
const brandRouter = express.Router();
brandRouter.use(protect, requireShop);
brandRouter.route('/').get(getBrands).post(createBrand);
brandRouter.route('/:id').put(updateBrand).delete(deleteBrand);

// Settings
const settingsRouter = express.Router();
settingsRouter.use(protect, requireShop);
settingsRouter.put('/profile', updateShopProfile);
settingsRouter.post('/send-mobile-otp', sendMobileChangeOtp);
settingsRouter.route('/').get(getSettings).put(updateSettings);

// Subscription
const subscriptionRouter = express.Router();
subscriptionRouter.use(protect, requireShop);
subscriptionRouter.get('/status', getSubscriptionStatus);
subscriptionRouter.post('/upgrade', upgradeSubscription);
subscriptionRouter.post('/razorpay/create-order', createRazorpaySubscriptionOrder);
subscriptionRouter.post('/razorpay/verify-payment', verifyRazorpaySubscriptionPayment);

// Notifications
const notifRouter = express.Router();
notifRouter.use(protect, requireShop);
notifRouter.get('/', getNotifications);
notifRouter.put('/mark-read', markNotificationRead);

// Employees
const empRouter = express.Router();
empRouter.use(protect, requireShop, authorize('SHOP_OWNER', 'SUPER_ADMIN'));
empRouter.route('/').get(getEmployees).post(createEmployee);
empRouter.route('/:id').put(updateEmployee);
empRouter.put('/:id/toggle', toggleEmployee);

// Admin
const adminRouter = express.Router();
adminRouter.use(protect, authorize('SUPER_ADMIN'));
adminRouter.get('/shops', getAllShops);
adminRouter.put('/shops/:id/toggle', toggleShop);
adminRouter.put('/shops/:id/subscription', adminUpdateSubscription);
adminRouter.get('/stats', getAdminStats);

module.exports = { catRouter, brandRouter, settingsRouter, subscriptionRouter, notifRouter, empRouter, adminRouter };

