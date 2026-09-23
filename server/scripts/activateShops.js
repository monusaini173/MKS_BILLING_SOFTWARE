const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const Shop = require('../models/Shop');
const User = require('../models/User');

async function activateAll() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const shopRes = await Shop.updateMany({}, { $set: { isActive: true } });
  const userRes = await User.updateMany({}, { 
    $set: { 
      isActive: true, 
      failedLoginAttempts: 0, 
      loginLockedUntil: null,
      failedPinAttempts: 0,
      pinLockedUntil: null
    } 
  });

  console.log('Shops activated:', shopRes.modifiedCount);
  console.log('Users activated and unlocked:', userRes.modifiedCount);

  // Link shops without owner or mismatched owner
  const shops = await Shop.find();
  for (const shop of shops) {
    const user = await User.findOne({ shopId: shop._id });
    if (user && String(shop.owner) !== String(user._id)) {
      shop.owner = user._id;
      shop.ownerName = user.name;
      await shop.save();
      console.log(`Updated shop ${shop.name} owner to ${user.name}`);
    }
  }

  console.log('All shops verified and active!');
  process.exit(0);
}

activateAll().catch(err => {
  console.error(err);
  process.exit(1);
});
