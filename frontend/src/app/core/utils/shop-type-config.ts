// Shop Type Configuration Utility
// Provides per-shopType: icon, emoji, color, accent, labels, quick actions, POS feature flags, and specialized categories

export interface PosFeatures {
  hasDoctorPatient: boolean;     // Medical: Doctor & Patient Name
  hasBatchExpiry: boolean;       // Medical / Kirana: Batch No & Expiry Date
  hasGenericSalt: boolean;       // Medical: Generic Formula Search
  hasWeightMultipliers: boolean; // Kirana: 100g, 250g, 500g, 1kg, 5kg quick buttons
  hasLooseDecimal: boolean;      // Kirana: loose grams/kg decimal conversion
  hasSizeColor: boolean;         // Garments / Shoes: Size & Color tags
  hasImei: boolean;              // Mobile: IMEI / Serial tracker
  hasStripTablet: boolean;       // Medical: Strip vs Tablet unit
  hasRackLocation: boolean;      // Medical / Hardware: Rack / Shelf No
}

export interface ShopTypeConfig {
  type: string;
  label: string;
  labelHindi: string;
  badgeText: string;
  emoji: string;
  icon: string;         // FontAwesome class
  accentColor: string;  // primary accent
  accentBg: string;     // light background tint
  accentGradient: string;
  sidebarGradient: string;
  greeting: string;
  themeClass: string;
  posFeatures: PosFeatures;
  quickCategories: string[];
  specializedLabels: {
    searchPlaceholder: string;
    itemLabel: string;
    batchOrSizeLabel: string;
    expOrWarrantyLabel: string;
  };
  quickActions: { label: string; icon: string; route: string }[];
  statsLabels: {
    sales: string;
    products: string;
    lowStock: string;
  };
}

export const SHOP_TYPE_CONFIGS: Record<string, ShopTypeConfig> = {
  MEDICAL: {
    type: 'MEDICAL',
    label: 'Medical & Pharmacy',
    labelHindi: 'मेडिकल स्टोर व फार्मेसी',
    badgeText: '℞ Pharmacy Care',
    emoji: '💊',
    icon: 'fa-solid fa-capsules',
    accentColor: '#0d9488', // clinical teal
    accentBg: '#f0fdfa',
    accentGradient: 'linear-gradient(135deg, #0f766e, #14b8a6)',
    sidebarGradient: 'linear-gradient(180deg, #042f2e 0%, #115e59 50%, #0d9488 100%)',
    greeting: 'Aapki Medical & Pharmacy ka Dashboard',
    themeClass: 'theme-medical',
    posFeatures: {
      hasDoctorPatient: true,
      hasBatchExpiry: true,
      hasGenericSalt: true,
      hasWeightMultipliers: false,
      hasLooseDecimal: false,
      hasSizeColor: false,
      hasImei: false,
      hasStripTablet: true,
      hasRackLocation: true,
    },
    quickCategories: [
      'सभी दवाइयां (All)',
      'Tablets 💊',
      'Capsules 💊',
      'Syrups 🧪',
      'Injections 💉',
      'Ointments 🧴',
      'Drops 💧',
      'Ayurvedic 🌿',
      'Surgical & Bandage 🩺',
      'Baby Care 👶',
      'General OTC 🩹'
    ],
    specializedLabels: {
      searchPlaceholder: 'दवा का नाम, जेनेरिक साल्ट (Salt) या बारकोड खोजें... (F2)',
      itemLabel: 'दवा / मेडिसिन (Medicine)',
      batchOrSizeLabel: 'बैच नं (Batch No)',
      expOrWarrantyLabel: 'एक्सपायरी (Expiry Date)',
    },
    quickActions: [
      { label: 'New Rx Bill (F1)', icon: 'fa-solid fa-prescription-bottle-medical', route: '/billing' },
      { label: 'Add Medicine', icon: 'fa-solid fa-plus', route: '/products' },
      { label: '⚠️ Near Expiry Alert', icon: 'fa-solid fa-clock-rotate-left', route: '/inventory' },
      { label: 'Batch Search', icon: 'fa-solid fa-magnifying-glass', route: '/products' },
    ],
    statsLabels: { sales: "आज की दवा बिक्री", products: "कुल दवाइयां (Medicines)", lowStock: "कम स्टॉक दवाइयां" },
  },

  KIRANA: {
    type: 'KIRANA',
    label: 'Kirana & Grocery',
    labelHindi: 'किराना व जनरल स्टोर',
    badgeText: '🛒 Super Grocery',
    emoji: '🛒',
    icon: 'fa-solid fa-basket-shopping',
    accentColor: '#16a34a', // fresh emerald
    accentBg: '#f0fdf4',
    accentGradient: 'linear-gradient(135deg, #15803d, #22c55e)',
    sidebarGradient: 'linear-gradient(180deg, #14532d 0%, #166534 50%, #15803d 100%)',
    greeting: 'Aapki Kirana Dukaan ka Dashboard',
    themeClass: 'theme-kirana',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: true,
      hasGenericSalt: false,
      hasWeightMultipliers: true,
      hasLooseDecimal: true,
      hasSizeColor: false,
      hasImei: false,
      hasStripTablet: false,
      hasRackLocation: false,
    },
    quickCategories: [
      'सभी सामान (All)',
      'Atta & Flour 🌾',
      'Rice & Grains 🍚',
      'Dals & Pulses 🥣',
      'Oil & Ghee 🛢️',
      'Spices & Masala 🌶️',
      'Sugar & Salt 🧂',
      'Dry Fruits & Nuts 🥜',
      'Tea & Coffee ☕',
      'Snacks & Namkeen 🥨',
      'Biscuits & Bakery 🍪',
      'Dairy & Eggs 🥛',
      'Soaps & Cleaners 🧼',
      'Pooja Samagri 🪔'
    ],
    specializedLabels: {
      searchPlaceholder: 'किराना सामान, ब्रांड या बारकोड खोजें... (F2)',
      itemLabel: 'किराना सामान (Grocery Item)',
      batchOrSizeLabel: 'वजन / यूनिट (Weight)',
      expOrWarrantyLabel: 'एक्सपायरी (Expiry)',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Grocery Item', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'Stock & Loose Inventory', icon: 'fa-solid fa-warehouse', route: '/inventory' },
      { label: 'Suppliers Khata', icon: 'fa-solid fa-truck-field', route: '/suppliers' },
    ],
    statsLabels: { sales: "आज की कुल बिक्री", products: "कुल किराना सामान", lowStock: "खत्म होने वाला माल" },
  },

  GARMENTS: {
    type: 'GARMENTS',
    label: 'Garments & Apparel',
    labelHindi: 'कपड़ा दुकान व रेडीमेड',
    badgeText: '👔 Fashion Store',
    emoji: '👔',
    icon: 'fa-solid fa-shirt',
    accentColor: '#9333ea', // fashion purple
    accentBg: '#faf5ff',
    accentGradient: 'linear-gradient(135deg, #7e22ce, #a855f7)',
    sidebarGradient: 'linear-gradient(180deg, #3b0764 0%, #6b21a8 50%, #7e22ce 100%)',
    greeting: 'Aapki Garment Shop ka Dashboard',
    themeClass: 'theme-garments',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: false,
      hasGenericSalt: false,
      hasWeightMultipliers: false,
      hasLooseDecimal: false,
      hasSizeColor: true,
      hasImei: false,
      hasStripTablet: false,
      hasRackLocation: true,
    },
    quickCategories: [
      'सभी कपड़े (All)',
      'Formal Shirts 👔',
      'T-Shirts & Polos 👕',
      'Jeans & Denims 👖',
      'Trousers & Chinos 👖',
      'Sarees & Lehengas 🥻',
      'Kurtis & Suits 👗',
      'Kids Wear 🧒',
      'Undergarments 🩲',
      'Winter Jackets & Sweaters 🧥',
      'Ethnics & Sherwani 👳'
    ],
    specializedLabels: {
      searchPlaceholder: 'कपड़े का नाम, ब्रांड, साइज या बारकोड खोजें... (F2)',
      itemLabel: 'वस्त्र / कपड़ा (Garment)',
      batchOrSizeLabel: 'साइज व रंग (Size & Color)',
      expOrWarrantyLabel: 'फैब्रिक (Fabric)',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Garment Model', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'Size-wise Stock', icon: 'fa-solid fa-warehouse', route: '/inventory' },
      { label: 'Customer Loyalty', icon: 'fa-solid fa-users', route: '/customers' },
    ],
    statsLabels: { sales: "आज की कपड़ा बिक्री", products: "कुल गारमेंट आइटम्स", lowStock: "कम साइज स्टॉक" },
  },

  SHOES: {
    type: 'SHOES',
    label: 'Shoes & Footwear',
    labelHindi: 'जूता चप्पल शॉप',
    badgeText: '👟 Footwear Zone',
    emoji: '👟',
    icon: 'fa-solid fa-shoe-prints',
    accentColor: '#2563eb', // royal blue
    accentBg: '#eff6ff',
    accentGradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    sidebarGradient: 'linear-gradient(180deg, #1e3a5f 0%, #1e40af 50%, #2563eb 100%)',
    greeting: 'Aapki Shoes Shop ka Dashboard',
    themeClass: 'theme-shoes',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: false,
      hasGenericSalt: false,
      hasWeightMultipliers: false,
      hasLooseDecimal: false,
      hasSizeColor: true,
      hasImei: false,
      hasStripTablet: false,
      hasRackLocation: true,
    },
    quickCategories: [
      'सभी फुटवियर (All)',
      'Sports Running Shoes 👟',
      'Formal Leather Shoes 👞',
      'Casual Sneakers 👟',
      'Sandals & Floaters 👡',
      'Daily Slippers & Chappals 🩴',
      'Ladies Heels & Flats 👠',
      'Kids Shoes 🧒',
      'School & Safety Boots 🥾',
      'Socks & Shoe Care 🧦'
    ],
    specializedLabels: {
      searchPlaceholder: 'जूता मॉडल, ब्रांड, साइज या बारकोड खोजें... (F2)',
      itemLabel: 'जूता मॉडल (Shoe / Footwear)',
      batchOrSizeLabel: 'साइज नं (Size No: 6,7,8,9,10)',
      expOrWarrantyLabel: 'कलर / टाइप (Color)',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Shoe Model', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'Size Stock Check', icon: 'fa-solid fa-warehouse', route: '/inventory' },
      { label: 'Brand Catalog', icon: 'fa-solid fa-tags', route: '/products' },
    ],
    statsLabels: { sales: "आज की फुटवियर बिक्री", products: "कुल जूता मॉडल", lowStock: "कम स्टॉक साइजेस" },
  },

  MOBILE: {
    type: 'MOBILE',
    label: 'Mobile & Electronics',
    labelHindi: 'मोबाइल व इलेक्ट्रॉनिक्स',
    badgeText: '📱 Tech Hub',
    emoji: '📱',
    icon: 'fa-solid fa-mobile-screen-button',
    accentColor: '#0891b2', // tech cyan
    accentBg: '#ecfeff',
    accentGradient: 'linear-gradient(135deg, #0e7490, #06b6d4)',
    sidebarGradient: 'linear-gradient(180deg, #164e63 0%, #0e7490 50%, #0891b2 100%)',
    greeting: 'Aapki Mobile Shop ka Dashboard',
    themeClass: 'theme-mobile',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: false,
      hasGenericSalt: false,
      hasWeightMultipliers: false,
      hasLooseDecimal: false,
      hasSizeColor: false,
      hasImei: true,
      hasStripTablet: false,
      hasRackLocation: false,
    },
    quickCategories: [
      'सभी प्रोडक्ट्स (All)',
      'Smartphones (Android/iOS) 📱',
      'Feature Keypad Phones 📞',
      'Chargers & Fast Adapters 🔌',
      'USB Cables & OTG ⚡',
      'Bluetooth Earbuds & TWS 🎧',
      'Neckbands & Headphones 🎵',
      'Power Banks 🔋',
      'Back Covers & Cases 🛡️',
      'Tempered Glass & UV 📱',
      'Memory Cards & Pendrives 💾',
      'Smartwatches & Bands ⌚'
    ],
    specializedLabels: {
      searchPlaceholder: 'मोबाइल मॉडल, IMEI, RAM/ROM या बारकोड खोजें... (F2)',
      itemLabel: 'डिवाइस / मॉडल (Mobile / Model)',
      batchOrSizeLabel: 'RAM / Storage / Color',
      expOrWarrantyLabel: 'IMEI / वारंटी (Warranty)',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Mobile Device', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'IMEI / Warranty Lookup', icon: 'fa-solid fa-barcode', route: '/products' },
      { label: 'Accessories Stock', icon: 'fa-solid fa-boxes-stacked', route: '/inventory' },
    ],
    statsLabels: { sales: "आज की मोबाइल बिक्री", products: "कुल डिवाइस व एक्सेसरीज", lowStock: "कम स्टॉक मॉडल्स" },
  },

  COSMETICS: {
    type: 'COSMETICS',
    label: 'Cosmetics & Beauty',
    labelHindi: 'कॉस्मेटिक व ब्यूटी शॉप',
    badgeText: '💄 Beauty Glow',
    emoji: '💄',
    icon: 'fa-solid fa-spray-can-sparkles',
    accentColor: '#db2777', // pink
    accentBg: '#fdf2f8',
    accentGradient: 'linear-gradient(135deg, #be185d, #ec4899)',
    sidebarGradient: 'linear-gradient(180deg, #500724 0%, #9d174d 50%, #be185d 100%)',
    greeting: 'Aapki Cosmetic Shop ka Dashboard',
    themeClass: 'theme-cosmetics',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: true,
      hasGenericSalt: false,
      hasWeightMultipliers: false,
      hasLooseDecimal: false,
      hasSizeColor: true,
      hasImei: false,
      hasStripTablet: false,
      hasRackLocation: true,
    },
    quickCategories: [
      'सभी कॉस्मेटिक्स (All)',
      'Lipsticks & Lip Care 💄',
      'Foundation & Compact 🪞',
      'Eye Makeup & Kajal 👁️',
      'Perfumes & Deos 🌸',
      'Skin Creams & Serums 🧴',
      'Face Wash & Cleansers 🫧',
      'Hair Oils & Shampoos 💇',
      'Nail Polish & Art 💅',
      'Bridal & Groom Kits 👰'
    ],
    specializedLabels: {
      searchPlaceholder: 'कॉस्मेटिक आइटम, शेड (Shade), ब्रांड खोजें... (F2)',
      itemLabel: 'कॉस्मेटिक आइटम (Beauty Product)',
      batchOrSizeLabel: 'शेड / कलर (Shade No)',
      expOrWarrantyLabel: 'एक्सपायरी (Expiry Date)',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Beauty Product', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'Brand Catalog', icon: 'fa-solid fa-tags', route: '/products' },
      { label: 'Near Expiry Check', icon: 'fa-solid fa-clock', route: '/inventory' },
    ],
    statsLabels: { sales: "आज की ब्यूटी बिक्री", products: "कुल प्रोडक्ट्स", lowStock: "कम स्टॉक प्रोडक्ट्स" },
  },

  HARDWARE: {
    type: 'HARDWARE',
    label: 'Hardware & Sanitary',
    labelHindi: 'हार्डवेयर व सेनेटरी',
    badgeText: '🔧 Hardware Pro',
    emoji: '🔧',
    icon: 'fa-solid fa-screwdriver-wrench',
    accentColor: '#57534e', // industrial slate
    accentBg: '#fafaf9',
    accentGradient: 'linear-gradient(135deg, #44403c, #78716c)',
    sidebarGradient: 'linear-gradient(180deg, #1c1917 0%, #44403c 50%, #57534e 100%)',
    greeting: 'Aapki Hardware Shop ka Dashboard',
    themeClass: 'theme-hardware',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: false,
      hasGenericSalt: false,
      hasWeightMultipliers: true,
      hasLooseDecimal: true,
      hasSizeColor: false,
      hasImei: false,
      hasStripTablet: false,
      hasRackLocation: true,
    },
    quickCategories: [
      'सभी हार्डवेयर (All)',
      'Paints & Primers 🎨',
      'Pipes & Fittings 🚰',
      'Locks & Handles 🔒',
      'Power Tools 🪚',
      'Hand Tools 🔨',
      'Screws, Nails & Fasteners 🔩',
      'Electrical Wires & Switches 💡',
      'Sanitaryware & Taps 🚿',
      'Cement & Adhesives 🧱'
    ],
    specializedLabels: {
      searchPlaceholder: 'हार्डवेयर मटेरियल, साइज (MM/Inch), ब्रांड खोजें... (F2)',
      itemLabel: 'मटेरियल / टूल (Material / Tool)',
      batchOrSizeLabel: 'साइज / गेज (Size / Gauge)',
      expOrWarrantyLabel: 'वारंटी / ग्रेड',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Material', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'Stock & Weight Check', icon: 'fa-solid fa-warehouse', route: '/inventory' },
      { label: 'Suppliers List', icon: 'fa-solid fa-truck-field', route: '/suppliers' },
    ],
    statsLabels: { sales: "आज की कुल बिक्री", products: "कुल हार्डवेयर सामान", lowStock: "कम स्टॉक सामान" },
  },

  STATIONERY: {
    type: 'STATIONERY',
    label: 'Stationery & Books',
    labelHindi: 'स्टेशनरी व बुक डिपो',
    badgeText: '📚 Stationery Hub',
    emoji: '📚',
    icon: 'fa-solid fa-pen-ruler',
    accentColor: '#d97706', // amber
    accentBg: '#fffbeb',
    accentGradient: 'linear-gradient(135deg, #b45309, #f59e0b)',
    sidebarGradient: 'linear-gradient(180deg, #451a03 0%, #92400e 50%, #b45309 100%)',
    greeting: 'Aapki Stationery Shop ka Dashboard',
    themeClass: 'theme-stationery',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: false,
      hasGenericSalt: false,
      hasWeightMultipliers: false,
      hasLooseDecimal: false,
      hasSizeColor: false,
      hasImei: false,
      hasStripTablet: false,
      hasRackLocation: true,
    },
    quickCategories: [
      'सभी स्टेशनरी (All)',
      'Notebooks & Registers 📒',
      'Pens & Markers 🖊️',
      'Art & Craft Colors 🎨',
      'School Bags & Bottles 🎒',
      'Files & Folders 📁',
      'Calculators & Geometry 📐',
      'Photocopy Paper & Rims 📄',
      'Books & Guides 📖',
      'Office Supplies 📎'
    ],
    specializedLabels: {
      searchPlaceholder: 'किताब, पेन, रजिस्टर या स्टेशनरी खोजें... (F2)',
      itemLabel: 'किताब / स्टेशनरी (Book / Item)',
      batchOrSizeLabel: 'ब्रांड / साइज़ / क्लास',
      expOrWarrantyLabel: 'एडिशन / वारंटी',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Book/Item', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'Stock Register', icon: 'fa-solid fa-warehouse', route: '/inventory' },
      { label: 'Suppliers List', icon: 'fa-solid fa-truck-field', route: '/suppliers' },
    ],
    statsLabels: { sales: 'आज की कुल स्टेशनरी बिक्री', products: 'कुल बुक्स व स्टेशनरी', lowStock: 'कम स्टॉक स्टेशनरी' },
  },

  GENERAL: {
    type: 'GENERAL',
    label: 'General Retail & Wholesale',
    labelHindi: 'सामान्य रिटेल व होलसेल',
    badgeText: '🏪 Retail Mart',
    emoji: '🏪',
    icon: 'fa-solid fa-store',
    accentColor: '#2563eb',
    accentBg: '#eff6ff',
    accentGradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    sidebarGradient: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 50%, #334155 100%)',
    greeting: 'Aapki Shop ka Dashboard',
    themeClass: 'theme-general',
    posFeatures: {
      hasDoctorPatient: false,
      hasBatchExpiry: false,
      hasGenericSalt: false,
      hasWeightMultipliers: false,
      hasLooseDecimal: false,
      hasSizeColor: false,
      hasImei: false,
      hasStripTablet: false,
      hasRackLocation: true,
    },
    quickCategories: [
      'सभी सामान (All)',
      'General Items 📦',
      'Fast Moving ⚡',
      'Services 🛠️'
    ],
    specializedLabels: {
      searchPlaceholder: 'सामान का नाम या बारकोड खोजें... (F2)',
      itemLabel: 'सामान / प्रोडक्ट (Item)',
      batchOrSizeLabel: 'साइज / मॉडल',
      expOrWarrantyLabel: 'वारंटी / गारंटी',
    },
    quickActions: [
      { label: 'New Bill (F1)', icon: 'fa-solid fa-calculator', route: '/billing' },
      { label: 'Add Product', icon: 'fa-solid fa-plus', route: '/products' },
      { label: 'Stock Check', icon: 'fa-solid fa-warehouse', route: '/inventory' },
      { label: 'Suppliers', icon: 'fa-solid fa-truck-field', route: '/suppliers' },
    ],
    statsLabels: { sales: 'आज की कुल बिक्री', products: 'कुल प्रोडक्ट्स', lowStock: 'कम स्टॉक आइटम्स' },
  }
};

export function getShopTypeConfig(shopType: string | undefined | null): ShopTypeConfig {
  if (!shopType) {
    return SHOP_TYPE_CONFIGS['KIRANA']; // default fallback
  }
  return SHOP_TYPE_CONFIGS[shopType] || SHOP_TYPE_CONFIGS['KIRANA'];
}
