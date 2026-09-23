const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Shop = require('../models/Shop');

const getDateRange = (filter, startDate, endDate) => {
  const now = new Date();
  let start, end;

  switch (filter) {
    case 'today':
      start = new Date(now); start.setHours(0, 0, 0, 0);
      end = new Date(now); end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday); start.setHours(0, 0, 0, 0);
      end = new Date(yesterday); end.setHours(23, 59, 59, 999);
      break;
    case '7days':
      start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setHours(23, 59, 59, 999);
      break;
    case '15days':
      start = new Date(); start.setDate(start.getDate() - 14); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start = new Date(now); start.setDate(now.getDate() - 7);
      end = new Date();
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      break;
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      break;
    case 'custom':
      start = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = endDate ? new Date(new Date(endDate).setHours(23, 59, 59)) : new Date();
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
  }
  return { start, end };
};

// @desc  Dashboard stats
// @route GET /api/reports/dashboard
const getDashboard = async (req, res) => {
  try {
    const shopId = req.shopId;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const todaySales = await Sale.aggregate([
      { $match: { shopId, invoiceDate: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 }, paid: { $sum: '$amountPaid' } } }
    ]);
    const todayPurchases = await Purchase.aggregate([
      { $match: { shopId, purchaseDate: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
    ]);
    const todayExpenses = await Expense.aggregate([
      { $match: { shopId, date: { $gte: todayStart, $lte: todayEnd } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const monthlySales = await Sale.aggregate([
      { $match: { shopId, invoiceDate: { $gte: monthStart }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
    ]);
    const monthlyPurchases = await Purchase.aggregate([
      { $match: { shopId, purchaseDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } }
    ]);
    const monthlyExpenses = await Expense.aggregate([
      { $match: { shopId, date: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const prodQuery = { shopId, isActive: true };
    const totalProducts = await Product.countDocuments(prodQuery);
    const lowStockProducts = await Product.countDocuments({ ...prodQuery, $expr: { $lte: ['$quantity', '$minStockLevel'] } });
    const outOfStock = await Product.countDocuments({ ...prodQuery, quantity: 0 });
    const totalCustomers = await Customer.countDocuments({ shopId, isActive: true });
    const totalSuppliers = await Supplier.countDocuments({ shopId, isActive: true });
    const pendingCustomers = await Customer.aggregate([
      { $match: { shopId, pendingAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pendingAmount' } } }
    ]);
    const pendingSuppliers = await Supplier.aggregate([
      { $match: { shopId, pendingAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$pendingAmount' } } }
    ]);

    // Last 10 bills with details
    const recentBills = await Sale.find({ shopId })
      .sort({ invoiceDate: -1 })
      .limit(10)
      .select('invoiceNumber invoiceDate customerName grandTotal amountPaid balanceDue status paymentMethod');

    // ALL-TIME Bills Stats
    const totalBillsAgg = await Sale.aggregate([
      { $match: { shopId, status: { $ne: 'CANCELLED' } } },
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalAmount: { $sum: '$grandTotal' },
          totalPaid: { $sum: '$amountPaid' },
          totalPending: { $sum: '$balanceDue' },
          paidCount: { $sum: { $cond: [{ $eq: ['$status', 'PAID'] }, 1, 0] } },
          pendingCount: { $sum: { $cond: [{ $in: ['$status', ['PENDING', 'PARTIAL']] }, 1, 0] } }
        }
      }
    ]);

    // Monthly sales chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    const monthlySalesChart = await Sale.aggregate([
      { $match: { shopId, invoiceDate: { $gte: sixMonthsAgo }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: { year: { $year: '$invoiceDate' }, month: { $month: '$invoiceDate' } }, total: { $sum: '$grandTotal' } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Today's Payment Methods Breakdown
    const todayPaymentMethods = await Sale.aggregate([
      { $match: { shopId, invoiceDate: { $gte: todayStart, $lte: todayEnd }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: '$paymentMethod', total: { $sum: '$grandTotal' }, paid: { $sum: '$amountPaid' }, count: { $sum: 1 } } }
    ]);

    let todayCash = 0, todayCashCount = 0;
    let todayUpi = 0, todayUpiCount = 0;
    let todayCard = 0, todayCardCount = 0;
    let todayOther = 0, todayOtherCount = 0;

    todayPaymentMethods.forEach(pm => {
      const mode = (pm._id || '').toUpperCase();
      if (mode.includes('CASH')) {
        todayCash += pm.total;
        todayCashCount += pm.count;
      } else if (mode.includes('UPI') || mode.includes('ONLINE') || mode.includes('QR') || mode.includes('GPAY') || mode.includes('PAYTM')) {
        todayUpi += pm.total;
        todayUpiCount += pm.count;
      } else if (mode.includes('CARD') || mode.includes('DEBIT') || mode.includes('CREDIT_CARD')) {
        todayCard += pm.total;
        todayCardCount += pm.count;
      } else {
        todayOther += pm.total;
        todayOtherCount += pm.count;
      }
    });

    const todaySalesData = todaySales[0] || { total: 0, count: 0, paid: 0 };
    const todayPurchasesData = todayPurchases[0] || { total: 0, count: 0 };
    const todayExpensesData = todayExpenses[0] || { total: 0 };
    const monthlySalesData = monthlySales[0] || { total: 0, count: 0 };
    const monthlyPurchasesData = monthlyPurchases[0] || { total: 0 };
    const monthlyExpensesData = monthlyExpenses[0] || { total: 0 };
    const billsStats = totalBillsAgg[0] || { totalCount: 0, totalAmount: 0, totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0 };

    res.json({
      success: true,
      data: {
        todaySales: todaySalesData.total,
        todaySalesCount: todaySalesData.count,
        todayPurchases: todayPurchasesData.total,
        todayExpenses: todayExpensesData.total,
        todayProfit: todaySalesData.total - todayPurchasesData.total - todayExpensesData.total,
        // Live Payment Methods Breakdown
        todayCashAmount: todayCash,
        todayCashCount: todayCashCount,
        todayUpiAmount: todayUpi,
        todayUpiCount: todayUpiCount,
        todayCardAmount: todayCard,
        todayCardCount: todayCardCount,
        todayOtherAmount: todayOther,
        todayOtherCount: todayOtherCount,
        monthlySales: monthlySalesData.total,
        monthlySalesCount: monthlySalesData.count,
        monthlyPurchases: monthlyPurchasesData.total,
        monthlyExpenses: monthlyExpensesData.total,
        monthlyProfit: monthlySalesData.total - monthlyPurchasesData.total - monthlyExpensesData.total,
        totalProducts, lowStockProducts, outOfStock, totalCustomers, totalSuppliers,
        pendingCustomerAmount: pendingCustomers[0]?.total || 0,
        pendingSupplierAmount: pendingSuppliers[0]?.total || 0,
        recentBills, monthlySalesChart,
        // ALL BILLS STATS
        totalBillsCount: billsStats.totalCount,
        totalBillsAmount: billsStats.totalAmount,
        totalBillsPaid: billsStats.totalPaid,
        totalBillsPending: billsStats.totalPending,
        paidBillsCount: billsStats.paidCount,
        pendingBillsCount: billsStats.pendingCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Download Report as CSV (Daily/7-day/15-day/Monthly)
// @route GET /api/reports/download?period=today|7days|15days|month&type=sales|purchases
const downloadReport = async (req, res) => {
  try {
    const { period = 'today', startDate, endDate, type = 'sales' } = req.query;
    const shopId = req.shopId;
    const { start, end } = getDateRange(period, startDate, endDate);

    const periodLabel = {
      today: 'Today', '7days': 'Last_7_Days', '15days': 'Last_15_Days',
      month: 'This_Month', year: 'This_Year',
      custom: `${startDate}_to_${endDate}`
    }[period] || period;

    let csvRows = [];
    let filename = '';
    const today = new Date().toISOString().slice(0, 10);

    if (type === 'sales') {
      const sales = await Sale.find({
        shopId, invoiceDate: { $gte: start, $lte: end }, status: { $ne: 'CANCELLED' }
      }).sort({ invoiceDate: -1 });

      filename = `Sales_Report_${periodLabel}_${today}.csv`;
      csvRows.push(['Invoice No','Date','Time','Customer Name','Mobile','Items','Subtotal (Rs)','Discount (Rs)','GST (Rs)','Grand Total (Rs)','Amount Paid (Rs)','Balance Due (Rs)','Payment Method','Status'].join(','));

      sales.forEach(s => {
        const date = new Date(s.invoiceDate);
        csvRows.push([
          `"${s.invoiceNumber || ''}"`,
          `"${date.toLocaleDateString('en-IN')}"`,
          `"${date.toLocaleTimeString('en-IN')}"`,
          `"${(s.customerName || 'Walk-in').replace(/"/g, "'")}"`,
          `"${s.customerMobile || ''}"`,
          s.items?.length || 0,
          (s.subtotal || 0).toFixed(2),
          (s.totalDiscount || 0).toFixed(2),
          (s.totalGst || 0).toFixed(2),
          (s.grandTotal || 0).toFixed(2),
          (s.amountPaid || 0).toFixed(2),
          (s.balanceDue || 0).toFixed(2),
          `"${s.paymentMethod || 'CASH'}"`,
          `"${s.status || 'PAID'}"`
        ].join(','));
      });

      const totalAmt = sales.reduce((s, r) => s + (r.grandTotal || 0), 0);
      const totalPaid = sales.reduce((s, r) => s + (r.amountPaid || 0), 0);
      const totalDue = sales.reduce((s, r) => s + (r.balanceDue || 0), 0);
      csvRows.push('');
      csvRows.push(`"=== TOTAL: ${sales.length} Bills ===",,,,,,,,,"${totalAmt.toFixed(2)}","${totalPaid.toFixed(2)}","${totalDue.toFixed(2)}",,`);

    } else if (type === 'purchases') {
      const purchases = await Purchase.find({
        shopId, purchaseDate: { $gte: start, $lte: end }
      }).sort({ purchaseDate: -1 });

      filename = `Purchase_Report_${periodLabel}_${today}.csv`;
      csvRows.push(['Purchase No','Date','Supplier Name','Items','Subtotal (Rs)','GST (Rs)','Grand Total (Rs)','Payment Method'].join(','));

      purchases.forEach(p => {
        const date = new Date(p.purchaseDate || p.createdAt);
        csvRows.push([
          `"${p.purchaseNumber || p.billNumber || ''}"`,
          `"${date.toLocaleDateString('en-IN')}"`,
          `"${(p.supplierName || 'Direct').replace(/"/g, "'")}"`,
          p.items?.length || 0,
          (p.subtotal || 0).toFixed(2),
          (p.totalGst || 0).toFixed(2),
          (p.grandTotal || 0).toFixed(2),
          `"${p.paymentMethod || 'CASH'}"`
        ].join(','));
      });

      const totalAmt = purchases.reduce((s, r) => s + (r.grandTotal || 0), 0);
      csvRows.push('');
      csvRows.push(`"=== TOTAL: ${purchases.length} Purchases ===",,,,,"${totalAmt.toFixed(2)}",,`);
    }

    const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for Excel Hindi support
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Full Data Backup Download (JSON)
// @route GET /api/reports/backup
const getBackupData = async (req, res) => {
  try {
    const shopId = req.shopId;

    const [sales, purchases, customers, suppliers, products, expenses] = await Promise.all([
      Sale.find({ shopId }).sort({ invoiceDate: -1 }).limit(5000),
      Purchase.find({ shopId }).sort({ purchaseDate: -1 }).limit(2000),
      Customer.find({ shopId }),
      Supplier.find({ shopId }),
      Product.find({ shopId }),
      Expense.find({ shopId }).sort({ date: -1 }).limit(2000)
    ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      shopId: shopId.toString(),
      version: '1.0',
      counts: {
        sales: sales.length, purchases: purchases.length,
        customers: customers.length, suppliers: suppliers.length,
        products: products.length, expenses: expenses.length
      },
      sales, purchases, customers, suppliers, products, expenses
    };

    const filename = `MKS_Backup_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(backupData, null, 2));

  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Sales report
// @route GET /api/reports/sales
const getSalesReport = async (req, res) => {
  try {
    const { filter = 'month', startDate, endDate, search, status, paymentMethod, branch, allBranches } = req.query;
    let targetShopId = req.shopId;

    if (allBranches === 'true' || branch === 'ALL') {
      const ownedShops = await Shop.find({
        $or: [{ owner: req.user._id }, { _id: req.user.shopId }]
      }).select('_id');
      targetShopId = { $in: ownedShops.map(s => s._id) };
    } else if (branch && branch !== 'ALL' && mongoose.isValidObjectId(branch)) {
      targetShopId = branch;
    }

    const query = { shopId: targetShopId, status: { $ne: 'CANCELLED' } };

    if (filter !== 'all') {
      const { start, end } = getDateRange(filter, startDate, endDate);
      query.invoiceDate = { $gte: start, $lte: end };
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { customerName: { $regex: s, $options: 'i' } },
        { invoiceNumber: { $regex: s, $options: 'i' } },
        { customerMobile: { $regex: s, $options: 'i' } },
      ];
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (paymentMethod && paymentMethod !== 'ALL') {
      query.paymentMethod = paymentMethod;
    }

    const sales = await Sale.find(query).sort({ invoiceDate: -1 });
    const summary = await Sale.aggregate([
      { $match: query },
      { $group: { _id: null, totalSales: { $sum: '$grandTotal' }, totalGST: { $sum: '$totalGst' }, totalDiscount: { $sum: '$totalDiscount' }, totalPaid: { $sum: '$amountPaid' }, totalPending: { $sum: '$balanceDue' }, count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data: { sales, summary: summary[0] || {}, count: sales.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Purchase report
// @route GET /api/reports/purchases
const getPurchaseReport = async (req, res) => {
  try {
    const { filter = 'month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(filter, startDate, endDate);
    const purchases = await Purchase.find({ shopId: req.shopId, purchaseDate: { $gte: start, $lte: end } }).sort({ purchaseDate: -1 });
    const summary = await Purchase.aggregate([
      { $match: { shopId: req.shopId, purchaseDate: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$grandTotal' }, count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data: { purchases, summary: summary[0] || {}, dateRange: { start, end } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Profit report
// @route GET /api/reports/profit
const getProfitReport = async (req, res) => {
  try {
    const { filter = 'month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(filter, startDate, endDate);
    const [salesAgg, purchasesAgg, expensesAgg] = await Promise.all([
      Sale.aggregate([{ $match: { shopId: req.shopId, invoiceDate: { $gte: start, $lte: end }, status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Purchase.aggregate([{ $match: { shopId: req.shopId, purchaseDate: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$grandTotal' } } }]),
      Expense.aggregate([{ $match: { shopId: req.shopId, date: { $gte: start, $lte: end } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);
    const totalSales = salesAgg[0]?.total || 0;
    const totalPurchases = purchasesAgg[0]?.total || 0;
    const totalExpenses = expensesAgg[0]?.total || 0;
    res.json({ success: true, data: { totalSales, totalPurchases, totalExpenses, grossProfit: totalSales - totalPurchases, netProfit: totalSales - totalPurchases - totalExpenses, dateRange: { start, end } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Stock report
// @route GET /api/reports/stock
const getStockReport = async (req, res) => {
  try {
    const { lowStock } = req.query;
    const query = { shopId: req.shopId, isActive: true };
    if (lowStock === 'true') query.$expr = { $lte: ['$quantity', '$minStockLevel'] };
    const products = await Product.find(query).sort({ quantity: 1 });
    const stockValue = products.reduce((sum, p) => sum + (p.quantity * p.purchasePrice), 0);
    res.json({ success: true, data: { products, stockValue } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  GST report
// @route GET /api/reports/gst
const getGSTReport = async (req, res) => {
  try {
    const { filter = 'month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(filter, startDate, endDate);
    const gstSummary = await Sale.aggregate([
      { $match: { shopId: req.shopId, invoiceDate: { $gte: start, $lte: end }, status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, totalCgst: { $sum: '$totalCgst' }, totalSgst: { $sum: '$totalSgst' }, totalIgst: { $sum: '$totalIgst' }, totalGst: { $sum: '$totalGst' }, taxableAmount: { $sum: { $subtract: ['$grandTotal', '$totalGst'] } } } }
    ]);
    const sales = await Sale.find({ shopId: req.shopId, invoiceDate: { $gte: start, $lte: end }, status: { $ne: 'CANCELLED' } }).sort({ invoiceDate: -1 });
    res.json({ success: true, data: { gstSummary: gstSummary[0] || {}, sales, dateRange: { start, end } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Expense report
// @route GET /api/reports/expenses
const getExpenseReport = async (req, res) => {
  try {
    const { filter = 'month', startDate, endDate } = req.query;
    const { start, end } = getDateRange(filter, startDate, endDate);
    const expenses = await Expense.find({ shopId: req.shopId, date: { $gte: start, $lte: end } }).sort({ date: -1 });
    const byCategory = await Expense.aggregate([
      { $match: { shopId: req.shopId, date: { $gte: start, $lte: end } } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);
    res.json({ success: true, data: { expenses, byCategory, dateRange: { start, end } } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Customer outstanding
const getCustomerOutstanding = async (req, res) => {
  try {
    const customers = await Customer.find({ shopId: req.shopId, pendingAmount: { $gt: 0 }, isActive: true }).sort({ pendingAmount: -1 });
    const total = customers.reduce((sum, c) => sum + c.pendingAmount, 0);
    res.json({ success: true, data: { customers, totalOutstanding: total } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Supplier outstanding
const getSupplierOutstanding = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ shopId: req.shopId, pendingAmount: { $gt: 0 }, isActive: true }).sort({ pendingAmount: -1 });
    const total = suppliers.reduce((sum, s) => sum + s.pendingAmount, 0);
    res.json({ success: true, data: { suppliers, totalOutstanding: total } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  CA Monthly Report
// @route GET /api/reports/ca-monthly
const getCAMonthlyReport = async (req, res) => {
  try {
    const { filter = 'month', startDate, endDate, month, year } = req.query;
    let start, end;
    if (month && year) {
      const m = parseInt(month) - 1, y = parseInt(year);
      start = new Date(y, m, 1, 0, 0, 0, 0);
      end = new Date(y, m + 1, 0, 23, 59, 59, 999);
    } else {
      const range = getDateRange(filter, startDate, endDate);
      start = range.start; end = range.end;
    }
    const shopId = req.shopId;
    const sales = await Sale.find({ shopId, invoiceDate: { $gte: start, $lte: end }, status: { $ne: 'CANCELLED' } }).populate('customerId', 'name mobile gstin address').sort({ invoiceDate: 1 });
    const purchases = await Purchase.find({ shopId, purchaseDate: { $gte: start, $lte: end } }).populate('supplierId', 'name companyName mobile gstin address').sort({ purchaseDate: 1 });

    let totalSalesAmount = 0, totalTaxableSales = 0, totalSalesCgst = 0, totalSalesSgst = 0, totalSalesIgst = 0, totalSalesGst = 0, totalSalesDiscount = 0;
    let b2bSalesCount = 0, b2bSalesAmount = 0, b2cSalesCount = 0, b2cSalesAmount = 0;

    const formattedSales = sales.map(s => {
      const taxable = s.subtotal || Math.max(0, (s.grandTotal || 0) - (s.totalGst || 0));
      totalSalesAmount += (s.grandTotal || 0); totalTaxableSales += taxable;
      totalSalesCgst += (s.totalCgst || 0); totalSalesSgst += (s.totalSgst || 0);
      totalSalesIgst += (s.totalIgst || 0); totalSalesGst += (s.totalGst || 0);
      totalSalesDiscount += (s.totalDiscount || 0);
      const custGstin = s.customerGstin || s.customerId?.gstin || '';
      const isB2B = !!(custGstin && custGstin.trim().length >= 10);
      if (isB2B) { b2bSalesCount++; b2bSalesAmount += (s.grandTotal || 0); }
      else { b2cSalesCount++; b2cSalesAmount += (s.grandTotal || 0); }
      return {
        _id: s._id, invoiceNumber: s.invoiceNumber, invoiceDate: s.invoiceDate,
        customerName: s.customerName || s.customerId?.name || 'Walk-in Customer',
        customerMobile: s.customerMobile || s.customerId?.mobile || '',
        customerGstin: custGstin, isB2B, paymentMethod: s.paymentMethod,
        paymentStatus: s.paymentStatus || 'PAID', itemCount: s.items?.length || 0,
        subtotal: parseFloat(taxable.toFixed(2)), totalDiscount: parseFloat((s.totalDiscount || 0).toFixed(2)),
        totalCgst: parseFloat((s.totalCgst || 0).toFixed(2)), totalSgst: parseFloat((s.totalSgst || 0).toFixed(2)),
        totalIgst: parseFloat((s.totalIgst || 0).toFixed(2)), totalGst: parseFloat((s.totalGst || 0).toFixed(2)),
        grandTotal: parseFloat((s.grandTotal || 0).toFixed(2)),
        items: (s.items || []).map(i => ({ productName: i.productName, quantity: i.quantity, unit: i.unit, rate: i.rate, hsnCode: i.hsnCode || '', gstPercent: i.gstPercent || 0, cgst: i.cgst || 0, sgst: i.sgst || 0, igst: i.igst || 0, total: i.total }))
      };
    });

    let totalPurchasesAmount = 0, totalTaxablePurchases = 0, totalPurchasesCgst = 0, totalPurchasesSgst = 0, totalPurchasesIgst = 0, totalPurchasesGst = 0;
    const formattedPurchases = purchases.map(p => {
      const taxable = p.subtotal || Math.max(0, (p.grandTotal || 0) - (p.totalGst || 0));
      totalPurchasesAmount += (p.grandTotal || 0); totalTaxablePurchases += taxable;
      totalPurchasesCgst += (p.totalCgst || 0); totalPurchasesSgst += (p.totalSgst || 0);
      totalPurchasesIgst += (p.totalIgst || 0); totalPurchasesGst += (p.totalGst || 0);
      const supGstin = p.supplierGstin || p.supplierId?.gstin || '';
      return {
        _id: p._id, billNumber: p.billNumber || p.invoiceNumber || 'PUR-' + String(p._id).slice(-5).toUpperCase(),
        purchaseDate: p.purchaseDate || p.createdAt,
        supplierName: p.supplierName || p.supplierId?.name || p.supplierId?.companyName || 'Cash Supplier',
        supplierMobile: p.supplierMobile || p.supplierId?.mobile || '',
        supplierGstin: supGstin, paymentStatus: p.paymentStatus || 'PAID',
        paymentMethod: p.paymentMethod || 'BANK_TRANSFER', itemCount: p.items?.length || 0,
        subtotal: parseFloat(taxable.toFixed(2)), totalCgst: parseFloat((p.totalCgst || 0).toFixed(2)),
        totalSgst: parseFloat((p.totalSgst || 0).toFixed(2)), totalIgst: parseFloat((p.totalIgst || 0).toFixed(2)),
        totalGst: parseFloat((p.totalGst || 0).toFixed(2)), grandTotal: parseFloat((p.grandTotal || 0).toFixed(2)),
        items: (p.items || []).map(i => ({ productName: i.productName, quantity: i.quantity, unit: i.unit, purchasePrice: i.purchasePrice || i.rate, hsnCode: i.hsnCode || '', gstPercent: i.gstPercent || 0, cgst: i.cgst || 0, sgst: i.sgst || 0, igst: i.igst || 0, total: i.total }))
      };
    });

    const outputGst = parseFloat(totalSalesGst.toFixed(2));
    const inputItc = parseFloat(totalPurchasesGst.toFixed(2));
    const netGstPayable = parseFloat(Math.max(0, outputGst - inputItc).toFixed(2));
    const itcCarryForward = parseFloat(Math.max(0, inputItc - outputGst).toFixed(2));

    res.json({
      success: true,
      data: {
        dateRange: { start, end }, sales: formattedSales, purchases: formattedPurchases,
        salesSummary: { count: sales.length, totalSalesAmount: parseFloat(totalSalesAmount.toFixed(2)), totalTaxableSales: parseFloat(totalTaxableSales.toFixed(2)), totalSalesCgst: parseFloat(totalSalesCgst.toFixed(2)), totalSalesSgst: parseFloat(totalSalesSgst.toFixed(2)), totalSalesIgst: parseFloat(totalSalesIgst.toFixed(2)), totalSalesGst: outputGst, totalSalesDiscount: parseFloat(totalSalesDiscount.toFixed(2)), b2bSalesCount, b2bSalesAmount: parseFloat(b2bSalesAmount.toFixed(2)), b2cSalesCount, b2cSalesAmount: parseFloat(b2cSalesAmount.toFixed(2)) },
        purchasesSummary: { count: purchases.length, totalPurchasesAmount: parseFloat(totalPurchasesAmount.toFixed(2)), totalTaxablePurchases: parseFloat(totalTaxablePurchases.toFixed(2)), totalPurchasesCgst: parseFloat(totalPurchasesCgst.toFixed(2)), totalPurchasesSgst: parseFloat(totalPurchasesSgst.toFixed(2)), totalPurchasesIgst: parseFloat(totalPurchasesIgst.toFixed(2)), totalPurchasesGst: inputItc },
        taxReconciliation: { outputCgst: parseFloat(totalSalesCgst.toFixed(2)), outputSgst: parseFloat(totalSalesSgst.toFixed(2)), outputIgst: parseFloat(totalSalesIgst.toFixed(2)), totalOutputGst: outputGst, inputCgst: parseFloat(totalPurchasesCgst.toFixed(2)), inputSgst: parseFloat(totalPurchasesSgst.toFixed(2)), inputIgst: parseFloat(totalPurchasesIgst.toFixed(2)), totalInputItc: inputItc, netGstPayable, itcCarryForward }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get real-time live alerts and notification feed
// @route GET /api/reports/live-alerts
const getLiveAlerts = async (req, res) => {
  try {
    const shopId = req.shopId;
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // 1. Low Stock & Out of Stock Products
    const lowStockItems = await Product.find({
      shopId,
      isActive: true,
      $expr: { $lte: ['$quantity', '$minStockLevel'] }
    }).select('name sku quantity minStockLevel unit sellingPrice category').limit(10).lean();

    // 2. Expiring Products (within 30 days)
    const expiringItems = await Product.find({
      shopId,
      isActive: true,
      expiryDate: { $gte: now, $lte: thirtyDaysFromNow }
    }).select('name batchNumber expiryDate quantity unit').limit(10).lean();

    // 3. Today's Latest Sales (last 8)
    const recentSales = await Sale.find({
      shopId,
      status: { $ne: 'CANCELLED' }
    }).sort({ createdAt: -1, invoiceDate: -1 })
      .limit(8)
      .select('invoiceNumber customerName grandTotal amountPaid balanceDue invoiceDate createdAt paymentMethod')
      .lean();

    // 4. Overdue Customers with pending balance
    const pendingCustomers = await Customer.find({
      shopId,
      isActive: true,
      pendingAmount: { $gt: 0 }
    }).sort({ pendingAmount: -1 }).limit(6).select('name mobile pendingAmount').lean();

    // 5. Pending Suppliers
    const pendingSuppliers = await Supplier.find({
      shopId,
      isActive: true,
      pendingAmount: { $gt: 0 }
    }).sort({ pendingAmount: -1 }).limit(5).select('name mobile companyName pendingAmount').lean();

    res.json({
      success: true,
      data: {
        timestamp: now,
        lowStockItems,
        expiringItems,
        recentSales,
        pendingCustomers,
        pendingSuppliers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboard, getSalesReport, getPurchaseReport, getProfitReport,
  getStockReport, getGSTReport, getExpenseReport,
  getCustomerOutstanding, getSupplierOutstanding,
  getCAMonthlyReport, downloadReport, getBackupData, getLiveAlerts
};
