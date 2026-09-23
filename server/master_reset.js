require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function masterResetCli() {
  const args = process.argv.slice(2);
  const identifier = args[0] || 'admin@mksbilling.com';
  const newPassword = args[1] || 'admin123';

  console.log('🔄 MKS Billing Master Password Reset Tool');
  console.log('------------------------------------------');
  console.log(`Target Identifier: ${identifier}`);
  console.log(`New Password:      ${newPassword}`);

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mks_billing');

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  let targetFilter = {};
  if (identifier.toUpperCase() === 'ALL') {
    targetFilter = {};
  } else {
    targetFilter = {
      $or: [
        { email: identifier.toLowerCase().trim() },
        { mobile: identifier.trim() }
      ]
    };
  }

  const res = await User.updateMany(targetFilter, {
    password: hashedPassword,
    isActive: true,
    failedLoginAttempts: 0,
    loginLockedUntil: null,
    failedPinAttempts: 0,
    pinLockedUntil: null,
    failedOtpAttempts: 0,
    otpLockedUntil: null
  });

  if (res.matchedCount === 0) {
    console.log(`❌ No user account matched '${identifier}'.`);
  } else {
    console.log(`✅ Success! Updated ${res.modifiedCount} user(s).`);
    console.log(`🔑 Master Reset Code: MKS9950`);
    console.log(`🔐 New Password: ${newPassword}`);
  }

  process.exit(0);
}

masterResetCli();
