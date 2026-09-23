const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const Notification = require('../models/Notification');

const escapeRegex = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @desc  Get all products
// @route GET /api/products
const getProducts = async (req, res) => {
  try {
    const { search, category, brand, lowStock, shopType, page = 1, limit = 50 } = req.query;
    const activeShopType = shopType || req.shopType;
    
    // Base conditions: match shopId and non-deleted products
    const conditions = [
      { shopId: req.shopId },
      { isActive: { $ne: false } }
    ];

    // Filter by store type if specified, while preserving products created without explicit shopType
    if (activeShopType && activeShopType !== 'ALL') {
      conditions.push({
        $or: [
          { shopType: activeShopType },
          { shopType: { $exists: false } },
          { shopType: null },
          { shopType: '' }
        ]
      });
    }

    if (category) {
      conditions.push({ category });
    }

    if (brand) {
      conditions.push({ brand });
    }

    if (lowStock === 'true') {
      conditions.push({ $expr: { $lte: ['$quantity', '$minStockLevel'] } });
    }

    // Process search query: safe regex escaping + multi-term AND matching
    const rawSearch = String(search || '').trim();
    if (rawSearch) {
      const terms = rawSearch.split(/\s+/).filter(Boolean);
      terms.forEach(term => {
        const escaped = escapeRegex(term);
        const searchRegex = { $regex: escaped, $options: 'i' };
        conditions.push({
          $or: [
            { name: searchRegex },
            { sku: searchRegex },
            { barcode: searchRegex },
            { brand: searchRegex },
            { category: searchRegex },
            { genericName: searchRegex },
            { company: searchRegex },
            { manufacturer: searchRegex },
            { batchNumber: searchRegex },
            { imeiNumber: searchRegex },
            { size: searchRegex },
            { color: searchRegex },
            { model: searchRegex },
            { rackLocation: searchRegex },
            { rack: searchRegex },
            { shelf: searchRegex },
            { hsnCode: searchRegex }
          ]
        });
      });
    }

    const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: products,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('getProducts Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get single product
// @route GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Create product
// @route POST /api/products
const createProduct = async (req, res) => {
  try {
    const shopType = req.body.shopType || req.shopType || 'KIRANA';
    let productData = { ...req.body, shopId: req.shopId, shopType };

    // Auto-generate barcode if empty
    if (!productData.barcode || !productData.barcode.trim()) {
      const uniqueSuffix = Date.now().toString().slice(-7) + Math.floor(100 + Math.random() * 900);
      productData.barcode = `890${uniqueSuffix}`;
    }

    const product = await Product.create(productData);

    // Log stock transaction for opening stock
    if (product.quantity > 0) {
      await StockTransaction.create({
        shopId: req.shopId,
        productId: product._id,
        productName: product.name,
        type: 'OPENING',
        quantity: product.quantity,
        balanceAfter: product.quantity,
        notes: 'Opening stock',
        createdBy: req.user._id,
      });
    }

    res.status(201).json({ success: true, message: 'Product created.', data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Update product
// @route PUT /api/products/:id
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId },
      req.body,
      { new: true, runValidators: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, message: 'Product updated.', data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Delete product (soft delete)
// @route DELETE /api/products/:id
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId },
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    res.json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Adjust stock
// @route POST /api/products/:id/adjust-stock
const adjustStock = async (req, res) => {
  try {
    const { quantity, targetQuantity, notes } = req.body;
    const product = await Product.findOne({ _id: req.params.id, shopId: req.shopId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    let addedQty = Number(quantity) || 0;
    let newQty = product.quantity + addedQty;

    if (targetQuantity !== undefined && targetQuantity !== null && !isNaN(Number(targetQuantity))) {
      newQty = Number(targetQuantity);
      addedQty = newQty - product.quantity;
    }

    if (newQty < 0) return res.status(400).json({ success: false, message: 'Stock cannot go below 0.' });

    product.quantity = newQty;
    await product.save();

    await StockTransaction.create({
      shopId: req.shopId,
      productId: product._id,
      productName: product.name,
      type: addedQty >= 0 ? 'PURCHASE' : 'ADJUSTMENT',
      quantity: Math.abs(addedQty),
      balanceAfter: newQty,
      referenceType: 'Adjustment',
      notes: notes || (addedQty >= 0 ? `Stock Refilled (+${addedQty})` : `Stock Reduced (${addedQty})`),
      createdBy: req.user._id,
    });

    res.json({
      success: true,
      message: `Stock updated for "${product.name}". New quantity: ${newQty} ${product.unit || 'PCS'}`,
      data: product
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Bulk refill / restock low stock products
// @route POST /api/products/bulk-restock
const bulkRestock = async (req, res) => {
  try {
    const { items, defaultAddQty = 50 } = req.body;
    let updatedCount = 0;

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const prod = await Product.findOne({ _id: item.productId, shopId: req.shopId });
        if (prod) {
          const qtyToAdd = Number(item.addQty) || defaultAddQty;
          prod.quantity += qtyToAdd;
          await prod.save();

          await StockTransaction.create({
            shopId: req.shopId,
            productId: prod._id,
            productName: prod.name,
            type: 'PURCHASE',
            quantity: qtyToAdd,
            balanceAfter: prod.quantity,
            referenceType: 'Restock',
            notes: `Restocked +${qtyToAdd}`,
            createdBy: req.user._id,
          });
          updatedCount++;
        }
      }
    } else {
      // Find all low stock items in this shop
      const lowStockProducts = await Product.find({
        shopId: req.shopId,
        isActive: true,
        $expr: { $lte: ['$quantity', '$minStockLevel'] }
      });

      for (const prod of lowStockProducts) {
        const targetQty = Math.max(50, (prod.minStockLevel || 5) * 5);
        const qtyToAdd = targetQty - prod.quantity;
        if (qtyToAdd > 0) {
          prod.quantity = targetQty;
          await prod.save();

          await StockTransaction.create({
            shopId: req.shopId,
            productId: prod._id,
            productName: prod.name,
            type: 'PURCHASE',
            quantity: qtyToAdd,
            balanceAfter: prod.quantity,
            referenceType: 'Restock',
            notes: `Full Restock to ${targetQty}`,
            createdBy: req.user._id,
          });
          updatedCount++;
        }
      }
    }

    res.json({
      success: true,
      message: `Successfully restocked ${updatedCount} products to full inventory levels!`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get stock history
// @route GET /api/products/:id/stock-history
const getStockHistory = async (req, res) => {
  try {
    const history = await StockTransaction.find({
      shopId: req.shopId,
      productId: req.params.id,
    }).sort({ createdAt: -1 }).limit(50);

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Search product by barcode
// @route GET /api/products/barcode/:code
const getByBarcode = async (req, res) => {
  try {
    const product = await Product.findOne({ barcode: req.params.code, shopId: req.shopId, isActive: true });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found for this barcode.' });
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Get product publicly by ID, Barcode, or SKU for Google Lens & public view
// @route GET /api/products/public/:idOrBarcode
const getPublicProduct = async (req, res) => {
  try {
    const raw = (req.params.idOrBarcode || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: 'Invalid barcode or ID' });
    }

    const mongoose = require('mongoose');
    const conditions = [
      { barcode: raw },
      { sku: raw }
    ];

    if (mongoose.Types.ObjectId.isValid(raw)) {
      conditions.unshift({ _id: raw });
    }

    const product = await Product.findOne({
      $or: conditions,
      isActive: true
    }).populate('shopId', 'name mobile address city state pincode gstNumber email logo shopType upiId upiName ownerName');

    if (!product) {
      return res.status(404).json({ success: false, message: 'प्रोडक्ट नहीं मिला (Product not found for this barcode).' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc  Send WhatsApp Broadcast with optional Product Image
// @route POST /api/products/broadcast-whatsapp
const broadcastWhatsApp = async (req, res) => {
  try {
    const { mobile, message, image, filename } = req.body;
    if (!mobile || !message) {
      return res.status(400).json({ success: false, message: 'Mobile and message are required.' });
    }

    const { sendWhatsAppMedia, sendWhatsAppMessage, isWhatsAppReady } = require('../utils/whatsappClient');

    if (!isWhatsAppReady()) {
      return res.json({
        success: false,
        gatewayReady: false,
        message: 'WhatsApp Gateway not connected on server. Falling back to web/app link.'
      });
    }

    let result;
    if (image) {
      result = await sendWhatsAppMedia(mobile, image, filename || 'product_offer.jpg', message);
    } else {
      result = await sendWhatsAppMessage(mobile, message);
    }

    if (result.success) {
      return res.json({
        success: true,
        gatewayReady: true,
        message: 'WhatsApp message sent successfully via server gateway!'
      });
    } else {
      return res.json({
        success: false,
        gatewayReady: true,
        error: result.error,
        message: 'Failed to send via gateway. Falling back to web/app link.'
      });
    }
  } catch (error) {
    console.error('Broadcast WhatsApp Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, adjustStock, bulkRestock, getStockHistory, getByBarcode,
  getPublicProduct, broadcastWhatsApp
};

