const express = require('express');
const router = express.Router();
const { protect, requireShop } = require('../middleware/auth');
const { getDoctors, createDoctor, updateDoctor, deleteDoctor } = require('../controllers/doctorController');

router.use(protect, requireShop);

router.route('/')
  .get(getDoctors)
  .post(createDoctor);

router.route('/:id')
  .put(updateDoctor)
  .delete(deleteDoctor);

module.exports = router;
