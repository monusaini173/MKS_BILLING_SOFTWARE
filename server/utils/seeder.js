require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Shop = require('../models/Shop');
const Settings = require('../models/Settings');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Customer = require('../models/Customer');

const SHOPS_DATA = [
  {
    shopName: 'Shree Ganesh Kirana Store',
    shopType: 'KIRANA',
    ownerName: 'Ramesh Kirana',
    email: 'kirana@shop.com',
    password: 'password123',
    mobile: '9876500001',
    city: 'Jaipur',
    state: 'Rajasthan',
    categories: ['Grocery & Staples', 'Beverages', 'Personal Care', 'Spices & Masala'],
    products: [
      { name: 'Fortune Refined Oil 1L', category: 'Grocery & Staples', purchasePrice: 120, sellingPrice: 145, mrp: 160, quantity: 100, unit: 'LTR', barcode: 'KIR001', sku: 'OIL-1L' },
      { name: 'Aashirvaad Shudh Chakki Atta 5kg', category: 'Grocery & Staples', purchasePrice: 190, sellingPrice: 225, mrp: 250, quantity: 60, unit: 'KG', barcode: 'KIR002', sku: 'ATTA-5KG' },
      { name: 'India Gate Basmati Rice 5kg', category: 'Grocery & Staples', purchasePrice: 380, sellingPrice: 450, mrp: 500, quantity: 40, unit: 'KG', barcode: 'KIR003', sku: 'RICE-5KG' },
      { name: 'Tata Tea Premium 500g', category: 'Beverages', purchasePrice: 220, sellingPrice: 260, mrp: 290, quantity: 50, unit: 'PCS', barcode: 'KIR004', sku: 'TEA-500G' },
      { name: 'Colgate MaxFresh 150g', category: 'Personal Care', purchasePrice: 75, sellingPrice: 95, mrp: 110, quantity: 80, unit: 'PCS', barcode: 'KIR005', sku: 'PASTE-150G' },
      { name: 'MDH Garam Masala 100g', category: 'Spices & Masala', purchasePrice: 60, sellingPrice: 78, mrp: 88, quantity: 90, unit: 'PCS', barcode: 'KIR006', sku: 'MDH-100G' }
    ]
  },
  {
    shopName: 'Vidya Stationery & Book Depot',
    shopType: 'STATIONERY',
    ownerName: 'Suresh Sharma',
    email: 'stationery@shop.com',
    password: 'password123',
    mobile: '9876500002',
    city: 'Jaipur',
    state: 'Rajasthan',
    categories: ['Notebooks & Registers', 'Pens & Writing', 'Office Supplies', 'Art & Craft'],
    products: [
      { name: 'Classmate Long Notebook 180 Pgs', category: 'Notebooks & Registers', purchasePrice: 40, sellingPrice: 55, mrp: 60, quantity: 150, unit: 'PCS', barcode: 'STN001', sku: 'NOTE-180' },
      { name: 'Reynolds 045 Fine Ball Pen (Pack of 5)', category: 'Pens & Writing', purchasePrice: 35, sellingPrice: 50, mrp: 50, quantity: 200, unit: 'PACK', barcode: 'STN002', sku: 'PEN-045' },
      { name: 'Camlin Geometry Box Deluxe', category: 'Office Supplies', purchasePrice: 80, sellingPrice: 110, mrp: 125, quantity: 45, unit: 'PCS', barcode: 'STN003', sku: 'GEO-BOX' },
      { name: 'Doms Water Colour 12 Shades', category: 'Art & Craft', purchasePrice: 65, sellingPrice: 90, mrp: 100, quantity: 60, unit: 'PCS', barcode: 'STN004', sku: 'DOMS-CLR' },
      { name: 'JK Copier A4 Paper 75 GSM (500 Sheets)', category: 'Office Supplies', purchasePrice: 240, sellingPrice: 290, mrp: 340, quantity: 30, unit: 'REAM', barcode: 'STN005', sku: 'A4-REAM' }
    ]
  },
  {
    shopName: 'Royal Footwear & Shoe Palace',
    shopType: 'SHOES',
    ownerName: 'Anil Verma',
    email: 'shoes@shop.com',
    password: 'password123',
    mobile: '9876500003',
    city: 'Delhi',
    state: 'Delhi',
    categories: ['Sports Shoes', 'Formal Shoes', 'Casual Shoes', 'Sandals & Slippers'],
    products: [
      { name: 'Campus Running Shoes Nitro (Size 8)', category: 'Sports Shoes', purchasePrice: 850, sellingPrice: 1299, mrp: 1599, quantity: 20, unit: 'PAIR', barcode: 'SHO001', sku: 'CAMP-N8', size: '8', color: 'Black' },
      { name: 'Campus Running Shoes Nitro (Size 9)', category: 'Sports Shoes', purchasePrice: 850, sellingPrice: 1299, mrp: 1599, quantity: 15, unit: 'PAIR', barcode: 'SHO002', sku: 'CAMP-N9', size: '9', color: 'Black' },
      { name: 'Bata Men Leather Formal Oxford (Size 8)', category: 'Formal Shoes', purchasePrice: 1100, sellingPrice: 1699, mrp: 1999, quantity: 12, unit: 'PAIR', barcode: 'SHO003', sku: 'BATA-F8', size: '8', color: 'Brown' },
      { name: 'Sparx Casual Sneakers White (Size 8)', category: 'Casual Shoes', purchasePrice: 650, sellingPrice: 999, mrp: 1199, quantity: 25, unit: 'PAIR', barcode: 'SHO004', sku: 'SPX-W8', size: '8', color: 'White' },
      { name: 'Relaxo Bahamas Hawaii Slippers (Size 7)', category: 'Sandals & Slippers', purchasePrice: 110, sellingPrice: 160, mrp: 180, quantity: 50, unit: 'PAIR', barcode: 'SHO005', sku: 'RLX-S7', size: '7', color: 'Blue' }
    ]
  },
  {
    shopName: 'Galaxy Mobile & Electronics',
    shopType: 'MOBILE',
    ownerName: 'Vikram Singh',
    email: 'mobile@shop.com',
    password: 'password123',
    mobile: '9876500004',
    city: 'Mumbai',
    state: 'Maharashtra',
    categories: ['Smartphones', 'Mobile Accessories', 'Audio & Headphones', 'Power & Cables'],
    products: [
      { name: 'Redmi 13C 5G (4GB RAM, 128GB)', category: 'Smartphones', purchasePrice: 8999, sellingPrice: 10499, mrp: 11999, quantity: 10, unit: 'PCS', barcode: 'MOB001', sku: 'RED-13C', ram: '4GB', storage: '128GB' },
      { name: 'Realme Narzo 60x 5G (6GB/128GB)', category: 'Smartphones', purchasePrice: 11200, sellingPrice: 12999, mrp: 14499, quantity: 8, unit: 'PCS', barcode: 'MOB002', sku: 'RLM-60X', ram: '6GB', storage: '128GB' },
      { name: 'boAt Rockerz 255 Pro+ Wireless Neckband', category: 'Audio & Headphones', purchasePrice: 750, sellingPrice: 1199, mrp: 1499, quantity: 30, unit: 'PCS', barcode: 'MOB003', sku: 'BOAT-255' },
      { name: 'Mi 33W Fast Wall Charger Type-C', category: 'Power & Cables', purchasePrice: 420, sellingPrice: 699, mrp: 899, quantity: 40, unit: 'PCS', barcode: 'MOB004', sku: 'MI-33W' }
    ]
  },
  {
    shopName: 'Sanjeevani Medical & Pharmacy',
    shopType: 'MEDICAL',
    ownerName: 'Dr. Alok Gupta',
    email: 'medical@shop.com',
    password: 'password123',
    mobile: '9876500005',
    city: 'Ahmedabad',
    state: 'Gujarat',
    categories: ['Medicines & Tablets', 'Syrups & Liquids', 'First Aid & Surgical', 'Health Supplements'],
    products: [
      { name: 'Dolo 650mg Paracetamol (Strip of 15)', category: 'Medicines & Tablets', purchasePrice: 22, sellingPrice: 31, mrp: 34, quantity: 200, unit: 'STRIP', barcode: 'MED001', sku: 'DOLO-650', company: 'Micro Labs' },
      { name: 'Pan 40mg Pantoprazole (Strip of 15)', category: 'Medicines & Tablets', purchasePrice: 95, sellingPrice: 135, mrp: 155, quantity: 80, unit: 'STRIP', barcode: 'MED002', sku: 'PAN-40', company: 'Alkem' },
      { name: 'Benadryl Cough Syrup 100ml', category: 'Syrups & Liquids', purchasePrice: 82, sellingPrice: 115, mrp: 130, quantity: 45, unit: 'BOTTLE', barcode: 'MED003', sku: 'BND-100', company: 'J&J' },
      { name: 'Dettol Antiseptic Liquid 250ml', category: 'First Aid & Surgical', purchasePrice: 110, sellingPrice: 140, mrp: 155, quantity: 50, unit: 'BOTTLE', barcode: 'MED004', sku: 'DET-250' },
      { name: 'Revital H Daily Multivitamin (30 Caps)', category: 'Health Supplements', purchasePrice: 220, sellingPrice: 295, mrp: 340, quantity: 35, unit: 'BOTTLE', barcode: 'MED005', sku: 'REV-30', company: 'Sun Pharma' }
    ]
  },
  {
    shopName: 'Pari Beauty & Cosmetics',
    shopType: 'COSMETICS',
    ownerName: 'Pooja Jain',
    email: 'cosmetics@shop.com',
    password: 'password123',
    mobile: '9876500006',
    city: 'Indore',
    state: 'Madhya Pradesh',
    categories: ['Skin Care', 'Hair Care', 'Makeup & Lips', 'Fragrances & Perfumes'],
    products: [
      { name: 'Lakme Eyeconic Kajal Deep Black', category: 'Makeup & Lips', purchasePrice: 130, sellingPrice: 185, mrp: 210, quantity: 70, unit: 'PCS', barcode: 'COS001', sku: 'LAK-KAJ' },
      { name: 'Maybelline New York Liquid Matte Lipstick', category: 'Makeup & Lips', purchasePrice: 380, sellingPrice: 520, mrp: 650, quantity: 40, unit: 'PCS', barcode: 'COS002', sku: 'MAY-LIP', shade: 'SuperStay Matte' },
      { name: 'Nivea Soft Light Moisturizer 200ml', category: 'Skin Care', purchasePrice: 180, sellingPrice: 245, mrp: 280, quantity: 50, unit: 'PCS', barcode: 'COS003', sku: 'NIV-200' },
      { name: 'Fogg Scent Xtremo Eau De Parfum 100ml', category: 'Fragrances & Perfumes', purchasePrice: 320, sellingPrice: 440, mrp: 500, quantity: 30, unit: 'BOTTLE', barcode: 'COS004', sku: 'FOGG-XTR' }
    ]
  },
  {
    shopName: 'MKS Fashion & Garments',
    shopType: 'GARMENTS',
    ownerName: 'Deepak Agarwal',
    email: 'garments@shop.com',
    password: 'password123',
    mobile: '9876500007',
    city: 'Surat',
    state: 'Gujarat',
    categories: ['Shirts & Tops', 'Jeans & Trousers', 'T-Shirts', 'Ethnic Wear'],
    products: [
      { name: 'Men Cotton Slim Fit Formal Shirt (L)', category: 'Shirts & Tops', purchasePrice: 420, sellingPrice: 799, mrp: 999, quantity: 30, unit: 'PCS', barcode: 'GAR001', sku: 'SHIRT-L', size: 'L', color: 'White' },
      { name: 'Men Denim Stretch Jeans Blue (32)', category: 'Jeans & Trousers', purchasePrice: 550, sellingPrice: 1099, mrp: 1399, quantity: 25, unit: 'PCS', barcode: 'GAR002', sku: 'JEAN-32', size: '32', color: 'Blue' },
      { name: 'Round Neck Casual Cotton T-Shirt (M)', category: 'T-Shirts', purchasePrice: 180, sellingPrice: 399, mrp: 499, quantity: 50, unit: 'PCS', barcode: 'GAR003', sku: 'TSHIRT-M', size: 'M', color: 'Black' }
    ]
  },
  {
    shopName: 'Vishwakarma Hardware & Electricals',
    shopType: 'HARDWARE',
    ownerName: 'Manoj Suthar',
    email: 'hardware@shop.com',
    password: 'password123',
    mobile: '9876500008',
    city: 'Jodhpur',
    state: 'Rajasthan',
    categories: ['Plumbing & Pipes', 'Electricals & Wires', 'Tools & Machinery', 'Paints & Finishes'],
    products: [
      { name: 'Havells 1.5 Sq mm Copper Wire (90m Roll)', category: 'Electricals & Wires', purchasePrice: 1450, sellingPrice: 1850, mrp: 2100, quantity: 20, unit: 'ROLL', barcode: 'HDW001', sku: 'HAV-1.5' },
      { name: 'Supreme PVC Pipe 1 inch (10 ft)', category: 'Plumbing & Pipes', purchasePrice: 180, sellingPrice: 250, mrp: 280, quantity: 40, unit: 'PCS', barcode: 'HDW002', sku: 'SUP-1IN' },
      { name: 'Bosch Professional Impact Drill Machine 500W', category: 'Tools & Machinery', purchasePrice: 1950, sellingPrice: 2599, mrp: 2999, quantity: 10, unit: 'PCS', barcode: 'HDW003', sku: 'BSH-500' },
      { name: 'Asian Paints Apex Exterior Emulsion 4L', category: 'Paints & Finishes', purchasePrice: 820, sellingPrice: 1050, mrp: 1200, quantity: 15, unit: 'BUCKET', barcode: 'HDW004', sku: 'APX-4L' }
    ]
  }
];

const seedAllShops = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB Connected.');

    console.log('\n-----------------------------------------------');
    console.log('Creating 8 Separate Shop Accounts with Isolated Login IDs');
    console.log('-----------------------------------------------\n');

    for (const data of SHOPS_DATA) {
      let user = await User.findOne({ email: data.email });

      if (!user) {
        const userId = new mongoose.Types.ObjectId();
        const shopId = new mongoose.Types.ObjectId();

        const shop = await Shop.create({
          _id: shopId,
          name: data.shopName,
          shopType: data.shopType,
          ownerName: data.ownerName,
          mobile: data.mobile,
          email: data.email,
          city: data.city,
          state: data.state,
          isGSTRegistered: true,
          gstin: '08AAAAA' + Math.floor(1000 + Math.random() * 9000) + 'A1Z5',
          owner: userId,
        });

        user = await User.create({
          _id: userId,
          name: data.ownerName,
          email: data.email,
          mobile: data.mobile,
          password: data.password,
          role: 'SHOP_OWNER',
          shopId: shop._id,
          isActive: true,
        });

        await Settings.create({
          shopId: shop._id,
          isGSTRegistered: true,
        });

        console.log(`✨ Created Shop: ${data.shopName} (${data.shopType})`);
        console.log(`   👤 Login ID: ${data.email} | Pass: ${data.password}`);

        // Create categories & products
        const catMap = {};
        for (const catName of data.categories) {
          const cat = await Category.create({
            shopId: shop._id,
            name: catName,
            shopType: data.shopType
          });
          catMap[catName] = cat._id;
        }

        for (const prod of data.products) {
          await Product.create({
            ...prod,
            shopId: shop._id,
            shopType: data.shopType,
            categoryId: catMap[prod.category] || null,
            purchasePrice: prod.purchasePrice || 0,
            sellingPrice: prod.sellingPrice || 100,
            mrp: prod.mrp || prod.sellingPrice,
            gstPercent: 18,
            gstInclusive: true,
            isActive: true
          });
        }
        console.log(`   📦 Seeded ${data.products.length} products & ${data.categories.length} categories.`);
      } else {
        console.log(`ℹ️ Shop already exists: ${data.email}`);
      }
    }

    console.log('\n=============================================================');
    console.log('🎉 All Shop Accounts Ready with 100% Data Isolation!');
    console.log('=============================================================');
    SHOPS_DATA.forEach(s => {
      console.log(`[${s.shopType.padEnd(11)}] Email: ${s.email.padEnd(22)} Password: ${s.password} (${s.shopName})`);
    });
    console.log('=============================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
};

seedAllShops();
