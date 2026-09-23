const Supplier = require('../models/Supplier');
const Purchase = require('../models/Purchase');
const Payment = require('../models/Payment');

const getSuppliers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = { shopId: req.shopId, isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Supplier.countDocuments(query);
    const suppliers = await Supplier.find(query).sort({ name: 1 }).skip(skip).limit(parseInt(limit));
    res.json({ success: true, data: suppliers, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createSupplier = async (req, res) => {
  try {
    const openingBal = Number(req.body.openingBalance) || 0;
    const supplier = await Supplier.create({ 
      ...req.body, 
      shopId: req.shopId,
      pendingAmount: openingBal > 0 ? openingBal : (Number(req.body.pendingAmount) || 0)
    });
    res.status(201).json({ success: true, message: 'Supplier created successfully.', data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });
    res.json({ success: true, message: 'Supplier updated successfully.', data: supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    await Supplier.findOneAndUpdate({ _id: req.params.id, shopId: req.shopId }, { isActive: false });
    res.json({ success: true, message: 'Supplier deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getSupplierHistory = async (req, res) => {
  try {
    const supplierId = req.params.id;
    const supplier = await Supplier.findOne({ _id: supplierId, shopId: req.shopId });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    // 1. All Purchases History
    const purchases = await Purchase.find({ supplierId, shopId: req.shopId })
      .sort({ purchaseDate: -1, createdAt: -1 })
      .limit(100);

    // 2. All Payments Made
    const payments = await Payment.find({ supplierId, shopId: req.shopId })
      .sort({ date: -1, createdAt: -1 })
      .limit(100);

    // 3. Filter Pending Unpaid Bills
    const pendingBills = purchases.filter(p => (p.balanceDue || 0) > 0);

    // 4. Last purchase date
    const lastPurchase = purchases.length > 0 ? purchases[0].purchaseDate || purchases[0].createdAt : null;

    res.json({ 
      success: true, 
      data: { 
        supplier,
        purchases, 
        payments,
        pendingBills,
        lastPurchaseDate: lastPurchase,
        totalPurchasesCount: purchases.length,
        totalPaymentsCount: payments.length,
        totalPendingBillsCount: pendingBills.length
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const paySupplier = async (req, res) => {
  try {
    const { amount, method = 'CASH', notes, transactionId, purchaseId } = req.body;
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid payment amount.' });
    }

    const supplier = await Supplier.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    supplier.totalPaid = (supplier.totalPaid || 0) + payAmount;
    supplier.pendingAmount = Math.max(0, (supplier.pendingAmount || 0) - payAmount);
    await supplier.save();

    // If specific purchase invoice payment
    if (purchaseId) {
      const pur = await Purchase.findOne({ _id: purchaseId, shopId: req.shopId });
      if (pur) {
        pur.amountPaid = (pur.amountPaid || 0) + payAmount;
        pur.balanceDue = Math.max(0, (pur.balanceDue || 0) - payAmount);
        pur.status = pur.balanceDue === 0 ? 'PAID' : 'PARTIAL';
        await pur.save();
      }
    }

    const paymentRecord = await Payment.create({
      shopId: req.shopId,
      type: 'PAID',
      partyType: 'SUPPLIER',
      supplierId: supplier._id,
      partyName: supplier.name,
      amount: payAmount,
      method: method.toUpperCase(),
      transactionId: transactionId || '',
      referenceId: purchaseId || null,
      referenceType: 'Purchase',
      notes: notes || `Settlement Payment to ${supplier.companyName || supplier.name}`,
      createdBy: req.user._id,
    });

    res.json({ 
      success: true, 
      message: `₹${payAmount.toFixed(2)} payment recorded for "${supplier.name}".`, 
      data: { supplier, payment: paymentRecord } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const addSupplierDue = async (req, res) => {
  try {
    const { amount, reason = 'Manual Due Entry', invoiceNumber, date } = req.body;
    const dueAmount = Number(amount);
    if (!dueAmount || dueAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid due amount.' });
    }

    const supplier = await Supplier.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found.' });

    supplier.pendingAmount = (supplier.pendingAmount || 0) + dueAmount;
    supplier.totalPurchases = (supplier.totalPurchases || 0) + dueAmount;
    await supplier.save();

    const purchaseCount = await Purchase.countDocuments({ shopId: req.shopId });
    const purchaseNumber = `PUR-DUE-${1000 + purchaseCount + 1}`;

    const purchase = await Purchase.create({
      shopId: req.shopId,
      supplierId: supplier._id,
      supplierName: supplier.name,
      purchaseNumber,
      supplierInvoice: invoiceNumber || 'MANUAL-DUE',
      purchaseDate: date ? new Date(date) : new Date(),
      subtotal: dueAmount,
      grandTotal: dueAmount,
      amountPaid: 0,
      balanceDue: dueAmount,
      paymentMethod: 'CREDIT',
      status: 'PENDING',
      notes: reason,
      items: [{
        productName: reason || 'Manual Due / Opening Balance Entry',
        quantity: 1,
        purchasePrice: dueAmount,
        subtotal: dueAmount,
        total: dueAmount
      }]
    });

    res.json({
      success: true,
      message: `₹${dueAmount.toFixed(2)} due successfully added to "${supplier.name}".`,
      data: { supplier, purchase }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier, getSupplierHistory, paySupplier, addSupplierDue };
