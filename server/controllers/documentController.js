const mongoose = require('mongoose');
const Document = require('../models/Document');
const Purchase = require('../models/Purchase');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const { generateInvoiceNumber, generatePurchaseNumber } = require('../utils/helpers');

const getDocPrefix = (docType) => {
  switch (docType) {
    case 'PURCHASE_ORDER': return 'PO';
    case 'QUOTATION': return 'QUO';
    case 'SALES_RETURN': return 'CN';
    case 'PURCHASE_RETURN': return 'DN';
    case 'DELIVERY_CHALLAN': return 'DC';
    case 'SALE_INVOICE': return 'INV';
    case 'PURCHASE_INVOICE': return 'PUR';
    default: return 'DOC';
  }
};

// @desc Create Billing Document
// @route POST /api/documents
const createDocument = async (req, res) => {
  try {
    const {
      documentType,
      documentDate,
      validUntil,
      partyType,
      partyId,
      partyName,
      partyMobile,
      partyGstin,
      partyAddress,
      items = [],
      subtotal,
      totalDiscount = 0,
      totalGst = 0,
      totalCgst = 0,
      totalSgst = 0,
      totalIgst = 0,
      grandTotal,
      amountPaid = 0,
      paymentMethod = 'CASH',
      status = 'ISSUED',
      notes,
      termsConditions
    } = req.body;

    if (!documentType || !partyName || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Document type, party name, and items are required.' });
    }

    const prefix = getDocPrefix(documentType);
    const timestamp = Date.now().toString().slice(-6);
    const documentNumber = `${prefix}-${timestamp}`;

    const computedSubtotal = Number(subtotal) || items.reduce((sum, item) => sum + (Number(item.subtotal) || (Number(item.rate) * Number(item.quantity))), 0);
    const computedGst = Number(totalGst) || items.reduce((sum, item) => sum + (Number(item.totalGst) || 0), 0);
    const computedGrandTotal = Number(grandTotal) || Math.round(computedSubtotal + computedGst - Number(totalDiscount));
    const finalAmountPaid = Number(amountPaid) || 0;
    const balanceDue = Math.max(0, computedGrandTotal - finalAmountPaid);

    const document = await Document.create({
      shopId: req.shopId,
      documentType,
      documentNumber,
      documentDate: documentDate ? new Date(documentDate) : new Date(),
      validUntil: validUntil ? new Date(validUntil) : null,
      partyType: partyType || (['PURCHASE_ORDER', 'PURCHASE_RETURN'].includes(documentType) ? 'SUPPLIER' : 'CUSTOMER'),
      partyId: partyId && mongoose.Types.ObjectId.isValid(partyId) ? partyId : null,
      partyName,
      partyMobile,
      partyGstin,
      partyAddress,
      items,
      subtotal: computedSubtotal,
      totalDiscount,
      totalGst: computedGst,
      totalCgst,
      totalSgst,
      totalIgst,
      grandTotal: computedGrandTotal,
      amountPaid: finalAmountPaid,
      balanceDue,
      paymentMethod,
      status,
      notes,
      termsConditions,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: `${documentType.replace('_', ' ')} created successfully.`,
      data: document
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get All Documents (with optional filtering)
// @route GET /api/documents
const getDocuments = async (req, res) => {
  try {
    const { documentType, search, startDate, endDate, status, page = 1, limit = 50 } = req.query;
    const query = { shopId: req.shopId };

    if (documentType) {
      query.documentType = documentType;
    }

    if (search) {
      query.$or = [
        { documentNumber: { $regex: search, $options: 'i' } },
        { partyName: { $regex: search, $options: 'i' } },
        { partyMobile: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) query.status = status;

    if (startDate || endDate) {
      query.documentDate = {};
      if (startDate) query.documentDate.$gte = new Date(startDate);
      if (endDate) query.documentDate.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Document.countDocuments(query);
    const documents = await Document.find(query)
      .sort({ documentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: documents,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Single Document
// @route GET /api/documents/:id
const getDocument = async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });
    res.json({ success: true, data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update Document Status
// @route PATCH /api/documents/:id/status
const updateDocumentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const document = await Document.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });

    document.status = status;
    await document.save();

    res.json({ success: true, message: 'Status updated.', data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Convert PO to Purchase Invoice OR Quotation to Sale Invoice
// @route POST /api/documents/:id/convert
const convertDocument = async (req, res) => {
  try {
    const doc = await Document.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found.' });

    if (doc.status === 'CONVERTED') {
      return res.status(400).json({ success: false, message: 'Document has already been converted.' });
    }

    if (doc.documentType === 'PURCHASE_ORDER') {
      // Convert PO -> Purchase Invoice
      const purchaseNumber = generatePurchaseNumber(req.shopId);
      const purchase = await Purchase.create({
        shopId: req.shopId,
        purchaseNumber,
        supplierId: doc.partyId,
        supplierName: doc.partyName,
        supplierInvoice: doc.documentNumber,
        items: doc.items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          purchasePrice: i.rate,
          subtotal: i.subtotal,
          totalGst: i.totalGst,
          total: i.total
        })),
        subtotal: doc.subtotal,
        totalGst: doc.totalGst,
        grandTotal: doc.grandTotal,
        amountPaid: doc.amountPaid || 0,
        balanceDue: doc.grandTotal - (doc.amountPaid || 0),
        status: doc.amountPaid >= doc.grandTotal ? 'PAID' : doc.amountPaid > 0 ? 'PARTIAL' : 'PENDING',
        notes: `Converted from PO: ${doc.documentNumber}`,
        createdBy: req.user._id,
      });

      // Update inventory stock for each product
      for (const item of doc.items) {
        if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
          const product = await Product.findById(item.productId);
          if (product) {
            product.quantity += Number(item.quantity) || 0;
            await product.save();

            await StockTransaction.create({
              shopId: req.shopId,
              productId: product._id,
              productName: product.name,
              type: 'PURCHASE',
              quantity: item.quantity,
              balanceAfter: product.quantity,
              referenceId: purchase._id,
              referenceType: 'Purchase',
              referenceNumber: purchaseNumber,
              notes: `Converted from PO: ${doc.documentNumber}`,
              createdBy: req.user._id,
            });
          }
        }
      }

      if (doc.partyId) {
        await Supplier.findByIdAndUpdate(doc.partyId, {
          $inc: { totalPurchases: doc.grandTotal, pendingAmount: doc.grandTotal - (doc.amountPaid || 0) }
        });
      }

      doc.status = 'CONVERTED';
      doc.convertedToInvoiceId = purchase._id;
      doc.convertedType = 'PURCHASE_INVOICE';
      doc.convertedAt = new Date();
      await doc.save();

      return res.json({
        success: true,
        message: `PO ${doc.documentNumber} successfully converted to Purchase Invoice ${purchaseNumber}!`,
        data: { document: doc, purchase }
      });
    } else if (doc.documentType === 'QUOTATION') {
      // Convert Quotation -> Sale Invoice
      const invoiceNumber = await generateInvoiceNumber(req.shopId);
      const sale = await Sale.create({
        shopId: req.shopId,
        invoiceNumber,
        customerId: doc.partyId,
        customerName: doc.partyName,
        customerMobile: doc.partyMobile,
        customerGstin: doc.partyGstin,
        items: doc.items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unit: i.unit,
          rate: i.rate,
          discount: i.discount,
          gstPercent: i.gstPercent,
          subtotal: i.subtotal,
          totalGst: i.totalGst,
          total: i.total
        })),
        subtotal: doc.subtotal,
        totalDiscount: doc.totalDiscount,
        totalGst: doc.totalGst,
        grandTotal: doc.grandTotal,
        amountPaid: doc.amountPaid || 0,
        balanceDue: doc.grandTotal - (doc.amountPaid || 0),
        status: doc.amountPaid >= doc.grandTotal ? 'PAID' : doc.amountPaid > 0 ? 'PARTIAL' : 'PENDING',
        notes: `Converted from Quotation: ${doc.documentNumber}`,
        createdBy: req.user._id,
      });

      // Deduct inventory stock for each product
      for (const item of doc.items) {
        if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
          const product = await Product.findById(item.productId);
          if (product) {
            product.quantity = Math.max(0, product.quantity - (Number(item.quantity) || 0));
            await product.save();

            await StockTransaction.create({
              shopId: req.shopId,
              productId: product._id,
              productName: product.name,
              type: 'SALE',
              quantity: -item.quantity,
              balanceAfter: product.quantity,
              referenceId: sale._id,
              referenceType: 'Sale',
              referenceNumber: invoiceNumber,
              notes: `Converted from Quotation: ${doc.documentNumber}`,
              createdBy: req.user._id,
            });
          }
        }
      }

      if (doc.partyId) {
        await Customer.findByIdAndUpdate(doc.partyId, {
          $inc: { totalPurchases: doc.grandTotal, pendingAmount: doc.grandTotal - (doc.amountPaid || 0) }
        });
      }

      doc.status = 'CONVERTED';
      doc.convertedToInvoiceId = sale._id;
      doc.convertedType = 'SALE_INVOICE';
      doc.convertedAt = new Date();
      await doc.save();

      return res.json({
        success: true,
        message: `Quotation ${doc.documentNumber} successfully converted to Sale Invoice ${invoiceNumber}!`,
        data: { document: doc, sale }
      });
    } else {
      return res.status(400).json({ success: false, message: `Conversion is not supported for ${doc.documentType}.` });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Delete / Cancel Document
// @route DELETE /api/documents/:id
const deleteDocument = async (req, res) => {
  try {
    const document = await Document.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!document) return res.status(404).json({ success: false, message: 'Document not found.' });

    await Document.findByIdAndDelete(document._id);
    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createDocument,
  getDocuments,
  getDocument,
  updateDocumentStatus,
  convertDocument,
  deleteDocument,
};
