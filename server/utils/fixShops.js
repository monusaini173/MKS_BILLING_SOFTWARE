require('dotenv').config();
const mongoose = require('mongoose');
const Shop = require('../models/Shop');

const fix = async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const updates = [
    { email: 'shoes@shop.com', shopType: 'SHOES', name: 'Royal Footwear & Shoe Palace' },
    { email: 'kirana@shop.com', shopType: 'KIRANA', name: 'Shree Ganesh Kirana Store' },
    { email: 'mobile@shop.com', shopType: 'MOBILE', name: 'Galaxy Mobile & Electronics' },
    { email: 'stationery@shop.com', shopType: 'STATIONERY', name: 'Vidya Stationery & Book Depot' },
    { email: 'medical@shop.com', shopType: 'MEDICAL', name: 'Sanjeevani Medical & Pharmacy' },
    { email: 'cosmetics@shop.com', shopType: 'COSMETICS', name: 'Pari Beauty & Cosmetics' },
    { email: 'garments@shop.com', shopType: 'GARMENTS', name: 'MKS Fashion & Garments' },
    { email: 'hardware@shop.com', shopType: 'HARDWARE', name: 'Vishwakarma Hardware & Electricals' },
  ];

  for (const u of updates) {
    await Shop.updateOne({ email: u.email }, { $set: { shopType: u.shopType, name: u.name } });
  }

  const all = await Shop.find().select('name shopType email');
  console.log('✅ Corrected All Shops:');
  console.table(all.map(s => ({ name: s.name, shopType: s.shopType, email: s.email })));
  process.exit(0);
};

fix();
