const express = require('express');
const router = express.Router();
const { createSale, getSales, getSale, updateSale, saleReturn, receivePayment, generateSalePDF } = require('../controllers/saleController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

router.route('/').get(getSales).post(createSale);
router.get('/:id/pdf', generateSalePDF);
router.route('/:id').get(getSale).put(updateSale);
router.post('/:id/return', saleReturn);
router.post('/:id/receive-payment', receivePayment);

module.exports = router;
