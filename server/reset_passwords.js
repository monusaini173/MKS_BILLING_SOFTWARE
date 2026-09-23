require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function resetPasswords() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mks_billing');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);
  
  const res = await User.updateMany({}, {
    password: hashedPassword,
    isActive: true,
    failedLoginAttempts: 0,
    loginLockedUntil: null
  });
  
  console.log('✅ Updated all users passwords to: admin123');
  console.log('Modified count:', res.modifiedCount);
  
  const users = await User.find({}).select('name email mobile role shopId');
  console.log('\n--- AVAILABLE LOGIN ACCOUNTS (Password: admin123) ---');
  users.forEach(u => {
    console.log(`• Name: ${u.name.padEnd(20)} | Email: ${u.email.padEnd(24)} | Mobile: ${u.mobile} | Role: ${u.role}`);
  });
  
  process.exit(0);
}

resetPasswords();
