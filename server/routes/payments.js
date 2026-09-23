const express = require('express');
const router = express.Router();
const { getPayments, getPaymentById, recordPayment } = require('../controllers/paymentController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

router.route('/')
  .get(getPayments)
  .post(recordPayment);

router.route('/:id')
  .get(getPaymentById);

module.exports = router;
