const express = require('express');
const router = express.Router();
const {
  getDashboard, getSalesReport, getPurchaseReport, getProfitReport,
  getStockReport, getGSTReport, getExpenseReport,
  getCustomerOutstanding, getSupplierOutstanding,
  getCAMonthlyReport, downloadReport, getBackupData, getLiveAlerts
} = require('../controllers/reportController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

router.get('/dashboard', getDashboard);
router.get('/live-alerts', getLiveAlerts);
router.get('/sales', getSalesReport);
router.get('/purchases', getPurchaseReport);
router.get('/profit', getProfitReport);
router.get('/stock', getStockReport);
router.get('/gst', getGSTReport);
router.get('/expenses', getExpenseReport);
router.get('/customer-outstanding', getCustomerOutstanding);
router.get('/supplier-outstanding', getSupplierOutstanding);
router.get('/ca-monthly', getCAMonthlyReport);

// 📊 Quick Report Download (CSV) — Daily, 7 Day, 15 Day, Monthly
router.get('/download', downloadReport);

// 💾 Full Data Backup (JSON)
router.get('/backup', getBackupData);

module.exports = router;
