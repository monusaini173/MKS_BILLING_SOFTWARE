const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct, updateProduct,
  deleteProduct, adjustStock, bulkRestock, getStockHistory, getByBarcode,
  getPublicProduct, broadcastWhatsApp
} = require('../controllers/productController');
const { protect, requireShop } = require('../middleware/auth');

// Public route for Google Lens & product info preview (No auth required)
router.get('/public/:idOrBarcode', getPublicProduct);

router.use(protect, requireShop);

router.post('/broadcast-whatsapp', broadcastWhatsApp);
router.get('/barcode/:code', getByBarcode);
router.post('/bulk-restock', bulkRestock);
router.route('/').get(getProducts).post(createProduct);
router.route('/:id').get(getProduct).put(updateProduct).delete(deleteProduct);
router.post('/:id/adjust-stock', adjustStock);
router.get('/:id/stock-history', getStockHistory);

module.exports = router;
