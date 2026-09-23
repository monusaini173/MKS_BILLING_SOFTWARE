const express = require('express');
const router = express.Router();
const {
  createDocument,
  getDocuments,
  getDocument,
  updateDocumentStatus,
  convertDocument,
  deleteDocument
} = require('../controllers/documentController');
const { protect, requireShop } = require('../middleware/auth');

router.use(protect, requireShop);

router.route('/')
  .get(getDocuments)
  .post(createDocument);

router.route('/:id')
  .get(getDocument)
  .delete(deleteDocument);

router.patch('/:id/status', updateDocumentStatus);
router.post('/:id/convert', convertDocument);

module.exports = router;
