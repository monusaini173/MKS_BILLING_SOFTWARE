const express = require('express');
const router = express.Router();
const { createPurchase, getPurchases, getPurchase, purchaseReturn, paySupplier } = require('../controllers/purchaseController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

router.route('/').get(getPurchases).post(createPurchase);
router.route('/:id').get(getPurchase);
router.post('/:id/return', purchaseReturn);
router.post('/:id/pay', paySupplier);

module.exports = router;
