const express = require('express');
const router = express.Router();
const { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier, getSupplierHistory, paySupplier, addSupplierDue } = require('../controllers/supplierController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

router.route('/').get(getSuppliers).post(createSupplier);
router.route('/:id').get(getSupplier).put(updateSupplier).delete(deleteSupplier);
router.get('/:id/history', getSupplierHistory);
router.post('/:id/pay', paySupplier);
router.post('/:id/add-due', addSupplierDue);

module.exports = router;
