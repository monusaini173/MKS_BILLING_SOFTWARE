const express = require('express');
const router = express.Router();
const { getCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer, getCustomerHistory, receivePayment, lookupCustomer } = require('../controllers/customerController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

router.get('/lookup', lookupCustomer);
router.route('/').get(getCustomers).post(createCustomer);
router.route('/:id').get(getCustomer).put(updateCustomer).delete(deleteCustomer);
router.get('/:id/history', getCustomerHistory);
router.post('/:id/receive-payment', receivePayment);

module.exports = router;
