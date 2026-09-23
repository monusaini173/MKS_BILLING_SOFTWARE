const express = require('express');
const router = express.Router();
const {
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  getAttendance,
  markAttendance,
  recordAdvance,
  registerStaffFace
} = require('../controllers/staffController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getStaff)
  .post(addStaff);

router.route('/attendance')
  .get(getAttendance)
  .post(markAttendance);

router.route('/:id')
  .put(updateStaff)
  .delete(deleteStaff);

router.route('/:id/advance')
  .post(recordAdvance);

router.route('/:id/face-register')
  .post(registerStaffFace);

module.exports = router;
