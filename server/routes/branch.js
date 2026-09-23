const express = require('express');
const router = express.Router();
const { transferStock, getTransfers } = require('../controllers/branchController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect);
router.use(requireShop);

router.post('/transfer-stock', transferStock);
router.get('/transfers', getTransfers);

module.exports = router;
