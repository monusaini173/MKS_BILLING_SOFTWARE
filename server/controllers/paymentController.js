const Payment = require('../models/Payment');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');

// @desc  Get payment history / transactions with rich filters and summaries
// @route GET /api/payments
const getPayments = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      method,
      status,
      type = 'RECEIVED',
      page = 1,
      limit = 50,
      filter = 'today'
    } = req.query;

    const query = { shopId: req.shopId };

    if (type && type !== 'ALL') {
      query.type = type;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (method && method !== 'ALL') {
      query.method = method;
    }

    // Date Filtering
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    } else if (filter) {
      const now = new Date();
      if (filter === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
      } else if (filter === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
      } else if (filter === 'week') {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        query.date = { $gte: start };
      } else if (filter === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        query.date = { $gte: start };
      } else if (filter === 'year') {
        const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        query.date = { $gte: start };
      }
    }

    // Search query across Customer Name, Payer Name, Mobile, Invoice/Ref No, Transaction ID, and Product Names
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { partyName: regex },
        { payerName: regex },
        { customerMobile: regex },
        { referenceNumber: regex },
        { transactionId: regex },
        { 'items.productName': regex },
        { notes: regex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Payment.countDocuments(query);

    const payments = await Payment.find(query)
      .populate('createdBy', 'name')
      .populate('customerId', 'name mobile address')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Summary statistics for current filter
    const statsResult = await Payment.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          upiAmount: {
            $sum: {
              $cond: [{ $eq: ['$method', 'UPI'] }, '$amount', 0]
            }
          },
          cashAmount: {
            $sum: {
              $cond: [{ $eq: ['$method', 'CASH'] }, '$amount', 0]
            }
          },
          cardAmount: {
            $sum: {
              $cond: [{ $eq: ['$method', 'CARD'] }, '$amount', 0]
            }
          },
          otherAmount: {
            $sum: {
              $cond: [{ $in: ['$method', ['BANK_TRANSFER', 'CREDIT', 'PARTIAL']] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    // Today's total received for quick card
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayStats = await Payment.aggregate([
      {
        $match: {
          shopId: req.shopId,
          type: 'RECEIVED',
          status: 'SUCCESS',
          date: { $gte: todayStart, $lte: todayEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' },
          upiTotal: {
            $sum: {
              $cond: [{ $eq: ['$method', 'UPI'] }, '$amount', 0]
            }
          },
          cashTotal: {
            $sum: {
              $cond: [{ $eq: ['$method', 'CASH'] }, '$amount', 0]
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = statsResult[0] || {
      totalAmount: 0,
      count: 0,
      upiAmount: 0,
      cashAmount: 0,
      cardAmount: 0,
      otherAmount: 0
    };

    const todaySummary = todayStats[0] || {
      total: 0,
      upiTotal: 0,
      cashTotal: 0,
      count: 0
    };

    res.json({
      success: true,
      data: payments,
      summary,
      todaySummary,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single payment details with full items and bill reference
// @route GET /api/payments/:id
const getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, shopId: req.shopId })
      .populate('createdBy', 'name mobile')
      .populate('customerId', 'name mobile address email gstin');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    let saleDetails = null;
    if (payment.referenceId && payment.referenceType === 'Sale') {
      saleDetails = await Sale.findById(payment.referenceId);
    }

    res.json({
      success: true,
      data: payment,
      saleDetails
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Record direct manual payment entry
// @route POST /api/payments
const recordPayment = async (req, res) => {
  try {
    const {
      type = 'RECEIVED',
      partyType = 'CUSTOMER',
      customerId,
      supplierId,
      partyName,
      payerName,
      customerMobile,
      amount,
      method = 'CASH',
      referenceNumber,
      transactionId,
      items,
      notes
    } = req.body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    let settledInvoices = [];
    let primarySaleId = null;

    // Settle customer pending sales & ledger if customerId is provided
    if (customerId && partyType === 'CUSTOMER') {
      const customer = await Customer.findOne({ _id: customerId, shopId: req.shopId });
      if (customer) {
        customer.totalPaid = (customer.totalPaid || 0) + numAmount;
        customer.pendingAmount = Math.max(0, (customer.pendingAmount || 0) - numAmount);
        await customer.save();

        // Settle pending sales in FIFO order
        let remainingPayment = numAmount;
        const pendingSales = await Sale.find({
          shopId: req.shopId,
          customerId: customer._id,
          balanceDue: { $gt: 0 }
        }).sort({ invoiceDate: 1 });

        for (const sale of pendingSales) {
          if (remainingPayment <= 0) break;
          if (!primarySaleId) primarySaleId = sale._id;

          const settleAmount = Math.min(sale.balanceDue, remainingPayment);
          sale.amountPaid = (sale.amountPaid || 0) + settleAmount;
          sale.balanceDue = Math.max(0, (sale.balanceDue || 0) - settleAmount);

          if (sale.balanceDue === 0) {
            sale.status = 'PAID';
            if (sale.paymentMethod === 'CREDIT') {
              sale.paymentMethod = method || 'CASH';
            }
          } else {
            sale.status = 'PARTIAL';
          }

          if (!sale.paymentDetails) sale.paymentDetails = [];
          sale.paymentDetails.push({
            method: method || 'CASH',
            amount: settleAmount,
            date: new Date(),
            reference: transactionId || 'UDHAAR_' + Date.now().toString().slice(-6),
            note: notes || 'Udhaar settlement payment'
          });

          await sale.save();
          remainingPayment -= settleAmount;
          settledInvoices.push(sale.invoiceNumber);
        }
      }
    }

    const refNum = referenceNumber || (settledInvoices.length > 0 ? settledInvoices.join(', ') : 'PAYMENT');
    const payment = await Payment.create({
      shopId: req.shopId,
      type,
      partyType,
      customerId: customerId || null,
      supplierId: supplierId || null,
      partyName: partyName || (customerId ? 'Customer' : 'Walk-in Customer'),
      payerName: payerName || partyName || 'Customer',
      customerMobile,
      amount: numAmount,
      method,
      status: 'SUCCESS',
      referenceNumber: refNum,
      referenceType: primarySaleId ? 'Sale' : undefined,
      referenceId: primarySaleId || undefined,
      transactionId: transactionId || 'TXN_' + Date.now().toString().slice(-6),
      items: items || [],
      notes: notes || (settledInvoices.length > 0 ? `Udhaar cleared for: ${settledInvoices.join(', ')}` : ''),
      createdBy: req.user._id,
      date: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully and applied to bills.',
      data: payment,
      settledInvoices
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPayments,
  getPaymentById,
  recordPayment
};
