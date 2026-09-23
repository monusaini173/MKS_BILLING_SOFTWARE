const Shop = require('../models/Shop');
const Product = require('../models/Product');
const StockTransfer = require('../models/StockTransfer');
const StockTransaction = require('../models/StockTransaction');

// @desc   Execute Inter-Branch Stock Transfer
// @route  POST /api/branches/transfer-stock
const transferStock = async (req, res) => {
  try {
    const { toShopId, items, remarks } = req.body;
    const fromShopId = req.shopId;

    if (!toShopId) {
      return res.status(400).json({ success: false, message: 'कृपया प्राप्तकर्ता शाखा (Destination Branch) चुनें।' });
    }

    if (String(fromShopId) === String(toShopId)) {
      return res.status(400).json({ success: false, message: 'सामान उसी शाखा में ट्रांसफर नहीं किया जा सकता।' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'कृपया ट्रांसफर करने के लिए कम से कम 1 आइटम चुनें।' });
    }

    const fromShop = await Shop.findById(fromShopId);
    const toShop = await Shop.findById(toShopId);

    if (!fromShop || !toShop) {
      return res.status(404).json({ success: false, message: 'शाखा की जानकारी नहीं मिली।' });
    }

    // Verify ownership or access
    if (req.user.role !== 'SUPER_ADMIN') {
      const isFromOwner = String(fromShop.owner) === String(req.user._id);
      const isToOwner = String(toShop.owner) === String(req.user._id);
      if (!isFromOwner || !isToOwner) {
        return res.status(403).json({ success: false, message: 'आपको इन दोनों शाखाओं के बीच ट्रांसफर की अनुमति नहीं है।' });
      }
    }

    const transferItems = [];
    let totalQty = 0;

    for (const item of items) {
      const { productId, quantity } = item;
      const transferQty = Number(quantity);

      if (!transferQty || transferQty <= 0) continue;

      const sourceProduct = await Product.findOne({ _id: productId, shopId: fromShopId });
      if (!sourceProduct) {
        return res.status(404).json({ success: false, message: `प्रोडक्ट ID '${productId}' नहीं मिला।` });
      }

      const availableQty = sourceProduct.quantity || 0;
      if (availableQty < transferQty) {
        return res.status(400).json({
          success: false,
          message: `पर्याप्त स्टॉक नहीं है: '${sourceProduct.name}' में केवल ${availableQty} उपलब्ध है, जबकि आप ${transferQty} ट्रांसफर कर रहे हैं।`
        });
      }

      // Deduct from source
      sourceProduct.quantity = availableQty - transferQty;
      await sourceProduct.save();

      // Find or create in destination shop
      let destProduct = null;
      if (sourceProduct.barcode) {
        destProduct = await Product.findOne({ shopId: toShopId, barcode: sourceProduct.barcode });
      }
      if (!destProduct) {
        destProduct = await Product.findOne({ shopId: toShopId, name: sourceProduct.name });
      }

      if (destProduct) {
        destProduct.quantity = (destProduct.quantity || 0) + transferQty;
        await destProduct.save();
      } else {
        // Clone product into target shop
        destProduct = await Product.create({
          shopId: toShopId,
          shopType: toShop.shopType || sourceProduct.shopType || 'GARMENTS',
          name: sourceProduct.name,
          barcode: sourceProduct.barcode,
          hsnCode: sourceProduct.hsnCode,
          category: sourceProduct.category,
          brand: sourceProduct.brand,
          unit: sourceProduct.unit || 'PCS',
          purchasePrice: sourceProduct.purchasePrice || 0,
          sellingPrice: sourceProduct.sellingPrice || sourceProduct.mrp || 0,
          mrp: sourceProduct.mrp || 0,
          gstPercent: sourceProduct.gstPercent || 0,
          quantity: transferQty,
          minStockLevel: sourceProduct.minStockLevel || 5,
          isActive: true
        });
      }

      // Record Stock Transaction for fromShop (OUT)
      await StockTransaction.create({
        shop: fromShopId,
        product: sourceProduct._id,
        type: 'ADJUSTMENT_DECREASE',
        quantity: transferQty,
        balanceAfter: sourceProduct.quantity,
        referenceModel: 'Shop',
        referenceId: toShopId,
        notes: `Inter-branch transfer to ${toShop.name} (${toShop.branchName || 'Branch'})`
      });

      // Record Stock Transaction for toShop (IN)
      await StockTransaction.create({
        shop: toShopId,
        product: destProduct._id,
        type: 'ADJUSTMENT_INCREASE',
        quantity: transferQty,
        balanceAfter: destProduct.quantity,
        referenceModel: 'Shop',
        referenceId: fromShopId,
        notes: `Inter-branch transfer from ${fromShop.name} (${fromShop.branchName || 'Branch'})`
      });

      transferItems.push({
        product: sourceProduct._id,
        name: sourceProduct.name,
        barcode: sourceProduct.barcode || '',
        quantity: transferQty,
        unit: sourceProduct.unit || 'PCS',
        purchasePrice: sourceProduct.purchasePrice || 0,
        salePrice: sourceProduct.sellingPrice || 0,
        mrp: sourceProduct.mrp || 0
      });

      totalQty += transferQty;
    }

    if (transferItems.length === 0) {
      return res.status(400).json({ success: false, message: 'कोई वैध आइटम ट्रांसफर नहीं किया गया।' });
    }

    const transferCount = await StockTransfer.countDocuments({ fromShop: fromShopId });
    const transferNumber = `TRF-${fromShop.branchCode || 'BR'}-${Date.now().toString().slice(-4)}${transferCount + 1}`;

    const stockTransfer = await StockTransfer.create({
      transferNumber,
      fromShop: fromShopId,
      toShop: toShopId,
      fromShopName: `${fromShop.name} (${fromShop.branchName || 'Main'})`,
      toShopName: `${toShop.name} (${toShop.branchName || 'Branch'})`,
      items: transferItems,
      totalItems: transferItems.length,
      totalQuantity: totalQty,
      transferredBy: req.user._id,
      transferredByName: req.user.name,
      status: 'COMPLETED',
      remarks: remarks || 'Inter-branch inventory transfer',
      transferDate: new Date()
    });

    res.status(201).json({
      success: true,
      message: `🎉 स्टॉक ट्रांसफर सफल! कुल ${totalQty} आइटम '${toShop.name}' में ट्रांसफर कर दिए गए हैं।`,
      data: stockTransfer
    });
  } catch (error) {
    console.error('Stock Transfer Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc   Get All Stock Transfers
// @route  GET /api/branches/transfers
const getTransfers = async (req, res) => {
  try {
    const transfers = await StockTransfer.find({
      $or: [{ fromShop: req.shopId }, { toShop: req.shopId }]
    }).sort({ createdAt: -1 }).limit(50);

    res.json({ success: true, data: transfers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  transferStock,
  getTransfers
};
