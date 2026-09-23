const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const Shop = require('../models/Shop');
const Product = require('../models/Product');

// Product Catalogs for different Shop Types
const CATALOGS = {
  SHOES: {
    brands: ['Sparx', 'Campus', 'Bata', 'Red Tape', 'Puma', 'Woodland', 'Relaxo', 'Nike', 'Adidas', 'Action', 'Metro', 'Khadim', 'Paragon', 'Lakhani', 'Reebok', 'Asian', 'Liberty', 'Columbus', 'Goldstar', 'Flite'],
    categories: ['Running Shoes', 'Sneakers', 'Formal Shoes', 'Casual Loafers', 'Leather Boots', 'Flip Flops & Slippers', 'Sport Sandals', 'School Shoes', 'Party Wear Mojari', 'Trekking Shoes', 'Canvas Shoes', 'Ladies Heels', 'Kids Light Shoes', 'Floaters'],
    fabrics: ['Genuine Leather', 'Mesh Breathable', 'Synthetic Canvas', 'EVA Foam', 'Rubber Sole', 'Suede Leather', 'PU Leather', 'Knitted Fabric'],
    sizes: ['6', '7', '8', '9', '10', '11', '12', '36', '37', '38', '39', '40', '41', '42'],
    colors: ['Black', 'Navy Blue', 'Dark Brown', 'Tan', 'White', 'Grey', 'Olive Green', 'Red', 'Maroon', 'Beige', 'Charcoal'],
    unit: 'PAIR',
    hsn: '6403',
    gst: 12,
    baseMin: 350,
    baseMax: 3500
  },

  KIRANA: {
    brands: ['Aashirvaad', 'Fortune', 'Tata', 'Amul', 'Nestle', 'Parle', 'Britannia', 'MDH', 'Everest', 'Dettol', 'Surf Excel', 'Colgate', 'Haldiram', 'Patanjali', 'Dabur', 'Kissan', 'Saffola', 'Catch', 'Bikaji', 'Sunfeast'],
    categories: ['Atta & Flour', 'Edible Cooking Oil', 'Spices & Masala', 'Dals & Pulses', 'Basmati Rice', 'Biscuits & Cookies', 'Soaps & Detergents', 'Tea & Coffee', 'Snacks & Namkeen', 'Ghee & Dairy', 'Salt & Sugar', 'Noodles & Pasta', 'Oral Care', 'Personal Care', 'Cleaning Essentials'],
    units: ['KG', 'GM', 'LTR', 'ML', 'PACK', 'POUCH', 'PCS'],
    sizes: ['100g', '250g', '500g', '1kg', '2kg', '5kg', '10kg', '200ml', '500ml', '1L', '5L', 'Pack of 4', 'Family Pack'],
    hsn: '2106',
    gst: 5,
    baseMin: 15,
    baseMax: 1200
  },

  MEDICAL: {
    brands: ['Cipla', 'Sun Pharma', 'Dr. Reddy', 'Mankind', 'Abbott', 'Lupin', 'Zydus', 'Glenmark', 'Torrent', 'Alkem', 'GlaxoSmithKline', 'Pfizer', 'Intas', 'Dabur', 'Himalaya', 'Piramal', 'Micro Labs', 'Aristo', 'Ipca', 'Bayer'],
    categories: ['Antibiotics', 'Pain Relief & Fever', 'Gastro & Antacids', 'Vitamins & Supplements', 'Cough & Cold Syrups', 'Cardiac & BP', 'Diabetes Care', 'First Aid & Antiseptics', 'Skin Ointments & Lotions', 'Eye & Ear Drops', 'Pain Sprays & Balms', 'Ayurvedic & Immunity', 'Baby & Mother Care', 'Surgical Essentials'],
    generics: ['Paracetamol IP', 'Amoxicillin & Clavulanate', 'Pantoprazole Sodium', 'Azithromycin', 'Levocetirizine', 'Montelukast', 'Metformin HCl', 'Atorvastatin', 'Vitamin C & Zinc', 'Calcium & Vitamin D3', 'Diclofenac Gel', 'Povidone Iodine', 'Omeprazole', 'Telmisartan', 'Cough Formula DX'],
    units: ['STRIP', 'BOTTLE', 'TUBE', 'BOX', 'PCS', 'VIAL', 'SACHET'],
    hsn: '3004',
    gst: 12,
    baseMin: 25,
    baseMax: 850
  },

  MOBILE: {
    brands: ['Samsung', 'Realme', 'Xiaomi', 'OnePlus', 'Vivo', 'Oppo', 'Apple', 'boAt', 'Noise', 'Portronics', 'SanDisk', 'Fastrack', 'Syska', 'Boult Audio', 'Ambrane', 'Zebronics', 'Fire-Boltt', 'Sony', 'Infinix', 'Motorola'],
    categories: ['Smartphones 5G', 'Feature Phones', 'Bluetooth Earbuds (TWS)', 'Neckbands', 'Smartwatches', 'Fast Chargers & Adapters', 'Type-C USB Cables', 'Power Banks', 'Tempered Glass Protectors', 'Silicon Back Covers', 'Memory Cards & Pen Drives', 'Bluetooth Speakers', 'Car Mobile Holders', 'OTG Adapters'],
    rams: ['4GB', '6GB', '8GB', '12GB'],
    storages: ['64GB', '128GB', '256GB', '512GB'],
    colors: ['Phantom Black', 'Midnight Blue', 'Emerald Green', 'Starlight Silver', 'Titanium Grey', 'Sunset Gold', 'Deep Purple'],
    units: ['PCS', 'BOX', 'SET'],
    hsn: '8517',
    gst: 18,
    baseMin: 99,
    baseMax: 29999
  },

  GARMENTS: {
    brands: ['Raymond', 'Allen Solly', 'Peter England', 'Van Heusen', 'Louis Philippe', 'Levi\'s', 'Wrangler', 'Mufti', 'Spykar', 'Killer', 'Manyavar', 'FabIndia', 'Biba', 'W for Woman', 'Max', 'Zudio', 'US Polo', 'Pepe Jeans', 'Flying Machine', 'Duke'],
    categories: ['Cotton Formal Shirts', 'Casual Denim Shirts', 'Slim Fit Jeans', 'Chino Trousers', 'Round Neck T-Shirts', 'Polo Collar T-Shirts', 'Kurta Pajama Sets', 'Designer Sarees', 'Rayon Printed Kurtis', 'Leggings & Palazzos', 'Track Pants & Joggers', 'Winter Hoodies & Sweatshirts', 'Formal Blazers', 'Innerwear & Boxers'],
    fabrics: ['100% Pure Cotton', 'Denim Twill', 'Rayon Slub', 'Linen Blend', 'Pure Silk', 'Terry Cotton', 'Polyester Spandex', 'Fleece Wool'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL', '3XL', '28', '30', '32', '34', '36', '38', '40', '42'],
    colors: ['Navy Blue', 'Jet Black', 'Pure White', 'Sky Blue', 'Maroon', 'Olive Green', 'Mustard Yellow', 'Grey Melange', 'Beige', 'Wine Red', 'Teal Green', 'Rust Orange'],
    units: ['PCS', 'SET', 'PAIR'],
    hsn: '6203',
    gst: 5,
    baseMin: 299,
    baseMax: 4500
  },

  STATIONERY: {
    brands: ['Classmate', 'Camlin', 'Nataraj', 'Apsara', 'Reynolds', 'Cello', 'Hauser', 'Doms', 'Faber-Castell', 'Kangaro', 'Fevicol', 'JK Copier', 'Bilt Matrix', 'Casio', 'Oddy', 'Luxor', 'Flair', 'Solo', 'Navneet', 'Parker'],
    categories: ['Spiral Notebooks', 'Register & Long Notebooks', 'Ballpoint Pens', 'Gel & Roller Pens', 'Wooden Pencils Pack', 'Geometry & Math Boxes', 'Art & Craft Crayons', 'Poster & Water Colors', 'A4 Photocopier Paper Reams', 'Fevicol & Glue Sticks', 'Staplers & Punching Machines', 'Calculators', 'Files & Document Folders', 'Highlighters & Markers', 'Exam Boards & Clipboards'],
    sizes: ['172 Pgs', '240 Pgs', '300 Pgs', 'A4 Size', 'Pack of 5', 'Pack of 10', 'Pack of 20', 'Set of 12 Colors', '500 Sheets Ream'],
    units: ['PCS', 'PACK', 'BOX', 'SET', 'REAM'],
    hsn: '4820',
    gst: 12,
    baseMin: 10,
    baseMax: 1500
  },

  HARDWARE: {
    brands: ['Havells', 'Anchor by Panasonic', 'Philips', 'Finolex', 'Taparia', 'Asian Paints', 'Astral Pipes', 'Godrej Locks', 'Stanley Tools', 'Supreme', 'Crompton', 'Polycab', 'Fevitite Epoxy', 'Berger', 'Pidilite', 'Bosch', 'Orient Electric', 'Schneider', 'V-Guard', 'L&T'],
    categories: ['Modular Switches & Sockets', 'Copper Electrical Wires (1.5/2.5 sqmm)', 'LED Bulbs & Batten Lights', 'PVC & CPVC Pipes & Fittings', 'Heavy Duty Padlocks & Cylinders', 'Wall Paints & Primers (1L/4L)', 'Hand Tools & Screwdriver Sets', 'Drill Bits & Fasteners', 'Water Taps & Bath Fittings', 'Adhesives & Sealants (M-Seal/Fevitite)', 'Exhaust & Ceiling Fans', 'MCB & Distribution Boards', 'Measuring Tapes & Levels'],
    sizes: ['6A / 16A', '90m Coil', '9W / 12W / 20W', '1/2 Inch', '3/4 Inch', '1 Inch', '1 Litre', '4 Litre', '65mm', '500g', '5 Meter'],
    units: ['PCS', 'MTR', 'COIL', 'LTR', 'SET', 'KG', 'BOX'],
    hsn: '8536',
    gst: 18,
    baseMin: 35,
    baseMax: 5500
  },

  COSMETICS: {
    brands: ['Maybelline New York', 'Lakme', 'Nykaa', 'L\'Oreal Paris', 'Mamaearth', 'Sugar Cosmetics', 'Colorbar', 'Pond\'s', 'Nivea', 'Garnier', 'Himalaya', 'Lotus Herbals', 'Biotique', 'Plum', 'Faces Canada', 'Swiss Beauty', 'Insight', 'VLCC', 'Elle 18', 'Tresemme'],
    categories: ['Liquid Foundations & Compacts', 'Matte Lipsticks & Gloss', 'Kajal & Eyeliner Pencils', 'Waterproof Mascara', 'Face Cleansers & Washes', 'Skin Serums & Creams', 'Hair Shampoos & Conditioners', 'Sunscreen Lotions SPF 50', 'Perfumes & Body Mists', 'Nail Enamels & Polish', 'Sheet Masks & Scrubs', 'Makeup Brushes & Blenders'],
    shades: ['Shade 115 Warm Ivory', 'Shade 128 Warm Nude', 'Shade 220 Natural Beige', 'Velvet Matte Red Ruby', 'Pink Rosebud', 'Deep Espresso', 'Coral Sunset', 'Classic Jet Black', 'Golden Glow'],
    units: ['PCS', 'BOTTLE', 'TUBE', 'PACK', 'SET'],
    hsn: '3304',
    gst: 18,
    baseMin: 99,
    baseMax: 1899
  }
};

// Fallback catalog for any custom shop type
const DEFAULT_CATALOG = CATALOGS.KIRANA;

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomItem(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateProductListForShop(shop, targetCount = 2000) {
  const shopTypeKey = (shop.shopType || 'KIRANA').toUpperCase();
  const catalog = CATALOGS[shopTypeKey] || DEFAULT_CATALOG;
  const products = [];

  const typeCode = shopTypeKey.slice(0, 3);
  const shopIdShort = shop._id.toString().slice(-4);

  for (let i = 1; i <= targetCount; i++) {
    const brand = getRandomItem(catalog.brands);
    const category = getRandomItem(catalog.categories);
    const unit = catalog.units ? getRandomItem(catalog.units) : (catalog.unit || 'PCS');

    let specificName = '';
    let size = '';
    let color = '';
    let fabric = '';
    let shade = '';
    let genericName = '';
    let ram = '';
    let storage = '';

    const priceMultiplier = getRandomInt(80, 180) / 100;
    const basePrice = Math.round((getRandomInt(catalog.baseMin, catalog.baseMax) * priceMultiplier) / 5) * 5;
    const purchasePrice = Math.round(basePrice * 0.72);
    const mrp = Math.round(basePrice * 1.25);
    const sellingPrice = basePrice;
    const gstPercent = catalog.gst || 12;

    const sku = `${typeCode}-${shopIdShort}-${String(i).padStart(4, '0')}`;
    const barcode = `890${String(shopIdShort).padStart(4, '0')}${String(i).padStart(6, '0')}`;

    if (shopTypeKey === 'SHOES') {
      size = getRandomItem(catalog.sizes);
      color = getRandomItem(catalog.colors);
      fabric = getRandomItem(catalog.fabrics);
      specificName = `${brand} ${category} (Size ${size}, ${color})`;
    } else if (shopTypeKey === 'GARMENTS') {
      size = getRandomItem(catalog.sizes);
      color = getRandomItem(catalog.colors);
      fabric = getRandomItem(catalog.fabrics);
      specificName = `${brand} ${category} (${size}, ${color}, ${fabric})`;
    } else if (shopTypeKey === 'MOBILE') {
      ram = getRandomItem(catalog.rams);
      storage = getRandomItem(catalog.storages);
      color = getRandomItem(catalog.colors);
      if (category.includes('Smartphone')) {
        specificName = `${brand} ${category} ${ram}/${storage} (${color})`;
      } else {
        specificName = `${brand} ${category} - Pro Edition (${color})`;
      }
    } else if (shopTypeKey === 'MEDICAL') {
      genericName = getRandomItem(catalog.generics);
      const sizePack = getRandomItem(['10 Tablets Strip', '15 Tablets Strip', '100ml Syrup Bottle', '200ml Bottle', '30g Tube', '50g Gel', '60ml Drops']);
      specificName = `${brand} ${category} (${genericName}) - ${sizePack}`;
    } else if (shopTypeKey === 'COSMETICS') {
      shade = getRandomItem(catalog.shades);
      specificName = `${brand} ${category} - ${shade}`;
    } else if (shopTypeKey === 'KIRANA') {
      const sizePack = getRandomItem(catalog.sizes);
      specificName = `${brand} ${category} (${sizePack})`;
    } else if (shopTypeKey === 'STATIONERY') {
      const sizePack = getRandomItem(catalog.sizes);
      specificName = `${brand} ${category} (${sizePack})`;
    } else if (shopTypeKey === 'HARDWARE') {
      const sizePack = getRandomItem(catalog.sizes);
      specificName = `${brand} ${category} (${sizePack})`;
    } else {
      specificName = `${brand} Premium ${category} Item #${i}`;
    }

    const quantity = getRandomInt(15, 180);
    const minStockLevel = getRandomInt(5, 15);

    products.push({
      shopId: shop._id,
      shopType: shopTypeKey,
      name: specificName,
      sku: sku,
      barcode: barcode,
      category: category,
      brand: brand,
      purchasePrice: purchasePrice,
      sellingPrice: sellingPrice,
      mrp: mrp,
      gstPercent: gstPercent,
      gstInclusive: true,
      hsnCode: catalog.hsn || '9999',
      quantity: quantity,
      minStockLevel: minStockLevel,
      unit: unit,
      size: size || undefined,
      color: color || undefined,
      fabric: fabric || undefined,
      shade: shade || undefined,
      genericName: genericName || undefined,
      ram: ram || undefined,
      storage: storage || undefined,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  return products;
}

async function seedAllShops2000Items() {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mks_billing';
    console.log('Connecting to MongoDB at:', uri);
    await mongoose.connect(uri);
    console.log('MongoDB connected successfully.\n');

    const shops = await Shop.find();
    console.log(`Found ${shops.length} shops in the platform database.`);

    for (const shop of shops) {
      console.log(`\n======================================================`);
      console.log(`🏪 Processing Shop: "${shop.name}"`);
      console.log(`   Type: ${shop.shopType} | Owner: ${shop.ownerName} | ID: ${shop._id}`);

      // Count current products
      const currentCount = await Product.countDocuments({ shopId: shop._id });
      console.log(`   Current products in shop: ${currentCount}`);

      const targetToAdd = Math.max(0, 2000 - currentCount);
      const countToGenerate = currentCount < 500 ? 2000 : targetToAdd;

      if (countToGenerate <= 0) {
        console.log(`   ✅ Shop already has ${currentCount} items. Skipping.`);
        continue;
      }

      console.log(`   🚀 Generating and inserting ${countToGenerate} shop-specific items...`);
      const generatedItems = generateProductListForShop(shop, countToGenerate);

      // Insert in batches of 500
      const BATCH_SIZE = 500;
      for (let b = 0; b < generatedItems.length; b += BATCH_SIZE) {
        const batch = generatedItems.slice(b, b + BATCH_SIZE);
        await Product.insertMany(batch, { ordered: false });
        console.log(`      ...inserted ${Math.min(b + BATCH_SIZE, generatedItems.length)} / ${generatedItems.length} items`);
      }

      const newTotal = await Product.countDocuments({ shopId: shop._id });
      console.log(`   🎉 Successfully updated "${shop.name}" to ${newTotal} total products!`);
    }

    console.log('\n======================================================');
    const totalPlatformProducts = await Product.countDocuments();
    console.log(`🌟 ALL SHOPS SEEDED! Total Platform Products in Database: ${totalPlatformProducts}`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedAllShops2000Items();
