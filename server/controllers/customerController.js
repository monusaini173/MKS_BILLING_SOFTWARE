const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Payment = require('../models/Payment');

const getCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { shopId: req.shopId, isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Customer.countDocuments(query);
    const customers = await Customer.find(query).sort({ name: 1 }).skip(skip).limit(parseInt(limit));
    res.json({ success: true, data: customers, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const rawMobile = (req.body.mobile || '').toString().replace(/\D/g, '');
    const cleanMobile = rawMobile ? (rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile) : '';

    if (cleanMobile && cleanMobile.length >= 6) {
      const existing = await Customer.findOne({
        shopId: req.shopId,
        isActive: true,
        mobile: { $regex: new RegExp(cleanMobile + '$', 'i') }
      });
      if (existing) {
        if (req.body.name && req.body.name.trim()) existing.name = req.body.name.trim();
        if (req.body.email !== undefined) existing.email = req.body.email?.trim() || undefined;
        if (req.body.address !== undefined) existing.address = req.body.address?.trim() || undefined;
        if (req.body.gstin !== undefined) existing.gstin = req.body.gstin?.trim()?.toUpperCase() || undefined;
        existing.mobile = cleanMobile;
        await existing.save();
        return res.status(200).json({ success: true, message: 'इस मोबाइल नंबर का ग्राहक पहले से मौजूद है (डेटा अपडेट किया गया)।', data: existing });
      }
    }

    const newCustomerData = {
      ...req.body,
      name: (req.body.name || '').trim(),
      mobile: cleanMobile || (req.body.mobile || '').toString().trim(),
      email: req.body.email?.trim() || undefined,
      gstin: req.body.gstin?.trim()?.toUpperCase() || undefined,
      address: req.body.address?.trim() || undefined,
      shopId: req.shopId
    };

    const customer = await Customer.create(newCustomerData);
    res.status(201).json({ success: true, message: 'ग्राहक सफलतापूर्वक जोड़ा गया (Customer saved successfully).', data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'ग्राहक सेव करने में सर्वर त्रुटि हुई।' });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId },
      req.body,
      { new: true }
    );
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    res.json({ success: true, message: 'Customer updated.', data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    await Customer.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, { isActive: false });
    res.json({ success: true, message: 'Customer deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCustomerHistory = async (req, res) => {
  try {
    const sales = await Sale.find({ customerId: req.params.id, shopId: req.shopId })
      .sort({ invoiceDate: -1 }).limit(50);
    const payments = await Payment.find({ customerId: req.params.id, shopId: req.shopId })
      .sort({ date: -1 }).limit(50);
    res.json({ success: true, data: { sales, payments } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const receivePayment = async (req, res) => {
  try {
    const { amount, method, notes, transactionId } = req.body;
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
    }

    const customer = await Customer.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    customer.totalPaid = (customer.totalPaid || 0) + numAmount;
    customer.pendingAmount = Math.max(0, (customer.pendingAmount || 0) - numAmount);
    await customer.save();

    // 🔄 Settle customer's pending / partial Sale bills in FIFO order (oldest first)
    let remainingPayment = numAmount;
    const pendingSales = await Sale.find({
      shopId: req.shopId,
      customerId: customer._id,
      balanceDue: { $gt: 0 }
    }).sort({ invoiceDate: 1 });

    const settledInvoices = [];
    let primarySaleId = null;

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

    const paymentRecord = await Payment.create({
      shopId: req.shopId,
      type: 'RECEIVED',
      partyType: 'CUSTOMER',
      customerId: customer._id,
      partyName: customer.name,
      payerName: customer.name,
      customerMobile: customer.mobile,
      amount: numAmount,
      method: method || 'CASH',
      status: 'SUCCESS',
      referenceNumber: settledInvoices.length > 0 ? settledInvoices.join(', ') : 'UDHAAR_SETTLE',
      referenceType: 'Sale',
      referenceId: primarySaleId,
      transactionId: transactionId || 'TXN_' + Date.now().toString().slice(-6),
      notes: notes || (settledInvoices.length > 0 ? `Udhaar cleared for bill(s): ${settledInvoices.join(', ')}` : 'Udhaar Deposit'),
      createdBy: req.user._id,
      date: new Date(),
    });

    res.json({
      success: true,
      message: `₹${numAmount.toLocaleString('en-IN')} Udhaar payment received and applied to bills!`,
      data: {
        customer,
        settledInvoices,
        payment: paymentRecord
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const lookupCustomer = async (req, res) => {
  try {
    const { mobile, name } = req.query;
    if (!mobile && !name) {
      return res.json({ success: true, found: false });
    }

    const cleanMobile = mobile ? String(mobile).replace(/\D/g, '') : '';
    const cleanName = name ? String(name).trim() : '';

    let customer = null;

    // 1. Try finding by mobile (last 10 digits)
    if (cleanMobile && cleanMobile.length >= 6) {
      const mobRegex = new RegExp(cleanMobile.slice(-10) + '$', 'i');
      customer = await Customer.findOne({ shopId: req.shopId, mobile: { $regex: mobRegex }, isActive: true });
    }

    // 2. Try finding by name if not found by mobile
    if (!customer && cleanName && cleanName.length >= 2 && cleanName.toLowerCase() !== 'walk-in customer') {
      customer = await Customer.findOne({
        shopId: req.shopId,
        name: { $regex: new RegExp('^' + cleanName + '$', 'i') },
        isActive: true
      });
    }

    // 3. Find all unpaid / pending sales for this customer (by customerId or mobile or name)
    const saleQuery = {
      shopId: req.shopId,
      balanceDue: { $gt: 0 },
      status: { $in: ['PENDING', 'PARTIAL'] }
    };

    if (customer) {
      saleQuery.$or = [
        { customerId: customer._id },
        ...(cleanMobile ? [{ customerMobile: { $regex: new RegExp(cleanMobile.slice(-10) + '$', 'i') } }] : []),
        ...(cleanName ? [{ customerName: { $regex: new RegExp('^' + cleanName + '$', 'i') } }] : [])
      ];
    } else {
      if (cleanMobile && cleanName) {
        saleQuery.$or = [
          { customerMobile: { $regex: new RegExp(cleanMobile.slice(-10) + '$', 'i') } },
          { customerName: { $regex: new RegExp('^' + cleanName + '$', 'i') } }
        ];
      } else if (cleanMobile) {
        saleQuery.customerMobile = { $regex: new RegExp(cleanMobile.slice(-10) + '$', 'i') };
      } else if (cleanName) {
        saleQuery.customerName = { $regex: new RegExp('^' + cleanName + '$', 'i') };
      }
    }

    const unpaidSales = await Sale.find(saleQuery).sort({ invoiceDate: -1 });
    const totalPendingFromSales = unpaidSales.reduce((acc, s) => acc + (Number(s.balanceDue) || 0), 0);

    const pendingAmount = Math.max(Number(customer?.pendingAmount || 0), totalPendingFromSales);

    if (customer || unpaidSales.length > 0) {
      const customerData = {
        _id: customer?._id || null,
        name: customer?.name || unpaidSales[0]?.customerName || cleanName,
        mobile: customer?.mobile || unpaidSales[0]?.customerMobile || cleanMobile,
        gstin: customer?.gstin || unpaidSales[0]?.customerGstin || '',
        pendingAmount: pendingAmount,
        creditLimit: customer?.creditLimit || 10000,
        totalPurchases: customer?.totalPurchases || unpaidSales.reduce((acc, s) => acc + (s.grandTotal || 0), 0),
        unpaidSalesCount: unpaidSales.length,
        unpaidSales: unpaidSales.map(s => ({
          _id: s._id,
          invoiceNumber: s.invoiceNumber,
          invoiceDate: s.invoiceDate,
          grandTotal: s.grandTotal,
          amountPaid: s.amountPaid,
          balanceDue: s.balanceDue,
          status: s.status
        }))
      };

      return res.json({ success: true, found: true, data: customerData });
    }

    return res.json({ success: true, found: false });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerHistory, receivePayment, lookupCustomer };
