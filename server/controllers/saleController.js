const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const StockTransaction = require('../models/StockTransaction');
const Return = require('../models/Return');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const { generateInvoiceNumber, generateReturnNumber } = require('../utils/helpers');

// @desc  Create sale (billing)
// @route POST /api/sales
const createSale = async (req, res) => {
  try {
    const {
      customerId, customerName, customerMobile, customerGstin,
      doctorName, patientName, patientAge, isPrescription,
      items, subtotal, totalDiscount, totalCgst, totalSgst, totalIgst, totalGst,
      isInterState, roundOff, previousDue, grandTotal, amountPaid, paymentMethod, paymentDetails,
      notes, termsConditions, overrideCreditBlock
    } = req.body;

    // Sanitize items: preserve all specialized properties (batch, expiry, size, imei, etc.)
    const sanitizedItems = (items || []).map(item => ({
      ...item,
      productId: (item.productId && mongoose.isValidObjectId(item.productId)) ? item.productId : (item.productId || null)
    }));

    const balanceDue = grandTotal - amountPaid;
    const status = balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIAL' : 'PENDING';

    // 🚨 Check Credit Limit & Overdue Udhaar Blocking
    if (balanceDue > 0 || paymentMethod === 'CREDIT') {
      if (customerId && mongoose.isValidObjectId(customerId)) {
        const custDoc = await Customer.findOne({ _id: customerId, shopId: req.shopId });
        const shopSettings = await Settings.findOne({ shopId: req.shopId });
        
        if (custDoc && (shopSettings?.enableCreditLimitBlock !== false)) {
          const limit = (custDoc.creditLimit !== undefined && custDoc.creditLimit !== null)
            ? custDoc.creditLimit
            : (shopSettings?.defaultCustomerCreditLimit || 10000);

          const totalPendingAfterSale = (custDoc.pendingAmount || 0) + balanceDue;

          if (totalPendingAfterSale > limit && !overrideCreditBlock) {
            return res.status(403).json({
              success: false,
              isCreditBlocked: true,
              currentPending: custDoc.pendingAmount || 0,
              creditLimit: limit,
              totalPendingAfterSale,
              message: `🚨 उधार सीमा पार (अधिकतम सीमा ₹${limit.toLocaleString('en-IN')})! इस ग्राहक का पिछला उधार ₹${(custDoc.pendingAmount || 0).toLocaleString('en-IN')} है। नया उधार जोड़ने पर कुल बकाया ₹${totalPendingAfterSale.toLocaleString('en-IN')} हो जाएगा। पहले पुराना बकाया भुगतान करवाएं, फिर नया माल दें!`
            });
          }
        }
      }
    }

    // 📦 Strict Stock Validation: Ensure requested quantity does not exceed available stock in SALE mode
    for (const item of sanitizedItems) {
      let product = null;
      if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
        product = await Product.findOne({ _id: item.productId, shopId: req.shopId });
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
        const itemQty = Number(item.quantity) || 0;
        const availableStock = Number(product.quantity) || 0;

        if (itemQty > availableStock) {
          return res.status(400).json({
            success: false,
            message: `🚨 अपर्याप्त स्टॉक (Insufficient Stock)! "${product.name}" का उपलब्ध स्टॉक केवल ${availableStock} ${product.unit || 'PCS'} है, जबकि आपने ${itemQty} का बिल बनाने का प्रयास किया है। उपलब्ध स्टॉक से अधिक का बिल नहीं बनाया जा सकता!`
          });
        }

        // If batch is specified, check batch quantity
        if (item.batchNumber && product.batches && product.batches.length > 0) {
          const batch = product.batches.find(b => b.batchNumber && b.batchNumber.toLowerCase() === String(item.batchNumber).trim().toLowerCase());
          if (batch) {
            const batchStock = Number(batch.quantity) || 0;
            if (itemQty > batchStock) {
              return res.status(400).json({
                success: false,
                message: `🚨 बैच "${item.batchNumber}" में केवल ${batchStock} स्टॉक उपलब्ध है (मांग: ${itemQty})!`
              });
            }
          }
        }
      }
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(req.shopId);

    let finalCustomerId = customerId && mongoose.isValidObjectId(customerId) ? customerId : null;
    const cleanMob = (customerMobile || '').replace(/\D/g, '');

    if (finalCustomerId) {
      const existing = await Customer.findOne({ _id: finalCustomerId, shopId: req.shopId });
      if (existing) {
        let shouldSave = false;
        if (customerMobile && (!existing.mobile || existing.mobile !== customerMobile)) {
          existing.mobile = customerMobile;
          shouldSave = true;
        }
        if (customerName && customerName.trim() && customerName.toLowerCase() !== 'walk-in customer' && existing.name !== customerName.trim()) {
          existing.name = customerName.trim();
          shouldSave = true;
        }
        if (customerGstin && !existing.gstin) {
          existing.gstin = customerGstin;
          shouldSave = true;
        }
        if (shouldSave) await existing.save();
      }
    } else {
      let existingCust = null;
      // 🔒 Strict 1-Customer per Mobile Check
      if (cleanMob && cleanMob.length >= 6) {
        const clean10 = cleanMob.slice(-10);
        existingCust = await Customer.findOne({ 
          shopId: req.shopId, 
          isActive: true,
          mobile: { $regex: new RegExp(clean10 + '$', 'i') } 
        });
      }
      if (!existingCust && customerName && customerName.toLowerCase() !== 'walk-in customer') {
        existingCust = await Customer.findOne({ 
          shopId: req.shopId, 
          isActive: true,
          name: { $regex: new RegExp('^' + customerName.trim() + '$', 'i') } 
        });
      }

      if (existingCust) {
        finalCustomerId = existingCust._id;
        // Keep customer name and mobile synced so WhatsApp broadcast and reports always have latest info
        let shouldSave = false;
        if (customerMobile && (!existingCust.mobile || existingCust.mobile !== customerMobile)) {
          existingCust.mobile = customerMobile;
          shouldSave = true;
        }
        if (customerName && customerName.trim() && customerName.toLowerCase() !== 'walk-in customer' && existingCust.name !== customerName.trim()) {
          existingCust.name = customerName.trim();
          shouldSave = true;
        }
        if (customerGstin && !existingCust.gstin) {
          existingCust.gstin = customerGstin;
          shouldSave = true;
        }
        if (shouldSave) {
          await existingCust.save();
        }
      } else if (customerName || customerMobile) {
        // Create only if NO customer with this number exists
        const newCust = await Customer.create({
          shopId: req.shopId,
          name: (customerName && customerName.trim() && customerName.toLowerCase() !== 'walk-in customer') ? customerName.trim() : `Customer ${customerMobile || ''}`,
          mobile: customerMobile || '',
          gstin: customerGstin || '',
          pendingAmount: 0,
          totalPurchases: 0,
          totalPaid: 0,
          isActive: true
        });
        finalCustomerId = newCust._id;
      }
    }

    const sale = await Sale.create({
      shopId: req.shopId,
      invoiceNumber,
      customerId: finalCustomerId,
      customerName: customerName || 'Walk-in Customer',
      customerMobile: customerMobile || '',
      customerGstin: customerGstin || '',
      doctorName,
      patientName,
      patientAge,
      isPrescription: !!isPrescription,
      items: sanitizedItems,
      subtotal,
      totalDiscount,
      totalCgst,
      totalSgst,
      totalIgst,
      totalGst,
      isInterState,
      roundOff,
      previousDue: Number(previousDue) || 0,
      grandTotal,
      amountPaid,
      balanceDue,
      paymentMethod,
      paymentDetails,
      status,
      notes,
      termsConditions,
      createdBy: req.user._id,
    });

    // Reduce stock for each item
    for (const item of sanitizedItems) {
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
        const itemQty = Number(item.quantity) || 1;
        const newQty = product.quantity - itemQty;
        product.quantity = Math.max(0, newQty);

        // Deduct from specific batch or FEFO (First Expiry First Out)
        if (product.batches && product.batches.length > 0) {
          if (item.batchNumber) {
            const batch = product.batches.find(b => b.batchNumber && b.batchNumber.toLowerCase() === String(item.batchNumber).trim().toLowerCase());
            if (batch) {
              batch.quantity = Math.max(0, (batch.quantity || 0) - itemQty);
            }
          } else {
            // FEFO: Sort by expiry ascending and deduct from earliest expiry
            const sortedBatches = product.batches.filter(b => (b.quantity || 0) > 0).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
            let remainingToDeduct = itemQty;
            for (const b of sortedBatches) {
              if (remainingToDeduct <= 0) break;
              const deductAmount = Math.min(b.quantity, remainingToDeduct);
              b.quantity -= deductAmount;
              remainingToDeduct -= deductAmount;
            }
          }
        }

        await product.save();

        await StockTransaction.create({
          shopId: req.shopId,
          productId: product._id,
          productName: product.name,
          type: 'SALE',
          quantity: -itemQty,
          balanceAfter: product.quantity,
          referenceId: sale._id,
          referenceType: 'Sale',
          referenceNumber: invoiceNumber,
          notes: item.batchNumber ? `Sold from Batch: ${item.batchNumber}` : 'Sold via POS Billing',
          createdBy: req.user._id,
        });

          // Low stock notification
          if (product.quantity <= product.minStockLevel && product.quantity > 0) {
            await Notification.create({
              shopId: req.shopId,
              type: 'LOW_STOCK',
              title: 'Low Stock Alert',
              message: `${product.name} stock is low (${product.quantity} remaining)`,
              referenceId: product._id,
              referenceType: 'Product',
              priority: 'HIGH',
            });
          } else if (product.quantity === 0) {
            await Notification.create({
              shopId: req.shopId,
              type: 'OUT_OF_STOCK',
              title: 'Out of Stock',
              message: `${product.name} is out of stock`,
              referenceId: product._id,
              referenceType: 'Product',
              priority: 'HIGH',
            });
          }
        }
      }

    // Update customer balance (if previousDue was included in bill, only adjust net difference)
    if (finalCustomerId) {
      const prevDueAmount = Number(previousDue) || 0;
      const netPendingChange = balanceDue - prevDueAmount;
      await Customer.findByIdAndUpdate(finalCustomerId, {
        $inc: {
          totalPurchases: grandTotal - prevDueAmount,
          totalPaid: amountPaid,
          pendingAmount: netPendingChange,
        },
      });
    }

    // Record payment
    if (amountPaid > 0) {
      const paymentItems = items ? items.map(item => ({
        productId: item.productId,
        productName: item.productName || 'Product',
        quantity: item.quantity || 1,
        unit: item.unit || 'PCS',
        rate: item.rate || 0,
        subtotal: item.subtotal || 0,
        total: item.total || 0,
      })) : [];

      const txnRef = (paymentDetails && paymentDetails[0] && paymentDetails[0].reference) || 'TXN_' + Date.now().toString().slice(-6);

      await Payment.create({
        shopId: req.shopId,
        type: 'RECEIVED',
        partyType: 'CUSTOMER',
        customerId: finalCustomerId || null,
        partyName: customerName || 'Walk-in Customer',
        payerName: customerName || 'Walk-in Customer',
        customerMobile: customerMobile || '',
        amount: amountPaid,
        method: paymentMethod || 'CASH',
        status: 'SUCCESS',
        referenceId: sale._id,
        referenceType: 'Sale',
        referenceNumber: invoiceNumber,
        transactionId: txnRef,
        items: paymentItems,
        subtotal: subtotal || amountPaid,
        grandTotal: grandTotal || amountPaid,
        notes: notes || '',
        createdBy: req.user._id,
        date: new Date(),
      });
    }


    // Notification for Udhaar (Pending balance)
    if (balanceDue > 0) {
      await Notification.create({
        shopId: req.shopId,
        type: 'PENDING_PAYMENT',
        title: `उधार बिल: ${customerName || 'Customer'} (₹${balanceDue.toFixed(2)})`,
        message: `ग्राहक ${customerName || 'Walk-in'} के इनवॉइस #${invoiceNumber} पर ₹${balanceDue.toFixed(2)} का उधार दर्ज किया गया।`,
        referenceId: sale._id,
        referenceType: 'Sale',
        priority: 'MEDIUM',
      });
    }

    res.status(201).json({ success: true, message: 'Bill created successfully!', data: sale });

  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const Shop = require('../models/Shop');

// @desc  Get all sales
// @route GET /api/sales
const getSales = async (req, res) => {
  try {
    const { search, startDate, endDate, status, branch, allBranches, page = 1, limit = 50 } = req.query;
    let shopFilter = req.shopId;

    if (allBranches === 'true' || branch === 'ALL') {
      const ownedShops = await Shop.find({
        $or: [{ owner: req.user._id }, { _id: req.user.shopId }]
      }).select('_id');
      shopFilter = { $in: ownedShops.map(s => s._id) };
    } else if (branch && branch !== 'ALL' && mongoose.isValidObjectId(branch)) {
      shopFilter = branch;
    }

    const query = { shopId: shopFilter };

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerMobile: { $regex: search, $options: 'i' } },
      ];
    }
    if (status) query.status = status;
    if (startDate || endDate) {
      query.invoiceDate = {};
      if (startDate) query.invoiceDate.$gte = new Date(startDate);
      if (endDate) query.invoiceDate.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Sale.countDocuments(query);
    const sales = await Sale.find(query).sort({ invoiceDate: -1 }).skip(skip).limit(parseInt(limit));

    res.json({
      success: true,
      data: sales,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single sale
// @route GET /api/sales/:id
const getSale = async (req, res) => {
  try {
    const sale = await Sale.findOne({ _id: req.params.id, shopId: req.shopId })
      .populate('customerId', 'name mobile email address gstin')
      .populate('createdBy', 'name');
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });
    res.json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Sale return
// @route POST /api/sales/:id/return
const saleReturn = async (req, res) => {
  try {
    const { items, reason, refundMethod, notes } = req.body;
    const sale = await Sale.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
    const returnNumber = generateReturnNumber('SALE_RETURN');

    const returnDoc = await Return.create({
      shopId: req.shopId,
      returnType: 'SALE_RETURN',
      returnNumber,
      originalId: sale._id,
      originalNumber: sale.invoiceNumber,
      customerId: sale.customerId,
      partyName: sale.customerName,
      items,
      totalAmount,
      reason,
      refundMethod,
      notes,
      createdBy: req.user._id,
    });

    // Restore stock
    for (const item of items) {
      if (item.productId) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity += item.quantity;
          await product.save();

          await StockTransaction.create({
            shopId: req.shopId,
            productId: product._id,
            productName: product.name,
            type: 'SALE_RETURN',
            quantity: item.quantity,
            balanceAfter: product.quantity,
            referenceId: returnDoc._id,
            referenceType: 'Return',
            referenceNumber: returnNumber,
            createdBy: req.user._id,
          });
        }
      }
    }

    // Update customer balance
    if (sale.customerId) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { totalPurchases: -totalAmount, pendingAmount: -totalAmount },
      });
    }

    res.status(201).json({ success: true, message: 'Sale return processed.', data: returnDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Receive payment for credit sale
// @route POST /api/sales/:id/receive-payment
const receivePayment = async (req, res) => {
  try {
    const { amount, method, transactionId, notes } = req.body;
    const sale = await Sale.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    if (amount > sale.balanceDue) {
      return res.status(400).json({ success: false, message: `Amount exceeds balance due (₹${sale.balanceDue})` });
    }

    sale.amountPaid += amount;
    sale.balanceDue -= amount;
    sale.status = sale.balanceDue <= 0 ? 'PAID' : 'PARTIAL';
    await sale.save();

    const paymentItems = sale.items ? sale.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      subtotal: item.subtotal,
      total: item.total,
    })) : [];

    await Payment.create({
      shopId: req.shopId,
      type: 'RECEIVED',
      partyType: 'CUSTOMER',
      customerId: sale.customerId || null,
      partyName: sale.customerName || 'Customer',
      payerName: sale.customerName || 'Customer',
      customerMobile: sale.customerMobile || '',
      amount,
      method: method || 'CASH',
      status: 'SUCCESS',
      referenceId: sale._id,
      referenceType: 'Sale',
      referenceNumber: sale.invoiceNumber,
      transactionId: transactionId || 'TXN_' + Date.now().toString().slice(-6),
      items: paymentItems,
      subtotal: sale.subtotal,
      grandTotal: sale.grandTotal,
      notes,
      createdBy: req.user._id,
      date: new Date(),
    });


    if (sale.customerId) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { totalPaid: amount, pendingAmount: -amount },
      });
    }

    res.json({ success: true, message: 'Payment received.', data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Helper function to build PDF in memory buffer for A4, 80mm, or 58mm layouts
const buildSalePDF = (sale, shop, formatInput = 'A4') => {
  return new Promise((resolve, reject) => {
    try {
      const PDFDocument = require('pdfkit');
      const chunks = [];
      
      const fmtUpper = String(formatInput || 'A4').toUpperCase();
      let format = 'A4';
      if (fmtUpper.includes('80')) format = '80MM';
      else if (fmtUpper.includes('58') || fmtUpper.includes('53') || fmtUpper.includes('MINI')) format = '58MM';

      let docOptions = { margin: 15 };
      let pageWidth = 535;
      let startX = 15;
      
      if (format === '80MM') {
        const itemHeight = 18;
        const calculatedHeight = 190 + (sale.items.length * itemHeight) + 110;
        docOptions = { margin: 10, size: [226, Math.max(320, calculatedHeight)] };
        pageWidth = 206;
        startX = 10;
      } else if (format === '58MM') {
        const itemHeight = 18;
        const calculatedHeight = 180 + (sale.items.length * itemHeight) + 100;
        docOptions = { margin: 8, size: [164, Math.max(300, calculatedHeight)] };
        pageWidth = 148;
        startX = 8;
      } else {
        docOptions = { margin: 30, size: 'A4' };
        pageWidth = 535;
        startX = 30;
      }
      
      const doc = new PDFDocument(docOptions);
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', err => reject(err));
      
      let y = docOptions.margin;
      
      if (format === '80MM' || format === '58MM') {
        // Sleek Thermal POS Receipt Layout
        doc.fillColor('#0f172a').fontSize(format === '80MM' ? 10 : 8.5).font('Helvetica-Bold').text(shop?.name || 'MKS Store', startX, y, { align: 'center', width: pageWidth });
        y += format === '80MM' ? 14 : 11;
        
        doc.fontSize(format === '80MM' ? 7.5 : 6.5).font('Helvetica').fillColor('#334155');
        doc.text(`${shop?.address || ''}, ${shop?.city || ''}`, startX, y, { align: 'center', width: pageWidth });
        y += 10;
        doc.text(`Mob: ${shop?.mobile || ''}`, startX, y, { align: 'center', width: pageWidth });
        y += 10;
        if (shop?.gstin) {
          doc.font('Helvetica-Bold').text(`GSTIN: ${shop.gstin}`, startX, y, { align: 'center', width: pageWidth });
          y += 11;
        }
        
        // Separator line
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).stroke('#cbd5e1');
        y += 5;
        
        doc.font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`Inv: ${sale.invoiceNumber}`, startX, y);
        y += 10;
        doc.font('Helvetica').fillColor('#334155');
        doc.text(`Date: ${new Date(sale.invoiceDate).toLocaleDateString()}`, startX, y);
        y += 10;
        doc.text(`Cust: ${sale.customerName || 'Walk-in'}`, startX, y);
        y += 12;
        
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).stroke('#cbd5e1');
        y += 5;
        
        // Table Header
        doc.font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('Description', startX, y);
        doc.text('Qty', startX + (format === '80MM' ? 110 : 75), y, { width: 25, align: 'center' });
        doc.text('Total', startX + (format === '80MM' ? 145 : 100), y, { width: 50, align: 'right' });
        y += 12;
        
        doc.font('Helvetica').fillColor('#334155');
        sale.items.forEach((item) => {
          doc.text(item.productName.substring(0, format === '80MM' ? 22 : 16), startX, y);
          doc.text(`${item.quantity}`, startX + (format === '80MM' ? 110 : 75), y, { width: 25, align: 'center' });
          doc.text(`Rs.${item.total.toFixed(2)}`, startX + (format === '80MM' ? 145 : 100), y, { width: 50, align: 'right' });
          y += 12;
        });
        
        y += 4;
        doc.moveTo(startX, y).lineTo(startX + pageWidth, y).stroke('#cbd5e1');
        y += 6;
        
        // Totals
        doc.font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('GRAND TOTAL:', startX, y);
        doc.text(`Rs. ${sale.grandTotal.toFixed(2)}`, startX + (format === '80MM' ? 110 : 80), y, { width: pageWidth - (format === '80MM' ? 110 : 80), align: 'right' });
        y += 12;
        doc.font('Helvetica').fontSize(format === '80MM' ? 7 : 6).fillColor('#64748b');
        doc.text(`Paid: Rs.${sale.amountPaid.toFixed(2)} | Due: Rs.${sale.balanceDue.toFixed(2)}`, startX, y, { align: 'center', width: pageWidth });
        y += 12;
        doc.text('Thank you for shopping with us!', startX, y, { align: 'center', width: pageWidth });
        
      } else {
        // Classic A4 Layout
        // Header Title
        doc.rect(startX, y, pageWidth, 24).fill('#f1f5f9');
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', startX, y + 6, { align: 'center', width: pageWidth });
        y += 24;
    
        // Seller & Meta Box (Outer rectangle)
        doc.rect(startX, y, pageWidth, 90).stroke('#94a3b8');
        
        // Left: Seller Info
        doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold').text(shop?.name || 'MKS Store', startX + 10, y + 10);
        doc.fontSize(8).font('Helvetica').fillColor('#334155');
        doc.text(`${shop?.address || ''}, ${shop?.city || ''}, ${shop?.state || ''} - ${shop?.pincode || ''}`, startX + 10, y + 26);
        doc.text(`Mobile: ${shop?.mobile || ''} | Email: ${shop?.email || ''}`, startX + 10, y + 38);
        if (shop?.gstin) {
          doc.font('Helvetica-Bold').text(`GSTIN: ${shop.gstin}`, startX + 10, y + 50);
        }
    
        // Vertical separator
        doc.moveTo(startX + 300, y).lineTo(startX + 300, y + 90).stroke('#cbd5e1');
    
        // Right: Invoice Meta
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0f172a');
        doc.text(`Invoice No:`, startX + 310, y + 10);
        doc.font('Helvetica').text(`${sale.invoiceNumber}`, startX + 390, y + 10);
        doc.font('Helvetica-Bold').text(`Date & Time:`, startX + 310, y + 24);
        doc.font('Helvetica').text(`${new Date(sale.invoiceDate).toLocaleString()}`, startX + 390, y + 24);
        doc.font('Helvetica-Bold').text(`Place of Supply:`, startX + 310, y + 38);
        doc.font('Helvetica').text(`${sale.isInterState ? 'Inter-State' : (shop?.state || 'Local')}`, startX + 390, y + 38);
        doc.font('Helvetica-Bold').text(`Payment Mode:`, startX + 310, y + 52);
        doc.font('Helvetica-Bold').fillColor(sale.paymentMethod === 'CREDIT' ? '#dc2626' : '#0f172a').text(`${sale.paymentMethod}`, startX + 390, y + 52);
    
        y += 90;
    
        // Buyer / Billed To Section
        doc.rect(startX, y, pageWidth, 55).stroke('#94a3b8');
        doc.rect(startX, y, pageWidth, 16).fill('#f8fafc');
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text('DETAILS OF RECIPIENT / BILLED TO', startX + 10, y + 4);
        
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(`Customer: ${sale.customerName || 'Walk-in Customer'}`, startX + 10, y + 20);
        doc.fontSize(8).font('Helvetica').fillColor('#334155');
        if (sale.customerMobile) doc.text(`Mobile: ${sale.customerMobile}`, startX + 10, y + 32);
        if (sale.customerGstin) doc.text(`GSTIN: ${sale.customerGstin}`, startX + 220, y + 32);
        
        y += 55;
    
        // Items Table Header
        doc.rect(startX, y, pageWidth, 20).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(8).font('Helvetica-Bold');
        doc.text('#', startX + 5, y + 6, { width: 25, align: 'center' });
        doc.text('Item Description', startX + 30, y + 6, { width: 190 });
        doc.text('HSN', startX + 220, y + 6, { width: 50, align: 'center' });
        doc.text('Qty', startX + 270, y + 6, { width: 45, align: 'center' });
        doc.text('Rate (Rs.)', startX + 315, y + 6, { width: 55, align: 'right' });
        doc.text('Disc', startX + 370, y + 6, { width: 40, align: 'right' });
        doc.text('GST %', startX + 410, y + 6, { width: 45, align: 'center' });
        doc.text('Total (Rs.)', startX + 455, y + 6, { width: 75, align: 'right' });
        y += 20;
    
        // Items Rows
        let totalQty = 0;
        sale.items.forEach((item, index) => {
          totalQty += (item.quantity || 0);
          const rowHeight = 18;
          if (index % 2 === 1) {
            doc.rect(startX, y, pageWidth, rowHeight).fill('#f8fafc');
          }
          doc.rect(startX, y, pageWidth, rowHeight).stroke('#e2e8f0');
    
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
          doc.text(`${index + 1}`, startX + 5, y + 5, { width: 25, align: 'center' });
          doc.font('Helvetica-Bold').text(item.productName, startX + 30, y + 5, { width: 190 });
          doc.font('Helvetica').text(item.hsnCode || '-', startX + 220, y + 5, { width: 50, align: 'center' });
          doc.text(`${item.quantity} ${item.unit || 'PCS'}`, startX + 270, y + 5, { width: 45, align: 'center' });
          doc.text(`${item.rate.toFixed(2)}`, startX + 315, y + 5, { width: 55, align: 'right' });
          doc.text(item.discount > 0 ? `${item.discount}` : '-', startX + 370, y + 5, { width: 40, align: 'right' });
          doc.text(`${item.gstPercent}%`, startX + 410, y + 5, { width: 45, align: 'center' });
          doc.font('Helvetica-Bold').text(`${item.total.toFixed(2)}`, startX + 455, y + 5, { width: 75, align: 'right' });
          
          y += rowHeight;
        });
    
        // Total Row
        doc.rect(startX, y, pageWidth, 20).fill('#f1f5f9');
        doc.rect(startX, y, pageWidth, 20).stroke('#94a3b8');
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
        doc.text('TOTAL:', startX + 30, y + 6);
        doc.text(`${totalQty}`, startX + 270, y + 6, { width: 45, align: 'center' });
        doc.text(`Rs. ${sale.grandTotal.toFixed(2)}`, startX + 455, y + 6, { width: 75, align: 'right' });
        y += 20;
    
        // Bottom Calculation Box
        const calcBoxHeight = 85;
        doc.rect(startX, y, pageWidth, calcBoxHeight).stroke('#94a3b8');
        
        // Left Terms
        doc.fillColor('#334155').fontSize(7).font('Helvetica');
        doc.text('Terms & Conditions:', startX + 10, y + 8);
        doc.text('1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.\n3. Thank you for your business!', startX + 10, y + 20);
    
        // Right Calculation
        const calcX = startX + 320;
        doc.fontSize(8);
        doc.font('Helvetica').text('Subtotal:', calcX, y + 8);
        doc.text(`Rs. ${sale.subtotal.toFixed(2)}`, calcX + 100, y + 8, { width: 105, align: 'right' });
        
        if (sale.totalDiscount > 0) {
          doc.text('Discount:', calcX, y + 20);
          doc.text(`-Rs. ${sale.totalDiscount.toFixed(2)}`, calcX + 100, y + 20, { width: 105, align: 'right' });
        }
        
        doc.text('Total GST Tax:', calcX, y + 32);
        doc.text(`Rs. ${sale.totalGst.toFixed(2)}`, calcX + 100, y + 32, { width: 105, align: 'right' });
    
        doc.rect(calcX - 10, y + 46, 225, 20).fill('#0f172a');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
        doc.text('GRAND TOTAL:', calcX, y + 51);
        doc.text(`Rs. ${sale.grandTotal.toFixed(2)}`, calcX + 100, y + 51, { width: 105, align: 'right' });
    
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica');
        doc.text(`Amount Paid: Rs. ${sale.amountPaid.toFixed(2)} | Balance Due: Rs. ${sale.balanceDue.toFixed(2)}`, calcX, y + 70);
    
        y += calcBoxHeight + 10;
    
        // Footer
        doc.fillColor('#64748b').fontSize(7).text('This is a Computer Generated Tax Invoice.', startX, y, { align: 'center', width: pageWidth });
      }
      
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};

// @desc  Generate Sale PDF
// @route GET /api/sales/:id/pdf
const generateSalePDF = async (req, res) => {
  try {
    const Shop = require('../models/Shop');
    const sale = await Sale.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const shop = await Shop.findById(req.shopId);
    const format = req.query.format || 'A4';

    const pdfBuffer = await buildSalePDF(sale, shop, format);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${sale.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Share Sale Invoice on WhatsApp as PDF Attachment
// @route POST /api/sales/:id/share-whatsapp
const shareSaleWhatsApp = async (req, res) => {
  try {
    const { mobile, format } = req.body;
    const Shop = require('../models/Shop');
    const whatsappClient = require('../utils/whatsappClient');

    const sale = await Sale.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!sale) return res.status(404).json({ success: false, message: 'Sale not found.' });

    const shop = await Shop.findById(req.shopId);

    const targetMobile = mobile || sale.customerMobile;
    if (!targetMobile) {
      return res.status(400).json({ success: false, message: 'ग्राहक का मोबाइल नंबर आवश्यक है।' });
    }

    const pdfFormat = format || 'A4';
    const pdfBuffer = await buildSalePDF(sale, shop, pdfFormat);

    const filename = `Invoice-${sale.invoiceNumber}.pdf`;
    const caption = `नमस्ते *${sale.customerName || 'Customer'}*,\n\nयह आपका *${shop?.name || 'Store'}* से प्राप्त टैक्स इनवॉइस है।\n\n📄 *इनवॉइस नंबर:* ${sale.invoiceNumber}\n💰 *कुल देय राशि:* ₹${sale.grandTotal}\n\nधन्यवाद! 🙏`;

    const result = await whatsappClient.sendWhatsAppMedia(targetMobile, pdfBuffer, filename, caption);

    if (result.success) {
      res.json({ success: true, message: 'WhatsApp पर बिल PDF सफलतापूर्वक भेज दिया गया है!' });
    } else {
      res.status(500).json({ success: false, message: result.error || 'WhatsApp पर बिल भेजने में विफलता।' });
    }
  } catch (error) {
    console.error('WhatsApp share error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Update / Edit Sale Bill
// @route PUT /api/sales/:id
const updateSale = async (req, res) => {
  try {
    const saleId = req.params.id;
    const oldSale = await Sale.findOne({ _id: saleId, shopId: req.shopId });
    if (!oldSale) {
      return res.status(404).json({ success: false, message: 'बिल (Sale Bill) नहीं मिला।' });
    }

    const {
      customerId, customerName, customerMobile, customerGstin,
      doctorName, doctorId, doctorRegNumber, patientName, patientAge, patientGender, isPrescription, prescriptionRef,
      items, subtotal, totalDiscount, totalCgst, totalSgst, totalIgst, totalGst,
      isInterState, roundOff, grandTotal, amountPaid, paymentMethod, paymentDetails, notes
    } = req.body;

    const sanitizedItems = (items || []).map(item => ({
      ...item,
      productId: (item.productId && (String(item.productId).startsWith('FAST_') || String(item.productId).startsWith('CUSTOM_'))) ? null : item.productId
    }));

    // 1. REVERT OLD STOCK DEDUCTIONS
    for (const item of (oldSale.items || [])) {
      if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
        const prod = await Product.findById(item.productId);
        if (prod) {
          const qtyToRestore = Number(item.quantity) || 0;
          prod.quantity = (prod.quantity || 0) + qtyToRestore;
          if (item.batchNumber && prod.batches && prod.batches.length > 0) {
            const b = prod.batches.find(x => x.batchNumber && x.batchNumber.toLowerCase() === String(item.batchNumber).trim().toLowerCase());
            if (b) {
              b.quantity = (b.quantity || 0) + qtyToRestore;
            }
          }
          await prod.save();
        }
      }
    }

    // 2. CHECK STOCK FOR NEW ITEMS BEFORE APPLYING
    for (const item of sanitizedItems) {
      let product = null;
      if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
        product = await Product.findById(item.productId);
      }
      if (product) {
        const itemQty = Number(item.quantity) || 0;
        const availableStock = Number(product.quantity) || 0;
        if (itemQty > availableStock) {
          // Re-deduct old items before returning error to preserve original state
          for (const oldItem of (oldSale.items || [])) {
            if (oldItem.productId && mongoose.Types.ObjectId.isValid(oldItem.productId)) {
              const oldProd = await Product.findById(oldItem.productId);
              if (oldProd) {
                const oldQty = Number(oldItem.quantity) || 0;
                oldProd.quantity = Math.max(0, (oldProd.quantity || 0) - oldQty);
                if (oldItem.batchNumber && oldProd.batches) {
                  const ob = oldProd.batches.find(x => x.batchNumber && x.batchNumber.toLowerCase() === String(oldItem.batchNumber).trim().toLowerCase());
                  if (ob) ob.quantity = Math.max(0, (ob.quantity || 0) - oldQty);
                }
                await oldProd.save();
              }
            }
          }
          return res.status(400).json({
            success: false,
            message: `🚨 अपर्याप्त स्टॉक (Insufficient Stock)! "${product.name}" का उपलब्ध स्टॉक केवल ${availableStock} ${product.unit || 'PCS'} है (मांग: ${itemQty})।`
          });
        }
      }
    }

    // 3. APPLY NEW STOCK DEDUCTIONS
    for (const item of sanitizedItems) {
      let product = null;
      if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
        product = await Product.findById(item.productId);
      }
      if (product) {
        const itemQty = Number(item.quantity) || 1;
        product.quantity = Math.max(0, (product.quantity || 0) - itemQty);

        if (product.batches && product.batches.length > 0) {
          if (item.batchNumber) {
            const batch = product.batches.find(b => b.batchNumber && b.batchNumber.toLowerCase() === String(item.batchNumber).trim().toLowerCase());
            if (batch) {
              batch.quantity = Math.max(0, (batch.quantity || 0) - itemQty);
            }
          } else {
            const sortedBatches = product.batches.filter(b => (b.quantity || 0) > 0).sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
            let remaining = itemQty;
            for (const b of sortedBatches) {
              if (remaining <= 0) break;
              const deduct = Math.min(b.quantity, remaining);
              b.quantity -= deduct;
              remaining -= deduct;
            }
          }
        }
        await product.save();
      }
    }

    // 3. REVERT & RE-APPLY CUSTOMER BALANCES
    if (oldSale.customerId) {
      await Customer.findByIdAndUpdate(oldSale.customerId, {
        $inc: {
          totalPurchases: -(oldSale.grandTotal || 0),
          totalPaid: -(oldSale.amountPaid || 0),
          pendingAmount: -(oldSale.balanceDue || 0)
        }
      });
    }

    const newGrandTotal = Number(grandTotal) || 0;
    const newAmountPaid = Number(amountPaid) || 0;
    const newBalanceDue = Math.max(0, newGrandTotal - newAmountPaid);
    let newStatus = 'PAID';
    if (newAmountPaid === 0 && newGrandTotal > 0) newStatus = 'PENDING';
    else if (newAmountPaid < newGrandTotal) newStatus = 'PARTIAL';

    if (customerId) {
      await Customer.findByIdAndUpdate(customerId, {
        $inc: {
          totalPurchases: newGrandTotal,
          totalPaid: newAmountPaid,
          pendingAmount: newBalanceDue
        }
      });
    }

    // 4. UPDATE SALE RECORD
    oldSale.customerId = customerId || null;
    oldSale.customerName = customerName;
    oldSale.customerMobile = customerMobile;
    oldSale.customerGstin = customerGstin;
    oldSale.doctorName = doctorName || '';
    oldSale.doctorId = doctorId || null;
    oldSale.doctorRegNumber = doctorRegNumber || '';
    oldSale.patientName = patientName || '';
    oldSale.patientAge = patientAge || '';
    oldSale.patientGender = patientGender || '';
    oldSale.isPrescription = !!isPrescription;
    oldSale.prescriptionRef = prescriptionRef || '';
    oldSale.items = sanitizedItems;
    oldSale.subtotal = Number(subtotal) || 0;
    oldSale.totalDiscount = Number(totalDiscount) || 0;
    oldSale.totalCgst = Number(totalCgst) || 0;
    oldSale.totalSgst = Number(totalSgst) || 0;
    oldSale.totalIgst = Number(totalIgst) || 0;
    oldSale.totalGst = Number(totalGst) || 0;
    oldSale.isInterState = !!isInterState;
    oldSale.roundOff = Number(roundOff) || 0;
    oldSale.grandTotal = newGrandTotal;
    oldSale.amountPaid = newAmountPaid;
    oldSale.balanceDue = newBalanceDue;
    oldSale.paymentMethod = paymentMethod || 'CASH';
    oldSale.paymentDetails = paymentDetails || [];
    oldSale.status = newStatus;
    oldSale.notes = notes || '';
    oldSale.isEdited = true;
    oldSale.editedAt = new Date();
    oldSale.editedBy = req.user._id;

    await oldSale.save();

    // 5. UPDATE OR CREATE PAYMENT LEDGER
    await Payment.updateMany(
      { referenceId: oldSale._id, shopId: req.shopId },
      {
        $set: {
          amount: newAmountPaid,
          partyName: customerName || 'Customer',
          payerName: customerName || 'Customer',
          customerMobile: customerMobile || '',
          method: paymentMethod || 'CASH',
          subtotal: oldSale.subtotal,
          grandTotal: oldSale.grandTotal,
          notes: `Updated on bill edit: ${notes || ''}`
        }
      }
    );

    res.json({
      success: true,
      message: 'बिल सफलतापूर्वक अपडेट (Edit) कर दिया गया है।',
      data: oldSale
    });
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { createSale, getSales, getSale, updateSale, saleReturn, receivePayment, generateSalePDF, shareSaleWhatsApp };

