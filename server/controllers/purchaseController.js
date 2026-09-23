const mongoose = require('mongoose');
const Purchase = require('../models/Purchase');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Payment = require('../models/Payment');
const StockTransaction = require('../models/StockTransaction');
const Return = require('../models/Return');
const { generatePurchaseNumber, generateReturnNumber } = require('../utils/helpers');

// @desc  Create purchase
// @route POST /api/purchases
const createPurchase = async (req, res) => {
  try {
    const { supplierId, supplierName, supplierInvoice, items = [], subtotal, subTotal, totalGst = 0,
      totalCgst = 0, totalSgst = 0, totalIgst = 0, grandTotal, amountPaid = 0, paymentMethod = 'CASH', notes } = req.body;

    const computedSubtotal = Number(subtotal ?? subTotal ?? (grandTotal - totalGst)) || 0;
    const finalGrandTotal = Number(grandTotal ?? (computedSubtotal + totalGst)) || 0;
    const finalAmountPaid = Number(amountPaid) || 0;
    const balanceDue = Math.max(0, finalGrandTotal - finalAmountPaid);
    const status = balanceDue <= 0 ? 'PAID' : finalAmountPaid > 0 ? 'PARTIAL' : 'PENDING';

    const mappedItems = (items || []).map(item => {
      const itemQty = Number(item.quantity) || 1;
      const itemFreeQty = Number(item.freeQuantity) || 0;
      const itemPrice = Number(item.purchasePrice ?? item.price ?? item.rate) || 0;
      const itemSubtotal = Number(item.subtotal ?? item.subTotal ?? (itemPrice * itemQty)) || 0;
      const itemTotal = Number(item.total ?? (itemSubtotal + (Number(item.totalGst) || 0))) || itemSubtotal;
      return {
        ...item,
        quantity: itemQty,
        freeQuantity: itemFreeQty,
        batchNumber: item.batchNumber ? String(item.batchNumber).trim() : '',
        expiryDate: item.expiryDate || null,
        rackLocation: item.rackLocation ? String(item.rackLocation).trim() : '',
        purchasePrice: itemPrice,
        subtotal: itemSubtotal,
        total: itemTotal
      };
    });

    const purchaseNumber = generatePurchaseNumber(req.shopId);

    const purchase = await Purchase.create({
      shopId: req.shopId,
      purchaseNumber,
      supplierId,
      supplierName,
      supplierInvoice,
      items: mappedItems,
      subtotal: computedSubtotal,
      totalGst,
      totalCgst,
      totalSgst,
      totalIgst,
      grandTotal: finalGrandTotal,
      amountPaid: finalAmountPaid,
      balanceDue,
      paymentMethod,
      status,
      notes,
      createdBy: req.user._id,
    });

    // Increase stock and sync batches for each item
    for (const item of mappedItems) {
      let product = null;
      if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
        product = await Product.findById(item.productId);
      }
      if (!product && item.productId) {
        product = await Product.findOne({
          shopId: req.shopId,
          $or: [{ barcode: item.productId }, { sku: item.productId }, { name: item.productName }]
        });
      }
      if (!product && item.productName) {
        product = await Product.findOne({ shopId: req.shopId, name: item.productName });
      }

      if (product) {
        const totalQtyAdded = (Number(item.quantity) || 0) + (Number(item.freeQuantity) || 0);
        product.quantity += totalQtyAdded;
        if (item.sellingPrice) product.sellingPrice = Number(item.sellingPrice);
        if (item.mrp) product.mrp = Number(item.mrp);
        if (item.purchasePrice) product.purchasePrice = Number(item.purchasePrice);
        if (item.rackLocation) product.rackLocation = item.rackLocation;

        // Multi-Batch Processing
        if (item.batchNumber) {
          product.batchNumber = item.batchNumber;
          if (item.expiryDate) product.expiryDate = item.expiryDate;
          
          if (!product.batches) product.batches = [];
          const existingBatchIndex = product.batches.findIndex(b => b.batchNumber && b.batchNumber.toLowerCase() === item.batchNumber.toLowerCase());
          
          if (existingBatchIndex >= 0) {
            product.batches[existingBatchIndex].quantity += totalQtyAdded;
            if (item.expiryDate) product.batches[existingBatchIndex].expiryDate = item.expiryDate;
            if (item.mrp) product.batches[existingBatchIndex].mrp = Number(item.mrp);
            if (item.sellingPrice) product.batches[existingBatchIndex].sellingPrice = Number(item.sellingPrice);
            if (item.purchasePrice) product.batches[existingBatchIndex].purchasePrice = Number(item.purchasePrice);
            if (item.rackLocation) product.batches[existingBatchIndex].rackLocation = item.rackLocation;
          } else {
            product.batches.push({
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              quantity: totalQtyAdded,
              mrp: Number(item.mrp) || product.mrp || 0,
              purchasePrice: Number(item.purchasePrice) || product.purchasePrice || 0,
              sellingPrice: Number(item.sellingPrice) || product.sellingPrice || 0,
              rackLocation: item.rackLocation || product.rackLocation || '',
              isSaleable: true,
              damagedQty: 0
            });
          }
        }

        await product.save();

        await StockTransaction.create({
          shopId: req.shopId,
          productId: product._id,
          productName: product.name,
          type: 'PURCHASE',
          quantity: totalQtyAdded,
          balanceAfter: product.quantity,
          referenceId: purchase._id,
          referenceType: 'Purchase',
          referenceNumber: purchaseNumber,
          notes: `Purchase Inward${item.freeQuantity ? ` (Includes ${item.freeQuantity} Free)` : ''}${item.batchNumber ? ` [Batch: ${item.batchNumber}]` : ''}`,
          createdBy: req.user._id,
        });
      }
    }

    // Update supplier balance
    if (supplierId) {
      await Supplier.findByIdAndUpdate(supplierId, {
        $inc: { totalPurchases: grandTotal, totalPaid: amountPaid, pendingAmount: balanceDue },
      });
    }

    // Record payment
    if (amountPaid > 0) {
      await Payment.create({
        shopId: req.shopId,
        type: 'PAID',
        partyType: 'SUPPLIER',
        supplierId,
        partyName: supplierName,
        amount: amountPaid,
        method: paymentMethod,
        referenceId: purchase._id,
        referenceType: 'Purchase',
        referenceNumber: purchaseNumber,
        createdBy: req.user._id,
      });
    }

    res.status(201).json({ success: true, message: 'Purchase created.', data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get all purchases
// @route GET /api/purchases
const getPurchases = async (req, res) => {
  try {
    const { search, startDate, endDate, status, page = 1, limit = 20 } = req.query;
    const query = { shopId: req.shopId };

    if (search) {
      query.$or = [
        { purchaseNumber: { $regex: search, $options: 'i' } },
        { supplierName: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;
    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate);
      if (endDate) query.purchaseDate.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Purchase.countDocuments(query);
    const purchases = await Purchase.find(query).sort({ purchaseDate: -1 }).skip(skip).limit(parseInt(limit));

    res.json({
      success: true,
      data: purchases,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single purchase
// @route GET /api/purchases/:id
const getPurchase = async (req, res) => {
  try {
    const purchase = await Purchase.findOne({ _id: req.params.id, shopId: req.shopId })
      .populate('supplierId', 'name mobile email');
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });
    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Purchase return
// @route POST /api/purchases/:id/return
const purchaseReturn = async (req, res) => {
  try {
    const { items, reason, notes } = req.body;
    const purchase = await Purchase.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });

    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const returnNumber = generateReturnNumber('PURCHASE_RETURN');

    const returnDoc = await Return.create({
      shopId: req.shopId,
      returnType: 'PURCHASE_RETURN',
      returnNumber,
      originalId: purchase._id,
      originalNumber: purchase.purchaseNumber,
      supplierId: purchase.supplierId,
      partyName: purchase.supplierName,
      items,
      totalAmount,
      reason,
      notes,
      createdBy: req.user._id,
    });

    // Reduce stock
    for (const item of items) {
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity = Math.max(0, product.quantity - item.quantity);
          await product.save();

          await StockTransaction.create({
            shopId: req.shopId,
            productId: product._id,
            productName: product.name,
            type: 'PURCHASE_RETURN',
            quantity: -item.quantity,
            balanceAfter: product.quantity,
            referenceId: returnDoc._id,
            referenceType: 'Return',
            referenceNumber: returnNumber,
            createdBy: req.user._id,
          });
        }
      }
    }

    // Update supplier balance
    if (purchase.supplierId) {
      await Supplier.findByIdAndUpdate(purchase.supplierId, {
        $inc: { totalPurchases: -totalAmount, pendingAmount: -totalAmount },
      });
    }

    res.status(201).json({ success: true, message: 'Purchase return processed.', data: returnDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Pay supplier
// @route POST /api/purchases/:id/pay
const paySupplier = async (req, res) => {
  try {
    const { amount, method, transactionId, notes } = req.body;
    const purchase = await Purchase.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!purchase) return res.status(404).json({ success: false, message: 'Purchase not found.' });

    if (amount > purchase.balanceDue) {
      return res.status(400).json({ success: false, message: `Amount exceeds balance due (₹${purchase.balanceDue})` });
    }

    purchase.amountPaid += amount;
    purchase.balanceDue -= amount;
    purchase.status = purchase.balanceDue <= 0 ? 'PAID' : 'PARTIAL';
    await purchase.save();

    await Payment.create({
      shopId: req.shopId,
      type: 'PAID',
      partyType: 'SUPPLIER',
      supplierId: purchase.supplierId,
      partyName: purchase.supplierName,
      amount,
      method,
      referenceId: purchase._id,
      referenceType: 'Purchase',
      referenceNumber: purchase.purchaseNumber,
      transactionId,
      notes,
      createdBy: req.user._id,
    });

    if (purchase.supplierId) {
      await Supplier.findByIdAndUpdate(purchase.supplierId, {
        $inc: { totalPaid: amount, pendingAmount: -amount },
      });
    }

    res.json({ success: true, message: 'Payment done.', data: purchase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createPurchase, getPurchases, getPurchase, purchaseReturn, paySupplier };
