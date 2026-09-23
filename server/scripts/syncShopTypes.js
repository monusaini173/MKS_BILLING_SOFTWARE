require('dotenv').config();
const mongoose = require('mongoose');
const ShopType = require('../models/ShopType');

const DEFAULTS = [
  { key: 'KIRANA', label: 'Kirana & Grocery', labelHindi: 'किराना व जनरल स्टोर', emoji: '🛒', icon: 'fa-solid fa-basket-shopping', accentColor: '#10b981', accentBg: '#ecfdf5', defaultCategories: ['दाल व अनाज', 'तेल व घी', 'मसाले', 'बिस्कुट व स्नैक्स', 'चाय व चीनी', 'साबुन व सर्फ'], isSystem: true },
  { key: 'GARMENTS', label: 'Garments & Clothing', labelHindi: 'कपड़ा व गारमेंट्स', emoji: '👕', icon: 'fa-solid fa-shirt', accentColor: '#f59e0b', accentBg: '#fffbeb', defaultCategories: ['शर्ट व टी-शर्ट', 'जींस व पैंट', 'कुर्ती व सूट', 'साड़ी व लहंगा', 'किड्स वियर', 'इनरवियर'], isSystem: true },
  { key: 'SHOES', label: 'Footwear & Shoes', labelHindi: 'जूते व चप्पल', emoji: '👟', icon: 'fa-solid fa-shoe-prints', accentColor: '#3b82f6', accentBg: '#eff6ff', defaultCategories: ['मेंस शूज़', 'लेडीज सैंडल', 'स्लीपर्स व चप्पल', 'स्पोर्ट्स शूज़', 'किड्स फुटवियर', 'फॉर्मल शूज़'], isSystem: true },
  { key: 'MOBILE', label: 'Mobile & Electronics', labelHindi: 'मोबाइल व इलेक्ट्रॉनिक्स', emoji: '📱', icon: 'fa-solid fa-mobile-screen', accentColor: '#8b5cf6', accentBg: '#f5f3ff', defaultCategories: ['स्मार्टफोन', 'ईयरफोन व बड्स', 'चार्जर व केबल', 'कवर व ग्लास', 'स्मार्टवॉच', 'रिपेयरिंग'], isSystem: true },
  { key: 'MEDICAL', label: 'Medical & Pharmacy', labelHindi: 'दवा व मेडिकल स्टोर', emoji: '💊', icon: 'fa-solid fa-pills', accentColor: '#ef4444', accentBg: '#fef2f2', defaultCategories: ['टैबलेट्स व दवा', 'सिरप', 'एंटीबायोटिक्स', 'पेनकिलर', 'फर्स्ट एड व बैंडेज', 'बेबी केयर'], isSystem: true },
  { key: 'COSMETICS', label: 'Cosmetics & Beauty', labelHindi: 'कॉस्मेटिक्स व ब्यूटी', emoji: '💄', icon: 'fa-solid fa-wand-magic-sparkles', accentColor: '#ec4899', accentBg: '#fdf2f8', defaultCategories: ['मेकअप किट', 'लिपस्टिक व नेलपॉलिश', 'स्किन केयर', 'हेयर केयर', 'परफ्यूम व डियो', 'फेस वॉश'], isSystem: true },
  { key: 'STATIONERY', label: 'Stationery & Books', labelHindi: 'स्टेशनरी व बुक स्टोर', emoji: '📚', icon: 'fa-solid fa-book', accentColor: '#14b8a6', accentBg: '#f0fdfa', defaultCategories: ['नोटबुक व रजिस्टर', 'पेन व पेंसिल', 'ड्राइंग व कलर्स', 'फाइल्स व फोल्डर', 'स्कूल बैग', 'ऑफिस स्टेशनरी'], isSystem: true },
  { key: 'HARDWARE', label: 'Hardware & Sanitary', labelHindi: 'हार्डवेयर व सेनेटरी', emoji: '🔧', icon: 'fa-solid fa-wrench', accentColor: '#64748b', accentBg: '#f8fafc', defaultCategories: ['पाइप व फिटिंग्स', 'पेंट्स व ब्रश', 'टूल्स व औजार', 'कील व नट-बोल्ट', 'बिजली का सामान', 'सेनेटरी'], isSystem: true }
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const d of DEFAULTS) {
    await ShopType.findOneAndUpdate({ key: d.key }, { $set: d }, { upsert: true });
  }
  console.log('✅ CLEAN CATEGORIES SYNCED TO DB!');
  process.exit(0);
}

run();
