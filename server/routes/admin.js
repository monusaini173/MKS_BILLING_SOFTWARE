const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All admin routes strictly require Super Admin authentication
router.use(protect, authorize('SUPER_ADMIN'));

// 1. Dashboard Stats
router.get('/stats', getAdminDashboardStats);

// 2. Multi-Tenant Shop Management
router.route('/shops')
  .get(getAllShops)
  .post(createShop);

router.route('/shops/:id')
  .get(getShopById)
  .put(updateShop);

router.put('/shops/:id/toggle', toggleShopStatus);

// 🔥 3. 1-Click Shop Login / Impersonate
router.post('/shops/:id/impersonate', impersonateShop);

// 4. Subscriptions Management
router.get('/subscriptions', getAllSubscriptions);
router.put('/shops/:id/subscription', updateShopSubscription);

// 5. User & Staff Management
router.route('/users')
  .get(getAllUsers)
  .post(createUser);

router.route('/users/:id')
  .delete(deleteUser);

router.put('/users/:id/toggle', toggleUserStatus);
router.put('/users/:id/reset-password', resetUserPassword);

// 6. Dynamic Shop Types Engine
router.route('/shop-types')
  .get(getShopTypes)
  .post(createShopType);

router.route('/shop-types/:id')
  .put(updateShopType)
  .delete(deleteShopType);

// 7. System & Platform Settings
router.route('/system-settings')
  .get(getSystemSettings)
  .put(updateSystemSettings);

// 8. Platform Reports & Growth
router.get('/reports', getPlatformReports);

module.exports = router;
