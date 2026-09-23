const Doctor = require('../models/Doctor');

// GET /api/doctors - Get all doctors for current shop
exports.getDoctors = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = { shopId: req.shopId, isActive: true };
    
    if (search) {
      const regex = { $regex: search, $options: 'i' };
      query.$or = [{ name: regex }, { clinic: regex }, { mobile: regex }, { regNumber: regex }];
    }

    const doctors = await Doctor.find(query).sort({ name: 1 });
    res.json({ success: true, count: doctors.length, data: doctors });
  } catch (error) {
    next(error);
  }
};

// POST /api/doctors - Add a new doctor
exports.createDoctor = async (req, res, next) => {
  try {
    const { name, regNumber, mobile, clinic, specialization, address, email } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Doctor name is required.' });
    }

    const doctor = await Doctor.create({
      shopId: req.shopId,
      name: name.trim(),
      regNumber: regNumber ? regNumber.trim() : '',
      mobile: mobile ? mobile.trim() : '',
      clinic: clinic ? clinic.trim() : '',
      specialization: specialization ? specialization.trim() : '',
      address: address ? address.trim() : '',
      email: email ? email.trim() : '',
    });

    res.status(201).json({ success: true, message: 'Doctor registered successfully.', data: doctor });
  } catch (error) {
    next(error);
  }
};

// PUT /api/doctors/:id - Update doctor details
exports.updateDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    res.json({ success: true, message: 'Doctor details updated.', data: doctor });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/doctors/:id - Soft delete doctor
exports.deleteDoctor = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOneAndUpdate(
      { _id: req.params.id, shopId: req.shopId },
      { isActive: false },
      { new: true }
    );

    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }

    res.json({ success: true, message: 'Doctor removed.' });
  } catch (error) {
    next(error);
  }
};
