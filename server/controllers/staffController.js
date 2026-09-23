const Staff = require('../models/Staff');
const Attendance = require('../models/Attendance');

// @desc    Get all staff members for current shop
// @route   GET /api/staff
exports.getStaff = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const staffList = await Staff.find({ shop: shopId }).sort({ createdAt: -1 });
    res.json({ success: true, count: staffList.length, data: staffList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Add new staff member
// @route   POST /api/staff
exports.addStaff = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { name, mobile, designation, salaryType, salaryAmount, joiningDate, address } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'कर्मचारी का नाम और मोबाइल नंबर आवश्यक है।' });
    }

    const staff = await Staff.create({
      shop: shopId,
      name,
      mobile,
      designation: designation || 'Staff',
      salaryType: salaryType || 'MONTHLY',
      salaryAmount: Number(salaryAmount) || 0,
      joiningDate: joiningDate || Date.now(),
      address
    });

    res.status(201).json({ success: true, message: 'कर्मचारी सफलतापूर्वक जोड़ा गया।', data: staff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Update staff member
// @route   PUT /api/staff/:id
exports.updateStaff = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, shop: shopId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!staff) {
      return res.status(404).json({ success: false, message: 'कर्मचारी नहीं मिला।' });
    }

    res.json({ success: true, message: 'विवरण अपडेट हो गया।', data: staff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Delete staff member
// @route   DELETE /api/staff/:id
exports.deleteStaff = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const staff = await Staff.findOneAndDelete({ _id: req.params.id, shop: shopId });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'कर्मचारी नहीं मिला।' });
    }

    // Also clean up attendance
    await Attendance.deleteMany({ staff: req.params.id });

    res.json({ success: true, message: 'कर्मचारी हटा दिया गया।' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Get attendance for a specific date or month
// @route   GET /api/staff/attendance
exports.getAttendance = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { date, month, year } = req.query;

    let filter = { shop: shopId };
    if (date) {
      filter.date = date; // 'YYYY-MM-DD'
    } else if (month && year) {
      const regex = new RegExp(`^${year}-${String(month).padStart(2, '0')}`);
      filter.date = { $regex: regex };
    }

    const attendanceRecords = await Attendance.find(filter).populate('staff', 'name mobile designation salaryAmount salaryType');
    res.json({ success: true, count: attendanceRecords.length, data: attendanceRecords });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Mark / Update attendance for staff member
// @route   POST /api/staff/attendance
exports.markAttendance = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { staffId, date, status, notes, inTime, outTime, selfiePhoto } = req.body;

    if (!staffId || !date) {
      return res.status(400).json({ success: false, message: 'Staff ID and date are required.' });
    }

    const updateDoc = {
      shop: shopId,
      staff: staffId,
      date,
      status: status || 'PRESENT',
      notes,
      inTime: inTime || new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      outTime
    };

    if (selfiePhoto) {
      updateDoc.selfiePhoto = selfiePhoto;
    }

    const record = await Attendance.findOneAndUpdate(
      { shop: shopId, staff: staffId, date },
      updateDoc,
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'हाजिरी व सेल्फी सफलतापूर्वक दर्ज की गई।', data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Record Advance Payment given to Staff
// @route   POST /api/staff/:id/advance
exports.recordAdvance = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { amount, notes, date } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'वैध राशि दर्ज करें।' });
    }

    const staff = await Staff.findOne({ _id: req.params.id, shop: shopId });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'कर्मचारी नहीं मिला।' });
    }

    staff.advances.push({
      amount: Number(amount),
      notes: notes || 'Advance payment',
      date: date || new Date()
    });

    await staff.save();
    res.json({ success: true, message: `₹${amount} एडवांस सफलतापूर्वक दर्ज किया गया।`, data: staff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc    Register Staff Face Biometrics (reference face for matching)
// @route   POST /api/staff/:id/face-register
exports.registerStaffFace = async (req, res) => {
  try {
    const shopId = req.user.shopId;
    const { faceDescriptor, facePhoto } = req.body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      return res.status(400).json({ success: false, message: 'वैध फेस बायोमेट्रिक्स आवश्यक है।' });
    }

    const staff = await Staff.findOne({ _id: req.params.id, shop: shopId });
    if (!staff) {
      return res.status(404).json({ success: false, message: 'कर्मचारी नहीं मिला।' });
    }

    staff.faceDescriptor = faceDescriptor;
    if (facePhoto) staff.facePhoto = facePhoto;
    staff.isFaceRegistered = true;

    await staff.save();
    res.json({ success: true, message: 'कर्मचारी का चेहरा सफलतापूर्वक रजिस्टर कर दिया गया।', data: staff });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
