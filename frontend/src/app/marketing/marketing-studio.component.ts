import { Component, OnInit, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';

export interface CategorySpec {
  id: string;
  name: string;
  hindiName: string;
  icon: string;
  emoji: string;
  headline: string;
  subtext: string;
  offer: string;
  cta: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgGradient: [string, string, string];
}

export type TemplateStyle =
  | 'INDIAN_RETAIL_FLYER'
  | 'FULL_BLEED_HERO'
  | 'EDITORIAL_ASYMMETRICAL'
  | 'CUTOUT_COMPOSITION'
  | 'SPLIT_IMAGE_TYPO'
  | 'TYPOGRAPHY_CAMPAIGN'
  | 'MINIMAL_LUXURY'
  | 'DARK_PREMIUM_TECH'
  | 'LIFESTYLE_ADVERTISING'
  | 'HIGH_IMPACT_OFFER'
  | 'STREET_POSTER_COLLAGE'
  | 'FESTIVAL';

@Component({
  selector: 'app-marketing-studio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './marketing-studio.component.html',
  styleUrls: ['./marketing-studio.component.css']
})
export class MarketingStudioComponent implements OnInit {
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private toast = inject(ToastService);

  @ViewChild('posterCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  // Form Signals
  businessName = signal<string>('');
  shopCategory = signal<string>('KIRANA');
  customCategoryName = signal<string>('');
  businessLogo = signal<string>('');
  contactNumber = signal<string>('');
  whatsappNumber = signal<string>('');
  address = signal<string>('');
  website = signal<string>('');
  
  // Campaign & Copy Signals
  posterPurpose = signal<'GENERAL_PROMO' | 'FESTIVAL_OFFER' | 'DISCOUNT_SALE' | 'NEW_ARRIVALS' | 'STORE_OPENING'>('GENERAL_PROMO');
  offerTagline = signal<string>('');
  headlineText = signal<string>('');
  subtextBody = signal<string>('');
  ctaText = signal<string>('SHOP NOW');
  
  // Product Showcase Attached
  selectedProductId = signal<string>('');
  attachedProduct = signal<any>(null);
  productImage = signal<string>('');
  productsList = signal<any[]>([]);

  // Design Settings Signals
  templateStyle = signal<TemplateStyle>('INDIAN_RETAIL_FLYER');
  posterFormat = signal<'SQUARE' | 'PORTRAIT' | 'STORY' | 'LANDSCAPE' | 'A4_PRINT'>('PORTRAIT');
  showMksBranding = signal<boolean>(true);

  // Studio State
  isGenerating = signal<boolean>(false);
  posterDataUrl = signal<string>('');
  canvasWidth = signal<number>(1080);
  canvasHeight = signal<number>(1440);

  // 28+ Business Categories Data Registry
  categories: CategorySpec[] = [
    {
      id: 'KIRANA', name: 'Kirana & Grocery', hindiName: 'किराना व जनरल स्टोर', icon: 'fa-basket-shopping', emoji: '🛒',
      headline: 'Everything You Need, All in One Place',
      subtext: 'ताज़ा राशन, शुद्ध खाद्य तेल, दालें व ब्रांडेड ग्रॉसरी पर पाएं महा बचत!',
      offer: 'FLAT 20% OFF ON ALL GROCERIES', cta: 'VISIT OUR STORE',
      primaryColor: '#059669', secondaryColor: '#d97706', accentColor: '#fef08a',
      bgGradient: ['#064e3b', '#047857', '#022c22']
    },
    {
      id: 'MEDICAL', name: 'Medical & Pharmacy', hindiName: 'मेडिकल व फार्मेसी', icon: 'fa-prescription-bottle-medical', emoji: '💊',
      headline: 'Your Trusted Pharmacy, Now Smarter',
      subtext: '100% प्रामाणिक दवाइयां, हेल्थ सप्लीमेंट्स व होम डिलीवरी उपलब्ध।',
      offer: 'UP TO 15% OFF ON MEDICINES', cta: 'ORDER ON WHATSAPP',
      primaryColor: '#0284c7', secondaryColor: '#10b981', accentColor: '#e0f2fe',
      bgGradient: ['#0c4a6e', '#0369a1', '#082f49']
    },
    {
      id: 'GARMENTS', name: 'Garments & Fashion', hindiName: 'कपड़ा व फैशन स्टोर', icon: 'fa-shirt', emoji: '👔',
      headline: 'Upgrade Your Style Today',
      subtext: 'फैंसी एथनिक वियर, ब्रांडेड शर्ट्स, साड़ियां व किड्स वियर का नया कलेक्शन।',
      offer: 'FESTIVE SALE: BUY 2 GET 1 FREE', cta: 'EXPLORE COLLECTION',
      primaryColor: '#db2777', secondaryColor: '#f59e0b', accentColor: '#fde047',
      bgGradient: ['#831843', '#be185d', '#4c0519']
    },
    {
      id: 'FOOTWEAR', name: 'Footwear & Shoes', hindiName: 'फुटवियर व शूज़', icon: 'fa-shoe-prints', emoji: '👟',
      headline: 'Step Into Comfort & Fashion',
      subtext: 'ब्रांडेड स्पोर्ट्स शूज़, फॉर्मल व फैंसी लेडीज़ फुटवियर पर भारी छूट।',
      offer: 'SPECIAL DISCOUNT: FLAT 30% OFF', cta: 'SHOP NOW',
      primaryColor: '#ea580c', secondaryColor: '#0284c7', accentColor: '#ffedd5',
      bgGradient: ['#7c2d12', '#c2410c', '#431407']
    },
    {
      id: 'MOBILE_ELECTRONICS', name: 'Mobile & Electronics', hindiName: 'मोबाइल व इलेक्ट्रॉनिक्स', icon: 'fa-mobile-screen-button', emoji: '📱',
      headline: 'Latest Technology. Best Deals.',
      subtext: 'स्मार्टफोन्स, स्मार्टवॉच, हेडफोन्स व एक्सेसरीज़ पर बेस्ट प्राइस गारंटी।',
      offer: '0% DOWNPAYMENT & EASY EMI', cta: 'BUY NOW',
      primaryColor: '#7c3aed', secondaryColor: '#06b6d4', accentColor: '#c084fc',
      bgGradient: ['#4c1d95', '#6d28d9', '#2e1065']
    },
    {
      id: 'COMPUTERS', name: 'Computer & Laptop', hindiName: 'कंप्यूटर व आईटी शॉप', icon: 'fa-laptop', emoji: '💻',
      headline: 'Empower Your Business & Learning',
      subtext: 'ब्रांडेड लॉपटॉप्स, डेस्कटॉप, प्रिंटर्स व नेटवर्किंग डिवाइस पर धमाकेदार ऑफर।',
      offer: 'SPECIAL STUDENT DISCOUNT ₹2,000 OFF', cta: 'GET DEALS',
      primaryColor: '#2563eb', secondaryColor: '#38bdf8', accentColor: '#dbeafe',
      bgGradient: ['#1e3a8a', '#1d4ed8', '#172554']
    },
    {
      id: 'HARDWARE', name: 'Hardware & Tools', hindiName: 'हार्डवेयर व टूल्स', icon: 'fa-hammer', emoji: '🛠️',
      headline: 'Quality Tools for Strong Construction',
      subtext: 'पेंट, पावर टूल्स, नट-बोल्ट व प्लाईवुड की विस्तृत रेंज उपलब्ध।',
      offer: 'WHOLESALE RATES FOR CONTRACTORS', cta: 'VISIT STORE',
      primaryColor: '#d97706', secondaryColor: '#dc2626', accentColor: '#fef08a',
      bgGradient: ['#78350f', '#b45309', '#451a03']
    },
    {
      id: 'ELECTRICAL', name: 'Electrical & Lighting', hindiName: 'इलेक्ट्रिकल्स व लाइटिंग', icon: 'fa-lightbulb', emoji: '💡',
      headline: 'Illuminate Your House Smartly',
      subtext: 'LED फैंसी लाइट्स, वायर्स, स्विचेस व फैन पर भारी वारंटी व ऑफर।',
      offer: 'FLAT 25% OFF ON LED FANCY LIGHTS', cta: 'SHOP LIGHTS',
      primaryColor: '#eab308', secondaryColor: '#2563eb', accentColor: '#fef9c3',
      bgGradient: ['#713f12', '#a16207', '#422006']
    },
    {
      id: 'FURNITURE', name: 'Furniture & Decor', hindiName: 'फर्नीचर व होम डेकोर', icon: 'fa-couch', emoji: '🛋️',
      headline: 'Transform Your Home Comfortably',
      subtext: 'सोफा सेट, अलमीरा, बेड व डाइनिंग टेबल की शाही रेंज उचित दाम में।',
      offer: 'FURNITURE MEGA SALE: UP TO 40% OFF', cta: 'EXPLORE FURNITURE',
      primaryColor: '#b45309', secondaryColor: '#059669', accentColor: '#ffedd5',
      bgGradient: ['#451a03', '#78350f', '#290e02']
    },
    {
      id: 'JEWELLERY', name: 'Jewellery & Gold', hindiName: 'ज्वेलरी व सोना-चांदी', icon: 'fa-gem', emoji: '💎',
      headline: 'Timeless Elegance & Pure Gold',
      subtext: '100% हॉलमार्क सोने-चांदी के आभूषण व डायमंड कलेक्शन।',
      offer: 'FLAT 50% OFF ON MAKING CHARGES', cta: 'BOOK JEWELLERY',
      primaryColor: '#ca8a04', secondaryColor: '#be185d', accentColor: '#fef08a',
      bgGradient: ['#451a03', '#713f12', '#1c0a00']
    },
    {
      id: 'RESTAURANT', name: 'Restaurant & Dining', hindiName: 'रेस्टोरेंट व डाइनिंग', icon: 'fa-utensils', emoji: '🍽️',
      headline: 'Taste That Brings You Back',
      subtext: 'स्वादिष्ट व्यंजन, ला जवाब मलाई पनीर, थाली व चाइनीज स्पेशल।',
      offer: 'SPECIAL FAMILY THALI DISCOUNT 20% OFF', cta: 'ORDER FOOD NOW',
      primaryColor: '#dc2626', secondaryColor: '#f59e0b', accentColor: '#fee2e2',
      bgGradient: ['#7f1d1d', '#b91c1c', '#450a0a']
    },
    {
      id: 'CAFE', name: 'Cafe & Coffee', hindiName: 'कैफे व शेक्स', icon: 'fa-mug-hot', emoji: '☕',
      headline: 'Sip, Relax & Refresh Yourself',
      subtext: 'कोल्ड कॉफी, थिक शेक्स, बर्गर व पिज्जा का नया फ्लेवर जायका।',
      offer: 'BUY 1 COFFEE GET 1 DESSERT FREE', cta: 'VISIT CAFE',
      primaryColor: '#78350f', secondaryColor: '#ec4899', accentColor: '#fde68a',
      bgGradient: ['#3b1802', '#58240c', '#1f0a00']
    },
    {
      id: 'BAKERY', name: 'Bakery & Cakes', hindiName: 'बेकरी व लाइव केक', icon: 'fa-cake-candles', emoji: '🎂',
      headline: 'Freshly Baked Happiness Every Day',
      subtext: '100% एगलेस कस्टमाइज्ड बर्थडे केक्स, पेस्ट्री व बिस्कुट।',
      offer: 'SPECIAL 15% OFF ON ADVANCE CAKE BOOKING', cta: 'ORDER CAKE NOW',
      primaryColor: '#e11d48', secondaryColor: '#fbbf24', accentColor: '#ffe4e6',
      bgGradient: ['#881337', '#9f1239', '#4c0519']
    },
    {
      id: 'SWEETS', name: 'Sweet Shop & Snacks', hindiName: 'मिठाई व नमकीन शॉप', icon: 'fa-bowl-food', emoji: '🪔',
      headline: 'Pure Desi Ghee Sweets & Festival Treats',
      subtext: 'शुद्ध देसी घी के काजू कतली, गुलाब जामुन व स्पेशल नमकीन।',
      offer: 'SPECIAL FESTIVAL SWEET BOX DISCOUNTS', cta: 'BUY SWEETS',
      primaryColor: '#d97706', secondaryColor: '#dc2626', accentColor: '#fef08a',
      bgGradient: ['#78350f', '#a16207', '#451a03']
    },
    {
      id: 'SALON', name: 'Salon & Beauty Parlour', hindiName: 'सलून व ब्यूटी पार्लर', icon: 'fa-scissors', emoji: '✂️',
      headline: 'Glow With Confidence & Elegance',
      subtext: 'हेयर कट, मेक-अप, फेशियल व स्किन केयर एक्सपर्ट सर्विसेज।',
      offer: 'BRIDAL & MAKEUP PACKAGE 30% OFF', cta: 'BOOK APPOINTMENT',
      primaryColor: '#ec4899', secondaryColor: '#8b5cf6', accentColor: '#fce7f3',
      bgGradient: ['#831843', '#be185d', '#500724']
    },
    {
      id: 'GYM', name: 'Gym & Fitness Center', hindiName: 'जिम व फिटनेस सेंटर', icon: 'fa-dumbbell', emoji: '🏋️',
      headline: 'Transform Your Body & Mind',
      subtext: 'आधुनिक जिम इक्विपमेंट्स, पर्सनल ट्रेनिंग व कार्डियो जोन।',
      offer: 'NEW YEAR GYM MEMBERSHIP: FLAT 40% OFF', cta: 'JOIN GYM TODAY',
      primaryColor: '#ea580c', secondaryColor: '#84cc16', accentColor: '#ffedd5',
      bgGradient: ['#1e293b', '#0f172a', '#020617']
    },
    {
      id: 'AUTOMOBILE', name: 'Automobile & Garage', hindiName: 'ऑटो गैराज व सर्विस सेंटर', icon: 'fa-car-burst', emoji: '🚗',
      headline: 'Expert Care for Your Vehicle',
      subtext: 'कार व बाइक कम्प्यूटराइज्ड वाशिंग, इंजन ट्यूनिंग व अलाइनमेंट।',
      offer: 'FREE FOAM WASH ON FULL SERVICE', cta: 'BOOK SERVICE',
      primaryColor: '#0284c7', secondaryColor: '#ea580c', accentColor: '#e0f2fe',
      bgGradient: ['#0f172a', '#1e293b', '#020617']
    },
    {
      id: 'AUTOPARTS', name: 'Auto Parts & Tyres', hindiName: 'ऑटो पार्ट्स व टायर्स', icon: 'fa-gears', emoji: '⚙️',
      headline: 'Genuine Spare Parts & Top Tyres',
      subtext: 'सभी दोपहिया व चौपहिया वाहनों के जेनुइन पार्ट्स व टायर।',
      offer: 'FREE WHEEL BALANCING WITH NEW TYRES', cta: 'GET PARTS',
      primaryColor: '#475569', secondaryColor: '#ef4444', accentColor: '#e2e8f0',
      bgGradient: ['#1e293b', '#334155', '#0f172a']
    },
    {
      id: 'STATIONERY', name: 'Stationery & Books', hindiName: 'स्टेशनरी व बुक डिपो', icon: 'fa-book-open', emoji: '📚',
      headline: 'Complete School & Office Supplies',
      subtext: 'बुक्स, कॉपी, पेन, आर्ट मटेरियल व ऑफिस स्टेशनरी का होलसेल दाम।',
      offer: 'BACK TO SCHOOL SALE: FLAT 15% OFF', cta: 'BUY SUPPLIES',
      primaryColor: '#059669', secondaryColor: '#2563eb', accentColor: '#d1fae5',
      bgGradient: ['#064e3b', '#047857', '#022c22']
    },
    {
      id: 'SANITARY', name: 'Hardware & Sanitaryware', hindiName: 'सैनिटरी व प्लंबिंग फिटिंग', icon: 'fa-shower', emoji: '🚿',
      headline: 'Luxury Bathrooms & Plumbing Solutions',
      subtext: 'फैंसी शावर, नोजल टोंटी, सीपीवीसी पाइप व टाइल्स रेंज।',
      offer: 'COMBO DISCOUNTS ON BATHROOM FITTINGS', cta: 'VISIT SHOWROOM',
      primaryColor: '#0891b2', secondaryColor: '#2563eb', accentColor: '#cffaff',
      bgGradient: ['#164e63', '#0891b2', '#083344']
    },
    {
      id: 'DAIRY', name: 'Dairy & Fresh Milk', hindiName: 'डेयरी व दूध-दही', icon: 'fa-cow', emoji: '🥛',
      headline: 'Pure Farm Fresh Milk & Dairy Items',
      subtext: 'शुद्ध ताज़ा दूध, दही, पनीर, मक्खन व छाछ रोजाना उपलब्ध।',
      offer: 'FRESH PANEER & GHEE SPECIAL RATES', cta: 'ORDER DAIRY',
      primaryColor: '#0284c7', secondaryColor: '#10b981', accentColor: '#e0f2fe',
      bgGradient: ['#075985', '#0284c7', '#0c4a6e']
    },
    {
      id: 'SUPERMARKET', name: 'Supermarket & Mart', hindiName: 'सुपरमार्केट व सुपर मार्ट', icon: 'fa-cart-shopping', emoji: '🛍️',
      headline: 'Super Quality, Super Savings Always',
      subtext: 'एक ही छत के नीचे ग्रॉसरी, कॉस्मेटिक्स, क्रॉकरी व होम केयर।',
      offer: 'WEEKEND SUPER SAVER BAZAAR', cta: 'VISIT MART',
      primaryColor: '#16a34a', secondaryColor: '#ea580c', accentColor: '#dcfce7',
      bgGradient: ['#14532d', '#16a34a', '#052e16']
    },
    {
      id: 'GENERAL_STORE', name: 'General Store', hindiName: 'जनरल स्टोर व प्रोविजन', icon: 'fa-store', emoji: '🏪',
      headline: 'Your Everyday Convenience Partner',
      subtext: 'दैनिक उपयोग का सभी सामान, स्नैक्स, पर्सनल केयर व कोल्ड ड्रिंक्स।',
      offer: 'BEST DISCOUNT ON PACKAGED GOODS', cta: 'VISIT STORE',
      primaryColor: '#2563eb', secondaryColor: '#f59e0b', accentColor: '#dbeafe',
      bgGradient: ['#1e3a8a', '#2563eb', '#172554']
    },
    {
      id: 'ELECTRONICS_HOME', name: 'Home Appliances', hindiName: 'होम एप्लायंसेज व टीवी', icon: 'fa-tv', emoji: '📺',
      headline: 'Upgrade Home Comfort with Smart Appliances',
      subtext: 'स्मार्ट टीवी, फ्रिज, वाशिंग मशीन व एयर कंडीशनर पर महा बचत।',
      offer: 'EXCHANGE BONUS UP TO ₹5,000 OFF', cta: 'GET APPLIANCES',
      primaryColor: '#0284c7', secondaryColor: '#7c3aed', accentColor: '#bae6fd',
      bgGradient: ['#0f172a', '#0369a1', '#020617']
    },
    {
      id: 'CONSTRUCTION', name: 'Building & Construction', hindiName: 'बिल्डिंग मटेरियल व सीमेंट', icon: 'fa-building-wheat', emoji: '🏗️',
      headline: 'Strong Foundation for Dream Buildings',
      subtext: 'सीमेंट, सरिया (TMT Bar), ईंट, बालू व गिट्टी की डायरेक्ट सप्लाई।',
      offer: 'DIRECT FACTORY WHOLESALE RATES', cta: 'GET QUOTATION',
      primaryColor: '#d97706', secondaryColor: '#dc2626', accentColor: '#fef08a',
      bgGradient: ['#451a03', '#78350f', '#290e02']
    },
    {
      id: 'REAL_ESTATE', name: 'Real Estate & Property', hindiName: 'प्रॉपर्टी व प्लॉट्स', icon: 'fa-city', emoji: '🏢',
      headline: 'Find Your Dream Home & Land',
      subtext: 'प्राइम लोकेशन प्लॉट्स, इंडिपेंडेंट मकान व फ्लैट्स बिक्री हेतु।',
      offer: 'EASY BANK LOAN APPROVED PROJECTS', cta: 'CALL FOR SITE VISIT',
      primaryColor: '#0f172a', secondaryColor: '#ca8a04', accentColor: '#fde047',
      bgGradient: ['#0f172a', '#1e293b', '#020617']
    },
    {
      id: 'EDUCATION', name: 'Coaching & Education', hindiName: 'कोचिंग संस्थान व एकेडमी', icon: 'fa-graduation-cap', emoji: '🎓',
      headline: 'Shape Your Bright Career & Future',
      subtext: 'कक्षा 9 से 12, JEE/NEET व प्रतियोगी परीक्षाओं की सर्वश्रेष्ठ तैयारी।',
      offer: 'FREE DEMO CLASSES & SCHOLARSHIP TEST', cta: 'ENROLL TODAY',
      primaryColor: '#2563eb', secondaryColor: '#059669', accentColor: '#dbeafe',
      bgGradient: ['#1e3a8a', '#1d4ed8', '#0f172a']
    },
    {
      id: 'OTHER', name: 'Other / Custom Business', hindiName: 'कस्टम व्यापार श्रेणी', icon: 'fa-sparkles', emoji: '✨',
      headline: 'Best Quality Products & Services Guaranteed',
      subtext: 'उत्कृष्ट सेवाएं, बेहतरीन क्वालिटी व किफायती दाम पर उपलब्ध।',
      offer: 'SPECIAL INAUGURAL / FESTIVE DISCOUNT', cta: 'CONTACT US',
      primaryColor: '#7c3aed', secondaryColor: '#ec4899', accentColor: '#ddd6fe',
      bgGradient: ['#3b0764', '#6b21a8', '#1e0140']
    }
  ];

  ngOnInit() {
    this.autoLoadShopData();
    this.loadProductsList();
  }

  autoLoadShopData() {
    const s: any = this.auth.currentShop();
    if (s) {
      this.businessName.set(s.name || '');
      this.businessLogo.set(s.logo || '');
      this.contactNumber.set(s.mobile || '');
      this.whatsappNumber.set(s.mobile || '');
      this.address.set(s.address || s.branchName || '');
      
      // Infer category from shopType
      if (s.shopType) {
        const matched = this.categories.find(c => c.id === s.shopType || c.id.includes(s.shopType));
        if (matched) {
          this.onCategorySelect(matched.id);
        } else {
          this.onCategorySelect('KIRANA');
        }
      } else {
        this.onCategorySelect('KIRANA');
      }
    } else {
      this.onCategorySelect('KIRANA');
    }
  }

  loadProductsList() {
    this.api.get<any[]>('/products').subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          this.productsList.set(res);
        }
      },
      error: () => {}
    });
  }

  getSelectedCategorySpec(): CategorySpec {
    if (this.shopCategory() === 'OTHER' && this.customCategoryName()) {
      const customName = this.customCategoryName();
      return {
        id: 'OTHER',
        name: customName,
        hindiName: customName,
        icon: 'fa-sparkles',
        emoji: '✨',
        headline: `Best ${customName} Deals & Services`,
        subtext: 'उच्च गुणवत्ता, बेहतरीन सर्विस व स्पेशल डिस्काउंट!',
        offer: 'SPECIAL PROMOTIONAL OFFER',
        cta: 'CONTACT US NOW',
        primaryColor: '#7c3aed',
        secondaryColor: '#ec4899',
        accentColor: '#fde047',
        bgGradient: ['#3b0764', '#6b21a8', '#1e0140']
      };
    }
    return this.categories.find(c => c.id === this.shopCategory()) || this.categories[0];
  }

  onCategorySelect(catId: string) {
    this.shopCategory.set(catId);
    const spec = this.getSelectedCategorySpec();
    if (!this.headlineText() || this.headlineText() === spec.headline) {
      this.headlineText.set(spec.headline);
    }
    if (!this.subtextBody()) {
      this.subtextBody.set(spec.subtext);
    }
    if (!this.offerTagline()) {
      this.offerTagline.set(spec.offer);
    }
    if (!this.ctaText()) {
      this.ctaText.set(spec.cta);
    }
    this.renderMarketingPoster();
  }

  onProductSelect(event: any) {
    const id = event.target.value;
    this.selectedProductId.set(id);
    const found = this.productsList().find(p => p._id === id);
    if (found) {
      this.attachedProduct.set(found);
      this.productImage.set(found.image || '');
      this.offerTagline.set(`SPECIAL RATE: ₹${found.sellingPrice}/- (MRP: ~₹${found.mrp || found.sellingPrice}~ )`);
      this.renderMarketingPoster();
    } else {
      this.attachedProduct.set(null);
      this.productImage.set('');
      this.renderMarketingPoster();
    }
  }

  onLogoUpload(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.businessLogo.set(reader.result as string);
        this.renderMarketingPoster();
      };
      reader.readAsDataURL(file);
    }
  }

  onProductImageUpload(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.productImage.set(reader.result as string);
        this.renderMarketingPoster();
      };
      reader.readAsDataURL(file);
    }
  }

  generateSmartAICopy() {
    const spec = this.getSelectedCategorySpec();
    const purpose = this.posterPurpose();
    const shopName = this.businessName() || 'हमारी दुकान';

    let headline = spec.headline;
    let subtext = spec.subtext;
    let offer = spec.offer;
    let cta = spec.cta;

    switch (purpose) {
      case 'FESTIVAL_OFFER':
        headline = `🎉 ${spec.name} का पावन त्योहारी धमाका!`;
        subtext = `त्योहार के इस शुभ अवसर पर ${shopName} से खरीदारी करें और स्पेशल उपहार व महा डिस्काउंट पाएं!`;
        offer = `🎁 FESTIVE SPECIAL: UP TO 30% EXTRA OFF`;
        cta = `SHOP FESTIVAL OFFERS`;
        break;
      case 'DISCOUNT_SALE':
        headline = `🔥 MEGA DISCOUNT SALE IS LIVE! 🔥`;
        subtext = `सीमित समय का सबसे बड़ा ऑफर! अपने पसंदीदा सामान पर पाएं सबसे भारी बचत।`;
        offer = `💥 BUMPER SALE: FLAT 40% OFF`;
        cta = `GRAB DEAL NOW`;
        break;
      case 'NEW_ARRIVALS':
        headline = `✨ FRESH NEW STOCK ARRIVED! ✨`;
        subtext = `लेटेस्ट ट्रेंडिंग वैरायटी व नया स्टॉक पहुँचा है। आज ही विजिट करें या ऑर्डर करें!`;
        offer = `🌟 NEW ARRIVAL SPECIAL OFFER`;
        cta = `EXPLORE NEW STOCK`;
        break;
      case 'STORE_OPENING':
        headline = `🎉 GRAND INAUGURATION OFFER! 🎉`;
        subtext = `${shopName} में आपका हार्दिक स्वागत है! प्रथम 100 ग्राहकों के लिए विशेष उपहार व डिस्काउंट!`;
        offer = `🏬 INAUGURAL OFFER: FLAT 25% OFF`;
        cta = `VISIT US TODAY`;
        break;
      default:
        headline = spec.headline;
        subtext = spec.subtext;
        offer = spec.offer;
        cta = spec.cta;
    }

    this.headlineText.set(headline);
    this.subtextBody.set(subtext);
    this.offerTagline.set(offer);
    this.ctaText.set(cta);

    this.toast.success('AI Copywriter Ready! ⚡', 'कैटेगरी व कैम्पेन के अनुसार एजेंसी-ग्रेड विज्ञापन कॉपी तैयार हो गई है।');
    this.renderMarketingPoster();
  }

  setPosterFormat(fmt: 'SQUARE' | 'PORTRAIT' | 'STORY' | 'LANDSCAPE' | 'A4_PRINT') {
    this.posterFormat.set(fmt);
    switch (fmt) {
      case 'SQUARE':
        this.canvasWidth.set(1080);
        this.canvasHeight.set(1080);
        break;
      case 'PORTRAIT':
        this.canvasWidth.set(1080);
        this.canvasHeight.set(1440);
        break;
      case 'STORY':
        this.canvasWidth.set(1080);
        this.canvasHeight.set(1920);
        break;
      case 'LANDSCAPE':
        this.canvasWidth.set(1920);
        this.canvasHeight.set(1080);
        break;
      case 'A4_PRINT':
        this.canvasWidth.set(1240);
        this.canvasHeight.set(1754);
        break;
    }
    this.renderFestivalPoster();
  }

  renderFestivalPoster() {
    this.renderMarketingPoster();
  }

  // --- 🎨 SENIOR GRAPHIC DESIGNER & ART DIRECTOR CANVAS RENDER ENGINE ---
  async renderMarketingPoster() {
    this.isGenerating.set(true);
    try {
      const spec = this.getSelectedCategorySpec();
      const style = this.templateStyle();

      const W = this.canvasWidth();
      const H = this.canvasHeight();

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const shopName = this.businessName();
      const logo = this.businessLogo();
      const pImgSrc = this.productImage();
      const headline = this.headlineText() || spec.headline;
      const subtext = this.subtextBody() || spec.subtext;
      const offer = this.offerTagline() || spec.offer;
      const cta = this.ctaText() || spec.cta;
      const phone = this.contactNumber() || this.whatsappNumber();
      const addr = this.address();
      const web = this.website();

      // Execute Art-Directed Composition Pipeline
      switch (style) {
        case 'INDIAN_RETAIL_FLYER':
          await this.drawIndianRetailFlyerComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'EDITORIAL_ASYMMETRICAL':
          await this.drawEditorialAsymmetricalComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'CUTOUT_COMPOSITION':
          await this.drawCutoutComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'SPLIT_IMAGE_TYPO':
          await this.drawSplitImageTypoComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'TYPOGRAPHY_CAMPAIGN':
          await this.drawTypographyCampaignComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'MINIMAL_LUXURY':
          await this.drawMinimalLuxuryComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'DARK_PREMIUM_TECH':
          await this.drawDarkPremiumTechComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'LIFESTYLE_ADVERTISING':
          await this.drawLifestyleAdvertisingComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'HIGH_IMPACT_OFFER':
          await this.drawHighImpactOfferComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'STREET_POSTER_COLLAGE':
          await this.drawStreetPosterCollageComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'FESTIVAL':
          await this.drawFestivalRoyalComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
        case 'FULL_BLEED_HERO':
        default:
          await this.drawFullBleedHeroComposition(ctx, W, H, shopName, logo, pImgSrc, headline, subtext, offer, cta, phone, addr, web, spec);
          break;
      }

      // Draw subtle MKS Billing footer credit if enabled
      if (this.showMksBranding()) {
        this.drawSubtleMksCredit(ctx, W, H);
      }

      const dataUrl = canvas.toDataURL('image/png');
      this.posterDataUrl.set(dataUrl);
    } catch (err) {
      console.error('Error rendering agency marketing poster:', err);
    } finally {
      this.isGenerating.set(false);
    }
  }

  // --- 🇮🇳 CATEGORY AVAILABLE ITEMS REGISTRY FOR INDIAN RETAIL FLYER ---
  categoryAvailableItems: Record<string, string[]> = {
    KIRANA: ['Milk & Paneer', 'Atta & Rice', 'Dal & Pulses', 'Cooking Oil & Ghee', 'Spices & Salt', 'Tea & Coffee', 'Dry Fruits & Nuts', 'Soaps & Detergents', 'Snacks & Biscuits'],
    SUPERMARKET: ['Fresh Groceries', 'Packaged Foods', 'Beverages & Drinks', 'Personal Care', 'Cleaning Supplies', 'Dairy & Frozen', 'Chocolates & Sweets', 'Baby Care Products'],
    MEDICAL: ['Prescription Medicines', 'OTC Medicines', 'Vitamins & Supplements', 'First Aid Kits', 'Baby Care & Diapers', 'Health Devices', 'Personal Hygiene', 'Skin & Hair Care'],
    GARMENTS: ['Shirts & T-Shirts', 'Jeans & Trousers', 'Ethnic Sarees & Suits', 'Kids Wear Collection', 'Fancy Ladies Wear', 'Winter Jackets', 'Undergarments', 'Belts & Accessories'],
    FOOTWEAR: ['Sports & Running Shoes', 'Formal Leather Shoes', 'Ladies Sandals & Heels', 'Kids Casual Footwear', 'Daily Slippers & FlipFlops', 'Socks & Shoe Care'],
    MOBILE_ELECTRONICS: ['Smartphones 5G', 'Smartwatches & Bands', 'Bluetooth Earphones', 'Power Banks & Chargers', 'Mobile Covers & Glasses', 'Soundbars & Speakers'],
    COMPUTERS: ['Laptops & Desktops', 'Printers & Cartridges', 'Keyboards & Mice', 'Monitors & Cables', 'SSD & Hard Disks', 'Networking Devices'],
    HARDWARE: ['Paints & Wall Primer', 'Power Tools & Drills', 'Nuts, Bolts & Screws', 'Plywood & Laminates', 'Pipes & Fittings', 'Safety Gear & Gloves'],
    ELECTRICAL: ['LED Bulbs & Panel Lights', 'Ceiling & Exhaust Fans', 'Wires & Cables', 'Modular Switches', 'Inverters & Batteries', 'Decorative Lamps'],
    FURNITURE: ['Sofa Sets & Recliners', 'Double Beds & Mattresses', 'Dining Tables & Chairs', 'Wooden Wardrobes', 'Office Tables & Chairs', 'TV Cabinets'],
    JEWELLERY: ['100% Hallmark Gold', 'Diamond Necklaces', 'Silver Jewellery & Coins', 'Bridal Jewellery Sets', 'Bangles & Rings', 'Custom Design Order'],
    RESTAURANT: ['Paneer & Veg Special', 'Thali & Combo Meals', 'Chinese & Noodles', 'Soups & Starters', 'Rotis & Naans', 'Desserts & Cold Drinks'],
    CAFE: ['Cold & Hot Coffee', 'Thic Shakes & Mocktails', 'Burgers & Sandwiches', 'Cheese Pizzas & Fries', 'Waffles & Cakes', 'Pasta & Garlic Bread'],
    BAKERY: ['100% Eggless Cakes', 'Birthday & Party Cakes', 'Fresh Pastries', 'Cookies & Biscuits', 'Breads & Buns', 'Puffs & Patties'],
    SWEETS: ['Desi Ghee Kaju Katli', 'Gulab Jamun & Rasgulla', 'Special Laddu Range', 'Namkeen & Mixture', 'Samosa & Kachori', 'Gift Sweet Boxes'],
    SALON: ['Hair Cut & Styling', 'Facial & Skin Glow', 'Bridal Makeup Package', 'Hair Spa & Smoothing', 'Manicure & Pedicure', 'Beard Grooming'],
    GYM: ['Cardio & Weight Training', 'Personal Trainer', 'Fat Loss & Muscle Gain', 'Steam Bath & Locker', 'Diet & Nutrition Plan', 'Modern Gym Equipment'],
    AUTOMOBILE: ['Car & Bike Service', 'Engine Oil Change', 'Foam Wash & Polish', 'Wheel Alignment', 'AC Gas & Repair', 'Denting & Painting'],
    AUTOPARTS: ['Genuine Spare Parts', 'Branded Tyres & Tubes', 'Engine Oils & Lubricants', 'Batteries & Bulbs', 'Helmets & Accessories'],
    STATIONERY: ['School Textbooks & Guides', 'Notebooks & Registers', 'Pens & Art Colors', 'Office Files & Folders', 'School Bags & Boxes'],
    SANITARY: ['Luxury Bath Shower', 'Fancy Taps & Faucets', 'Basins & Commodes', 'CPVC & PVC Pipes', 'Bathroom Tiles & Mirror'],
    DAIRY: ['Pure Farm Milk', 'Fresh Curd & Butter', 'Paneer & Cream', 'Desi Ghee Packets', 'Flavored Milk & Lassi', 'Ice Creams'],
    GENERAL_STORE: ['Daily Need Items', 'Snacks & Soft Drinks', 'Soaps & Shampoo', 'Oral & Beauty Care', 'Stationery & Candles'],
    ELECTRONICS_HOME: ['Smart LED TVs', 'Refrigerators & Fridges', 'Washing Machines', 'Air Conditioners (AC)', 'Microwaves & Geysers'],
    CONSTRUCTION: ['TMT Steel Bars (Saraya)', 'Quality Cement Bags', 'Red Bricks & Blocks', 'Sand & Aggregate', 'Waterproofing Chemical'],
    REAL_ESTATE: ['Residential Plots', 'Commercial Shops', 'Independent Houses', 'Luxury Apartments', 'Bank Approved Projects'],
    EDUCATION: ['Class 9th to 12th', 'JEE & NEET Coaching', 'Competitive Exam Prep', 'Experienced Faculty', 'Test Series & Notes'],
    OTHER: ['High Quality Products', 'Professional Services', 'Best Price Guarantee', 'Customer Satisfaction', 'Special Discount Offer']
  };

  // --- 🇮🇳 COMPOSITION: ALL-IN-ONE INDIAN RETAIL FLYER (EXACT USER REFERENCE MATCH) ---
  private async drawIndianRetailFlyerComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    // 1. Warm Off-White / Parchment Cream Background
    ctx.fillStyle = '#faf8f4';
    ctx.fillRect(0, 0, W, H);

    // 2. Decorative Top-Left Fresh Green Foliage (Supermarket Flyer Aesthetic)
    ctx.save();
    ctx.fillStyle = 'rgba(34, 197, 94, 0.18)';
    ctx.beginPath();
    ctx.ellipse(W * 0.04, H * 0.03, W * 0.08, H * 0.025, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(22, 163, 74, 0.22)';
    ctx.beginPath();
    ctx.ellipse(W * 0.08, H * 0.04, W * 0.06, H * 0.02, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Top Scalloped Green & White Striped Canopy (Awning)
    const awningH = Math.max(34, Math.floor(H * 0.038));
    const stripeCount = 24;
    const stripeW = W / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#fefcf6';
      ctx.beginPath();
      ctx.rect(i * stripeW, 0, stripeW, awningH - 8);
      ctx.fill();
      // Scalloped curve at bottom of each stripe
      ctx.beginPath();
      ctx.arc(i * stripeW + stripeW / 2, awningH - 8, stripeW / 2, 0, Math.PI);
      ctx.fill();
    }
    // Canopy bottom drop shadow
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, awningH);
    ctx.lineTo(W, awningH);
    ctx.stroke();

    // 4. Top Tagline (✤ एक ही दुकान, संपूर्ण समाधान! ✤)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#991b1b';
    ctx.font = `800 ${Math.floor(W * 0.023)}px "Inter", sans-serif`;
    ctx.fillText('✤  एक ही दुकान, संपूर्ण समाधान!  ✤', W * 0.44, awningH + Math.floor(H * 0.028));
    ctx.restore();

    // 5. 3D Golden Medal / Rosette Stamp (Top Right)
    const sealX = W * 0.865;
    const sealY = awningH + Math.floor(H * 0.044);
    const sealR = Math.min(W * 0.076, H * 0.065);
    ctx.save();
    // Gold Rosette Serrated Teeth Outer Ring
    const teeth = 18;
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let t = 0; t < teeth; t++) {
      const angle = (t * Math.PI * 2) / teeth;
      const rOuter = sealR + 3;
      const rInner = sealR - 2;
      const x1 = sealX + Math.cos(angle) * rOuter;
      const y1 = sealY + Math.sin(angle) * rOuter;
      const x2 = sealX + Math.cos(angle + Math.PI / teeth) * rInner;
      const y2 = sealY + Math.sin(angle + Math.PI / teeth) * rInner;
      if (t === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner Red Circle
    const redGrad = ctx.createRadialGradient(sealX - 5, sealY - 5, 2, sealX, sealY, sealR * 0.82);
    redGrad.addColorStop(0, '#dc2626');
    redGrad.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = redGrad;
    ctx.beginPath();
    ctx.arc(sealX, sealY, sealR * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Text: "BEST QUALITY"
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(W * 0.015)}px "Poppins", sans-serif`;
    ctx.fillText('BEST QUALITY', sealX, sealY - sealR * 0.32);

    // Golden Ribbon Banner across lower middle
    const ribW_seal = sealR * 1.85;
    const ribH_seal = Math.max(18, Math.floor(sealR * 0.42));
    const ribY_seal = sealY + sealR * 0.02;
    const goldGrad = ctx.createLinearGradient(sealX - ribW_seal / 2, ribY_seal, sealX + ribW_seal / 2, ribY_seal);
    goldGrad.addColorStop(0, '#f59e0b');
    goldGrad.addColorStop(0.5, '#fef08a');
    goldGrad.addColorStop(1, '#d97706');
    ctx.fillStyle = goldGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    this.drawRoundRect(ctx, sealX - ribW_seal / 2, ribY_seal, ribW_seal, ribH_seal, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Text: "BEST PRICE"
    ctx.fillStyle = '#78350f';
    ctx.font = `900 ${Math.floor(W * 0.017)}px "Poppins", sans-serif`;
    ctx.fillText('BEST PRICE', sealX, ribY_seal + ribH_seal * 0.72);

    // Text: "EVERYDAY"
    ctx.fillStyle = '#fef08a';
    ctx.font = `800 ${Math.floor(W * 0.0135)}px "Poppins", sans-serif`;
    ctx.fillText('EVERYDAY', sealX, sealY + sealR * 0.75);
    ctx.restore();

    // 6. Main 3D Headline ("ALL IN ONE")
    const titleY = awningH + Math.floor(H * 0.075);
    ctx.save();
    ctx.textAlign = 'center';
    const mainTitle = 'ALL IN ONE';
    const titleFontSize = Math.floor(W * 0.068);
    ctx.font = `900 ${titleFontSize}px "Poppins", "Inter", sans-serif`;
    // White Stroke Outline for 3D POP
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.strokeText(mainTitle, W * 0.44, titleY);
    // Drop Shadow
    ctx.shadowColor = 'rgba(185, 28, 28, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#dc2626';
    ctx.fillText(mainTitle, W * 0.44, titleY);
    ctx.restore();

    // 7. Green Store Ribbon Banner
    const ribW = W * 0.68;
    const ribH = Math.max(34, Math.floor(H * 0.042));
    const ribX = (W - ribW) / 2;
    const ribY = titleY + Math.floor(H * 0.020);

    ctx.save();
    // Folded ribbon darker wings at ends
    ctx.fillStyle = '#0f5132';
    ctx.beginPath();
    ctx.moveTo(ribX - 10, ribY + 6);
    ctx.lineTo(ribX + 15, ribY + ribH + 6);
    ctx.lineTo(ribX + 15, ribY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ribX + ribW + 10, ribY + 6);
    ctx.lineTo(ribX + ribW - 15, ribY + ribH + 6);
    ctx.lineTo(ribX + ribW - 15, ribY);
    ctx.closePath();
    ctx.fill();

    // Main Forest Green Ribbon
    const ribGrad = ctx.createLinearGradient(ribX, ribY, ribX, ribY + ribH);
    ribGrad.addColorStop(0, '#16a34a');
    ribGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = ribGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.22)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    this.drawRoundRect(ctx, ribX, ribY, ribW, ribH, 8);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ribbon Text: "➔ KIRANA STORE ➔" or Shop Name
    const storeBannerName = shopName ? shopName.toUpperCase() : (spec.hindiName || 'KIRANA STORE').toUpperCase();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(W * 0.028)}px "Poppins", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`➔  ${storeBannerName}  ➔`, W / 2, ribY + ribH / 2);
    ctx.restore();

    // Subtext Tagline below Ribbon
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = `600 italic ${Math.floor(W * 0.019)}px "Inter", sans-serif`;
    const subline = subtext || 'Har Ghar ka Bharosa, Har Zaroorat ka Saathi';
    ctx.fillText(subline, W / 2, ribY + ribH + Math.floor(H * 0.025));
    ctx.restore();

    // 8. Middle 3-Column Section (Y: ~0.230 to 0.585)
    const midY = ribY + ribH + Math.floor(H * 0.038);
    const midH = Math.floor(H * 0.355);

    // --- COLUMN 1 (LEFT 31%): Product Hero / Realistic Grocery Basket ---
    const col1X = W * 0.035;
    const col1W = W * 0.315;

    ctx.save();
    // Card background with subtle shadow
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 6;
    this.drawRoundRect(ctx, col1X, midY, col1W, midH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Load user's uploaded product image or generated high-res grocery basket asset
    const basketSrc = pImgSrc || 'assets/images/retail_grocery_basket.jpg';
    let basketImg = await this.loadCanvasImage(basketSrc);
    if (basketImg) {
      ctx.save();
      this.drawRoundRect(ctx, col1X + 4, midY + 4, col1W - 8, midH - 8, 10);
      ctx.clip();
      // Draw image to fit nicely within card
      const imgAspect = basketImg.width / basketImg.height;
      const boxAspect = (col1W - 8) / (midH - 8);
      let drawW, drawH, drawX, drawY;
      if (imgAspect > boxAspect) {
        drawW = col1W - 8;
        drawH = drawW / imgAspect;
        drawX = col1X + 4;
        drawY = midY + 4 + (midH - 8 - drawH) / 2;
      } else {
        drawH = midH - 8;
        drawW = drawH * imgAspect;
        drawY = midY + 4;
        drawX = col1X + 4 + (col1W - 8 - drawW) / 2;
      }
      ctx.drawImage(basketImg, drawX, drawY, drawW, drawH);
      ctx.restore();
    }
    ctx.restore();

    // --- COLUMN 2 (CENTER 32%): Available Items Lined Notebook ---
    const col2X = W * 0.365;
    const col2W = W * 0.315;

    ctx.save();
    // Card Background
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#dcfce7';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 6;
    this.drawRoundRect(ctx, col2X, midY, col2W, midH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Green Pill Header: "हमारे पास उपलब्ध:"
    const pillH = Math.max(30, Math.floor(midH * 0.11));
    ctx.fillStyle = '#15803d';
    this.drawRoundRect(ctx, col2X, midY, col2W, pillH, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.floor(W * 0.020)}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('हमारे पास उपलब्ध:', col2X + col2W / 2, midY + pillH / 2);

    // Lined Notebook Paper Effect
    const itemsList = this.categoryAvailableItems[spec.id] || this.categoryAvailableItems['KIRANA'];
    const itemCount = Math.min(itemsList.length, 8);
    const contentH = midH - pillH - 12;
    const rowH = contentH / itemCount;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.floor(W * 0.0185)}px "Inter", sans-serif`;

    for (let i = 0; i < itemCount; i++) {
      const lineY = midY + pillH + 6 + i * rowH + rowH;
      // Faint ruling line
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(col2X + 8, lineY);
      ctx.lineTo(col2X + col2W - 8, lineY);
      ctx.stroke();

      // Bullet & Item text
      ctx.fillStyle = '#15803d';
      ctx.fillText('•', col2X + 12, lineY - rowH / 2);
      ctx.fillStyle = '#1e293b';
      ctx.fillText(itemsList[i], col2X + 26, lineY - rowH / 2);
    }
    ctx.restore();

    // --- COLUMN 3 (RIGHT 27%): SPECIAL OFFERS Red Box ---
    const col3X = W * 0.695;
    const col3W = W * 0.270;

    ctx.save();
    // Red Outer Card
    ctx.fillStyle = '#fef2f2';
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(220, 38, 38, 0.12)';
    ctx.shadowBlur = 6;
    this.drawRoundRect(ctx, col3X, midY, col3W, midH, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Red Header: "✦ SPECIAL OFFERS ✦"
    ctx.fillStyle = '#dc2626';
    this.drawRoundRect(ctx, col3X, midY, col3W, pillH, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.floor(W * 0.019)}px "Poppins", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦ SPECIAL OFFERS ✦', col3X + col3W / 2, midY + pillH / 2);

    // 4 White Mini Cards inside
    const offerBadges = [
      { icon: '%', title: 'BULK खरीदें', sub: 'ज्यादा बचत करें' },
      { icon: '👍', title: 'BEST QUALITY', sub: 'GUARANTEED' },
      { icon: '🎁', title: 'LOYALTY POINTS', sub: 'हर खरीद पर पाएं' },
      { icon: '⏱', title: 'FRESH STOCK', sub: 'हर दिन, हर समय' }
    ];
    const cardH = (contentH - 12) / 4;
    for (let b = 0; b < 4; b++) {
      const cardY = midY + pillH + 6 + b * cardH;
      // White inner card
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 1;
      this.drawRoundRect(ctx, col3X + 6, cardY, col3W - 12, cardH - 4, 6);
      ctx.fill();
      ctx.stroke();

      // Red icon badge on left
      ctx.fillStyle = '#dc2626';
      this.drawRoundRect(ctx, col3X + 10, cardY + (cardH - 4) * 0.18, 22, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(offerBadges[b].icon, col3X + 21, cardY + (cardH - 4) * 0.18 + 11);

      // Offer Text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#991b1b';
      ctx.font = `800 ${Math.floor(W * 0.0155)}px "Poppins", sans-serif`;
      ctx.fillText(offerBadges[b].title, col3X + 36, cardY + (cardH - 4) * 0.48);

      ctx.fillStyle = '#475569';
      ctx.font = `600 ${Math.floor(W * 0.013)}px "Inter", sans-serif`;
      ctx.fillText(offerBadges[b].sub, col3X + 36, cardY + (cardH - 4) * 0.82);
    }
    ctx.restore();

    // 9. Middle Highlight Banner (एक ही जगह, हर ज़रूरत का सामान!)
    const banY = midY + midH + Math.floor(H * 0.016);
    const banH = Math.max(44, Math.floor(H * 0.056));
    const banW = W * 0.93;
    const banX = (W - banW) / 2;

    ctx.save();
    // Warm Butter-Yellow Banner
    const banGrad = ctx.createLinearGradient(banX, banY, banX + banW, banY);
    banGrad.addColorStop(0, '#fef3c7');
    banGrad.addColorStop(0.5, '#fffbeb');
    banGrad.addColorStop(1, '#fef3c7');
    ctx.fillStyle = banGrad;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.15)';
    ctx.shadowBlur = 6;
    this.drawRoundRect(ctx, banX, banY, banW, banH, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // Green Cart Icon Badge on Left
    ctx.fillStyle = '#15803d';
    this.drawRoundRect(ctx, banX + 8, banY + 6, 42, banH - 12, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🛒', banX + 29, banY + banH / 2);

    // Banner Text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#78350f';
    ctx.font = `900 ${Math.floor(W * 0.028)}px "Poppins", "Inter", sans-serif`;
    ctx.fillText('एक ही जगह, हर ज़रूरत् का सामान!', W / 2 + 18, banY + banH * 0.48);

    ctx.fillStyle = '#92400e';
    ctx.font = `700 ${Math.floor(W * 0.016)}px "Inter", sans-serif`;
    ctx.fillText('DAILY ESSENTIALS   |   PREMIUM QUALITY   |   TRUSTED SERVICE', W / 2 + 18, banY + banH * 0.82);
    ctx.restore();

    // 10. Bottom Split Section: Left "क्यों खरीदें हमारे यहाँ?" + Right "TIPS TO SAVE MORE"
    const btmY = banY + banH + Math.floor(H * 0.016);
    const btmH = Math.max(110, Math.floor(H * 0.205));

    // --- LEFT SUB-SECTION: "क्यों खरीदें हमारे यहाँ?" (64% Width) ---
    const featX = W * 0.035;
    const featW = W * 0.640;

    ctx.save();
    // Outer Border
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#dcfce7';
    ctx.lineWidth = 1.5;
    this.drawRoundRect(ctx, featX, btmY, featW, btmH, 12);
    ctx.fill();
    ctx.stroke();

    // Green Top Pill
    const featPillH = Math.max(26, Math.floor(btmH * 0.16));
    ctx.fillStyle = '#15803d';
    this.drawRoundRect(ctx, featX, btmY, featW, featPillH, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.floor(W * 0.019)}px "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('क्यों खरीदें हमारे यहाँ?', featX + featW / 2, btmY + featPillH / 2);

    // 5 Feature Icons & Labels
    const features = [
      { icon: '🛡️', bg: '#16a34a', t1: '100% शुद्ध और', t2: 'अच्छी क्वालिटी' },
      { icon: '⚖️', bg: '#d97706', t1: 'सही नाप-तौल,', t2: 'पूरी ईमानदारी' },
      { icon: '🙂', bg: '#65a30d', t1: 'मुस्कान के साथ', t2: 'बेहतर व्यवहार' },
      { icon: '👛', bg: '#dc2626', t1: 'किफ़ायती दाम,', t2: 'हर बार बचत' },
      { icon: '🛍️', bg: '#047857', t1: 'एक ही दुकान,', t2: 'सभी सामान' }
    ];
    const featStep = featW / 5;
    const circleR = Math.min(22, Math.floor(featStep * 0.26));
    const circleY = btmY + featPillH + Math.floor((btmH - featPillH) * 0.35);

    for (let f = 0; f < 5; f++) {
      const fx = featX + f * featStep + featStep / 2;
      // Feature Circle
      ctx.fillStyle = features[f].bg;
      ctx.beginPath();
      ctx.arc(fx, circleY, circleR, 0, Math.PI * 2);
      ctx.fill();

      // Emoji / Icon
      ctx.fillStyle = '#ffffff';
      ctx.font = `${Math.floor(circleR * 0.95)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(features[f].icon, fx, circleY);

      // 2 Lines of Text below
      ctx.fillStyle = '#1e293b';
      ctx.font = `700 ${Math.floor(W * 0.014)}px "Inter", sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(features[f].t1, fx, circleY + circleR + 14);
      ctx.fillText(features[f].t2, fx, circleY + circleR + 26);
    }
    ctx.restore();

    // --- RIGHT SUB-SECTION: Pinned Yellow Sticky Notepad (28% Width) ---
    const noteX = W * 0.690;
    const noteW = W * 0.275;

    ctx.save();
    // Notepad Card with Soft Shadow
    ctx.fillStyle = '#fffbeb';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    this.drawRoundRect(ctx, noteX, btmY, noteW, btmH, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 3D Red Pushpin at top center
    const pinX = noteX + noteW / 2;
    const pinY = btmY + 8;
    // Pushpin shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(pinX + 2, pinY + 3, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pushpin head
    const pinGrad = ctx.createRadialGradient(pinX - 2, pinY - 2, 1, pinX, pinY, 6);
    pinGrad.addColorStop(0, '#f87171');
    pinGrad.addColorStop(0.6, '#dc2626');
    pinGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = pinGrad;
    ctx.beginPath();
    ctx.arc(pinX, pinY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Title: "TIPS TO SAVE MORE!"
    ctx.textAlign = 'center';
    ctx.fillStyle = '#78350f';
    ctx.font = `900 ${Math.floor(W * 0.017)}px "Poppins", sans-serif`;
    ctx.fillText('TIPS TO SAVE MORE!', noteX + noteW / 2, btmY + 26);

    // Tips Checkbox List
    const tips = [
      '☑️ लिस्ट बनाकर आएं, बचत करें',
      '☑️ कॉम्बो डील्स का फायदा उठाएं',
      '☑️ वफादार ग्राहक बनें छूट पाएं',
      '☑️ थोक में खरीदें, ज्यादा बचत करें'
    ];
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `600 ${Math.floor(W * 0.0135)}px "Inter", sans-serif`;
    const tipH = (btmH - 36) / 4;
    for (let t = 0; t < tips.length; t++) {
      ctx.fillText(tips[t], noteX + 10, btmY + 38 + t * tipH + tipH * 0.6);
    }
    ctx.restore();

    // 11. Dark Green Contact Footer (Guaranteed inside Canvas Height H)
    const ftH = Math.max(56, Math.floor(H * 0.088));
    const ftY = H - ftH;

    ctx.save();
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, ftY, W, ftH);

    // Top Contact Info Bar
    const line1 = `🛵 HOME DELIVERY AVAILABLE   |   📞 ORDER: ${phone || '98290XXXXX'}   |   📍 LOCATION: ${addr || 'MAIN MARKET'}`;
    this.drawAutoFitText(
      ctx, line1, W * 0.03, ftY + 6, W * 0.94, Math.floor(ftH * 0.42),
      Math.floor(W * 0.019), '800', '"Poppins", sans-serif', '#ffffff', 'center'
    );

    // Bottom Slogan & Software Branding
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.font = `700 ${Math.floor(W * 0.016)}px "Inter", sans-serif`;
    ctx.fillText('❖  Thank You for Choosing Us!  ❖', W / 2, ftY + Math.floor(ftH * 0.82));
    ctx.restore();
  }

  // --- COMPOSITION 1: FULL BLEED HERO COMPOSITION ---
  private async drawFullBleedHeroComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    let imgLoaded = false;
    if (pImgSrc) {
      const pImg = await this.loadCanvasImage(pImgSrc);
      if (pImg) {
        ctx.drawImage(pImg, 0, 0, W, H);
        imgLoaded = true;
      }
    }
    if (!imgLoaded) {
      this.drawProceduralCategoryHeroVisual(ctx, W, H, spec, 'FULL_BLEED');
    }

    // Gradient Overlay for dark vignette top & bottom
    const overlayGrad = ctx.createLinearGradient(0, 0, 0, H);
    overlayGrad.addColorStop(0, 'rgba(15, 23, 42, 0.85)');
    overlayGrad.addColorStop(0.25, 'rgba(15, 23, 42, 0.40)');
    overlayGrad.addColorStop(0.60, 'rgba(15, 23, 42, 0.70)');
    overlayGrad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, W, H);

    // 1. Brand Name Header Pill
    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'left', W * 0.08, H * 0.06);

    // 2. Main Headline Typography (Auto-scaled)
    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.08, H * 0.16, W * 0.84, H * 0.20,
      Math.floor(W * 0.052), '900', '"Poppins", sans-serif', '#ffffff', 'left', 16
    );

    // Subtext Body
    if (subtext) {
      this.drawAutoFitText(
        ctx, subtext, W * 0.08, nextY + 15, W * 0.84, H * 0.10,
        Math.floor(W * 0.024), '500', '"Inter", sans-serif', '#cbd5e1', 'left', 4
      );
    }

    // 3. Promotional Offer Badge Banner
    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.08, H * 0.65, W * 0.84, H * 0.12, true, spec);
    }

    // 4. Call-to-Action Pill
    this.drawCtaButton(ctx, cta, W * 0.08, H * 0.80, W * 0.38, H * 0.06, spec, 'left');

    // 5. Contact Footer
    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
  }

  // --- COMPOSITION 2: EDITORIAL ASYMMETRICAL ---
  private async drawEditorialAsymmetricalComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Right Diagonal Image Mask
    const imgX = W * 0.42;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(imgX + 80, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, H);
    ctx.lineTo(imgX - 40, H);
    ctx.closePath();
    ctx.clip();

    let imgLoaded = false;
    if (pImgSrc) {
      const pImg = await this.loadCanvasImage(pImgSrc);
      if (pImg) {
        ctx.drawImage(pImg, imgX - 60, 0, W * 0.65, H);
        imgLoaded = true;
      }
    }
    if (!imgLoaded) {
      this.drawProceduralCategoryHeroVisual(ctx, W, H, spec, 'ASYMMETRICAL');
    }

    const overlay = ctx.createLinearGradient(imgX, 0, W, 0);
    overlay.addColorStop(0, 'rgba(15, 23, 42, 0.8)');
    overlay.addColorStop(1, 'rgba(15, 23, 42, 0.2)');
    ctx.fillStyle = overlay;
    ctx.fillRect(imgX - 60, 0, W * 0.65, H);
    ctx.restore();

    // Left Content Area
    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'left', 50, H * 0.06);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), 50, H * 0.18, W * 0.45, H * 0.30,
      Math.floor(W * 0.050), '900', '"Poppins", sans-serif', '#ffffff', 'left', 12
    );

    if (subtext) {
      this.drawAutoFitText(
        ctx, subtext, 50, nextY + 15, W * 0.45, H * 0.12,
        Math.floor(W * 0.022), '500', '"Inter", sans-serif', '#94a3b8', 'left', 0
      );
    }

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, 50, H * 0.66, W * 0.46, H * 0.11, true, spec);
    }

    this.drawCtaButton(ctx, cta, 50, H * 0.80, W * 0.36, H * 0.06, spec, 'left');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 3: CUTOUT COMPOSITION ---
  private async drawCutoutComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    const rad = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, W * 0.85);
    rad.addColorStop(0, '#1e293b');
    rad.addColorStop(0.7, '#0f172a');
    rad.addColorStop(1, '#020617');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, W, H);

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'center', W / 2, H * 0.06);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.08, H * 0.15, W * 0.84, H * 0.15,
      Math.floor(W * 0.052), '900', '"Poppins", sans-serif', '#ffffff', 'center', 14
    );

    // Shadow Floor Oval
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.62, W * 0.35, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    let imgLoaded = false;
    if (pImgSrc) {
      const pImg = await this.loadCanvasImage(pImgSrc);
      if (pImg) {
        ctx.save();
        const imgSize = H * 0.28;
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 20;
        ctx.drawImage(pImg, (W - imgSize) / 2, H * 0.33, imgSize, imgSize);
        ctx.restore();
        imgLoaded = true;
      }
    }
    if (!imgLoaded) {
      this.drawProceduralCategoryHeroVisual(ctx, W, H, spec, 'CUTOUT');
    }

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.10, H * 0.68, W * 0.80, H * 0.10, true, spec);
    }

    this.drawCtaButton(ctx, cta, (W - W * 0.44) / 2, H * 0.80, W * 0.44, H * 0.06, spec, 'center');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 4: SPLIT IMAGE & EDITORIAL TYPOGRAPHY ---
  private async drawSplitImageTypoComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.rect(0, 0, W, H * 0.48);
    ctx.clip();

    let imgLoaded = false;
    if (pImgSrc) {
      const pImg = await this.loadCanvasImage(pImgSrc);
      if (pImg) {
        ctx.drawImage(pImg, 0, 0, W, H * 0.48);
        imgLoaded = true;
      }
    }
    if (!imgLoaded) {
      this.drawProceduralCategoryHeroVisual(ctx, W, H, spec, 'SPLIT');
    }
    ctx.restore();

    // Divider bar
    const divGrad = ctx.createLinearGradient(0, 0, W, 0);
    divGrad.addColorStop(0, spec.primaryColor);
    divGrad.addColorStop(0.5, spec.accentColor || '#fde047');
    divGrad.addColorStop(1, spec.secondaryColor);
    ctx.fillStyle = divGrad;
    ctx.fillRect(0, H * 0.48 - 4, W, 6);

    // Bottom Half Content
    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'left', W * 0.08, H * 0.52);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.08, H * 0.60, W * 0.84, H * 0.12,
      Math.floor(W * 0.048), '900', '"Poppins", sans-serif', '#ffffff', 'left', 10
    );

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.08, nextY + 12, W * 0.84, H * 0.10, true, spec);
    }

    this.drawCtaButton(ctx, cta, W * 0.08, H * 0.82, W * 0.40, H * 0.055, spec, 'left');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 5: TYPOGRAPHY CAMPAIGN ---
  private async drawTypographyCampaignComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, spec.bgGradient[0]);
    bgGrad.addColorStop(0.5, spec.bgGradient[1]);
    bgGrad.addColorStop(1, spec.bgGradient[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'center', W / 2, H * 0.08);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.06, H * 0.18, W * 0.88, H * 0.32,
      Math.floor(W * 0.065), '900', '"Poppins", sans-serif', '#ffffff', 'center', 18
    );

    if (subtext) {
      this.drawAutoFitText(
        ctx, subtext, W * 0.08, nextY + 15, W * 0.84, H * 0.12,
        Math.floor(W * 0.026), '500', '"Inter", sans-serif', '#e2e8f0', 'center', 4
      );
    }

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.08, H * 0.65, W * 0.84, H * 0.12, true, spec);
    }

    this.drawCtaButton(ctx, cta, (W - W * 0.44) / 2, H * 0.81, W * 0.44, H * 0.06, spec, 'center');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 6: MINIMAL LUXURY ---
  private async drawMinimalLuxuryComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, H);

    // Fine Gold Border Frame
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.strokeRect(34, 34, W - 68, H - 68);

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'center', W / 2, H * 0.08, true);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.10, H * 0.20, W * 0.80, H * 0.24,
      Math.floor(W * 0.048), '800', '"Poppins", sans-serif', '#0f172a', 'center', 0
    );

    if (subtext) {
      this.drawAutoFitText(
        ctx, subtext, W * 0.10, nextY + 15, W * 0.80, H * 0.10,
        Math.floor(W * 0.024), '500', '"Inter", sans-serif', '#475569', 'center', 0
      );
    }

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.10, H * 0.62, W * 0.80, H * 0.12, false, spec);
    }

    this.drawCtaButton(ctx, cta, (W - W * 0.44) / 2, H * 0.80, W * 0.44, H * 0.06, spec, 'center', true);

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web, true);
    ctx.restore();
  }

  // --- COMPOSITION 7: DARK PREMIUM TECH ---
  private async drawDarkPremiumTechComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);

    // Glowing Neon Spotlight
    const glow = ctx.createRadialGradient(W / 2, H * 0.35, 10, W / 2, H * 0.35, 480);
    glow.addColorStop(0, 'rgba(56, 189, 248, 0.30)');
    glow.addColorStop(0.6, 'rgba(124, 58, 237, 0.15)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.35, 480, 0, Math.PI * 2);
    ctx.fill();

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'center', W / 2, H * 0.08);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.08, H * 0.18, W * 0.84, H * 0.22,
      Math.floor(W * 0.054), '900', '"Poppins", sans-serif', '#ffffff', 'center', 18
    );

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.08, H * 0.62, W * 0.84, H * 0.12, true, spec);
    }

    this.drawCtaButton(ctx, cta, (W - W * 0.44) / 2, H * 0.80, W * 0.44, H * 0.06, spec, 'center');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 8: LIFESTYLE ADVERTISING ---
  private async drawLifestyleAdvertisingComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#78350f');
    grad.addColorStop(0.5, '#451a03');
    grad.addColorStop(1, '#1c0a00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'left', W * 0.08, H * 0.08);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.08, H * 0.20, W * 0.84, H * 0.24,
      Math.floor(W * 0.052), '900', '"Poppins", sans-serif', '#ffffff', 'left', 14
    );

    if (subtext) {
      this.drawAutoFitText(
        ctx, subtext, W * 0.08, nextY + 15, W * 0.84, H * 0.12,
        Math.floor(W * 0.024), '500', '"Inter", sans-serif', '#fde68a', 'left', 2
      );
    }

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.08, H * 0.64, W * 0.84, H * 0.12, true, spec);
    }

    this.drawCtaButton(ctx, cta, W * 0.08, H * 0.80, W * 0.40, H * 0.06, spec, 'left');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 9: HIGH IMPACT OFFER ---
  private async drawHighImpactOfferComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#dc2626');
    grad.addColorStop(0.5, '#991b1b');
    grad.addColorStop(1, '#450a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'center', W / 2, H * 0.08);

    this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.06, H * 0.18, W * 0.88, H * 0.15,
      Math.floor(W * 0.048), '900', '"Poppins", sans-serif', '#fde047', 'center', 10
    );

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.06, H * 0.36, W * 0.88, H * 0.34, true, spec);
    }

    this.drawCtaButton(ctx, cta, (W - W * 0.46) / 2, H * 0.80, W * 0.46, H * 0.06, spec, 'center');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 10: STREET POSTER COLLAGE ---
  private async drawStreetPosterCollageComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Tilted background banner slash
    ctx.save();
    ctx.rotate((-4 * Math.PI) / 180);
    ctx.fillStyle = spec.primaryColor;
    ctx.fillRect(-50, H * 0.22, W + 100, H * 0.44);
    ctx.restore();

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'center', W / 2, H * 0.08);

    this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.08, H * 0.24, W * 0.84, H * 0.20,
      Math.floor(W * 0.054), '900', '"Poppins", sans-serif', '#ffffff', 'center', 16
    );

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.08, H * 0.62, W * 0.84, H * 0.12, true, spec);
    }

    this.drawCtaButton(ctx, cta, (W - W * 0.44) / 2, H * 0.80, W * 0.44, H * 0.06, spec, 'center');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- COMPOSITION 11: FESTIVAL ROYAL ---
  private async drawFestivalRoyalComposition(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    shopName: string, logo: string, pImgSrc: string,
    headline: string, subtext: string, offer: string, cta: string,
    phone: string, addr: string, web: string, spec: CategorySpec
  ) {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#3d0743');
    grad.addColorStop(0.5, '#5c0b62');
    grad.addColorStop(1, '#210224');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Toran Bunting Garland
    const count = Math.ceil(W / 45);
    const wStep = W / count;
    const colors = ['#f59e0b', '#fef08a', '#ec4899', '#ea580c'];
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.quadraticCurveTo(W / 2, 55, W, 20);
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      const x1 = i * wStep;
      const x2 = (i + 1) * wStep;
      const xMid = (x1 + x2) / 2;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(x1, 20);
      ctx.lineTo(x2, 20);
      ctx.lineTo(xMid, 60);
      ctx.closePath();
      ctx.fill();
    }

    this.drawHeaderBrandBadge(ctx, W, H, shopName, spec, 'center', W / 2, H * 0.11);

    const nextY = this.drawAutoFitText(
      ctx, headline.toUpperCase(), W * 0.08, H * 0.22, W * 0.84, H * 0.24,
      Math.floor(W * 0.052), '900', '"Poppins", sans-serif', '#ffffff', 'center', 16
    );

    if (offer) {
      this.drawPromotionalOfferBadge(ctx, offer, W * 0.08, H * 0.64, W * 0.84, H * 0.12, true, spec);
    }

    this.drawCtaButton(ctx, cta, (W - W * 0.44) / 2, H * 0.80, W * 0.44, H * 0.06, spec, 'center');

    this.drawMinimalContactFooter(ctx, W, H, phone, addr, web);
    ctx.restore();
  }

  // --- 📸 PROCEDURAL HIGH-END CATEGORY PHOTOGRAPHY VISUAL ENGINE ---
  private drawProceduralCategoryHeroVisual(ctx: CanvasRenderingContext2D, W: number, H: number, spec: CategorySpec, mode: string) {
    ctx.save();
    const cat = spec.id;

    // Background Studio Environment
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, spec.bgGradient[0]);
    bgGrad.addColorStop(0.5, spec.bgGradient[1]);
    bgGrad.addColorStop(1, spec.bgGradient[2]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Glowing Ambient Halo Radial Spotlight
    const spotlight = ctx.createRadialGradient(W / 2, H * 0.45, 20, W / 2, H * 0.45, W * 0.50);
    spotlight.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    spotlight.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
    spotlight.addColorStop(1, 'transparent');
    ctx.fillStyle = spotlight;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.45, W * 0.50, 0, Math.PI * 2);
    ctx.fill();

    // 3D Pedestal Oval Platform with Floor Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.56, W * 0.25, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Concentric Glowing Gold / Neon Emblem Rings
    ctx.strokeStyle = spec.accentColor || '#fde047';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.44, 95, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.44, 110, 0, Math.PI * 2);
    ctx.stroke();

    // Multi-Layer Centerpiece Category Icon / Emoji
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 95px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText(spec.emoji, W / 2, H * 0.44);

    // Floating Decorative Sparkles
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('✨', W / 2 - 130, H * 0.38);
    ctx.fillText('✦', W / 2 + 135, H * 0.48);
    ctx.fillText('🌟', W / 2 + 120, H * 0.36);
    ctx.fillText('✨', W / 2 - 120, H * 0.50);

    ctx.restore();
  }

  // --- 🏷️ ULTRA-PREMIUM PROMOTIONAL OFFER BADGE / SEAL RENDERER ---
  private drawPromotionalOfferBadge(
    ctx: CanvasRenderingContext2D, offerText: string,
    x: number, y: number, maxW: number, maxH: number,
    isDark: boolean, spec: CategorySpec
  ) {
    ctx.save();

    // Badge Dimensions
    const bW = maxW;
    const bH = maxH;
    const bY = y;

    // Glowing 3D Glassmorphism / Metallic Gradient Box Background
    const badgeGrad = ctx.createLinearGradient(x, bY, x + bW, bY + bH);
    if (isDark) {
      badgeGrad.addColorStop(0, '#f59e0b');
      badgeGrad.addColorStop(0.5, '#d97706');
      badgeGrad.addColorStop(1, '#b45309');
    } else {
      badgeGrad.addColorStop(0, '#1e293b');
      badgeGrad.addColorStop(0.5, '#0f172a');
      badgeGrad.addColorStop(1, '#020617');
    }

    // Outer Drop Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = badgeGrad;
    this.drawRoundRect(ctx, x, bY, bW, bH, 18);
    ctx.fill();

    // Shiny Metallic / Gold Border Outline
    ctx.shadowBlur = 0;
    ctx.strokeStyle = isDark ? '#fef08a' : '#d4af37';
    ctx.lineWidth = 3;
    this.drawRoundRect(ctx, x + 2, bY + 2, bW - 4, bH - 4, 16);
    ctx.stroke();

    // Offer Text Inside Badge (Auto-scaled)
    const textColor = isDark ? '#000000' : '#ffffff';
    this.drawAutoFitText(
      ctx, offerText.toUpperCase(), x + 16, bY + bH * 0.18, bW - 32, bH * 0.64,
      Math.floor(bH * 0.45), '900', '"Poppins", sans-serif', textColor, 'center', 0
    );

    ctx.restore();
  }

  // --- 🏢 BRAND NAME HEADER BADGE RENDERER ---
  private drawHeaderBrandBadge(
    ctx: CanvasRenderingContext2D, W: number, H: number, shopName: string,
    spec: CategorySpec, align: 'left' | 'center' = 'left', xPos: number, yPos: number, isDarkText: boolean = false
  ) {
    ctx.save();
    ctx.textAlign = align;

    // Shop Name Typography
    const fontSize = Math.floor(W * 0.040);
    ctx.font = `900 ${fontSize}px "Poppins", sans-serif`;
    ctx.fillStyle = isDarkText ? '#0f172a' : '#ffffff';
    ctx.shadowColor = isDarkText ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText(shopName.toUpperCase(), xPos, yPos);

    // Accent Underline Bar
    const textWidth = ctx.measureText(shopName.toUpperCase()).width;
    const lineW = Math.min(textWidth, W * 0.40);
    const lineX = align === 'center' ? xPos - lineW / 2 : xPos;

    ctx.fillStyle = spec.primaryColor;
    ctx.fillRect(lineX, yPos + 8, lineW, 4);
    ctx.restore();
  }

  // --- 🔘 CTA BUTTON RENDERER ---
  private drawCtaButton(
    ctx: CanvasRenderingContext2D, ctaText: string,
    x: number, y: number, w: number, h: number,
    spec: CategorySpec, align: 'left' | 'center' = 'left', isOutline: boolean = false
  ) {
    ctx.save();
    const btnX = align === 'center' ? (ctx.canvas.width - w) / 2 : x;

    if (!isOutline) {
      const grad = ctx.createLinearGradient(btnX, y, btnX + w, y + h);
      grad.addColorStop(0, spec.primaryColor);
      grad.addColorStop(1, spec.secondaryColor);
      ctx.fillStyle = grad;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 14;
      this.drawRoundRect(ctx, btnX, y, w, h, h / 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
    } else {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      this.drawRoundRect(ctx, btnX, y, w, h, h / 2);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
    }

    ctx.font = `800 ${Math.floor(h * 0.45)}px "Poppins", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(`${ctaText}  ➔`, btnX + w / 2, y + h / 2 + 1);

    ctx.restore();
  }

  // --- 📏 DYNAMIC AUTO-FITTING TEXT ENGINE (NO OVERFLOW GUARANTEE) ---
  private drawAutoFitText(
    ctx: CanvasRenderingContext2D, text: string,
    x: number, y: number, maxW: number, maxH: number,
    baseFontSize: number, fontWeight: string, fontStack: string,
    color: string, align: 'left' | 'center' | 'right' = 'left', shadowBlur: number = 0
  ): number {
    if (!text) return y;

    ctx.save();
    let currentFontSize = baseFontSize;
    let lines: string[] = [];
    let lineHeight = currentFontSize * 1.25;

    // Iteratively decrease font size until text cleanly fits inside maxW and maxH
    while (currentFontSize >= 12) {
      ctx.font = `${fontWeight} ${currentFontSize}px ${fontStack}`;
      lineHeight = currentFontSize * 1.22;
      lines = [];

      const words = text.split(' ');
      let currentLine = '';

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
        if (ctx.measureText(testLine).width > maxW && currentLine) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const totalHeight = lines.length * lineHeight;
      if (totalHeight <= maxH) {
        break;
      }
      currentFontSize -= 2;
    }

    ctx.font = `${fontWeight} ${currentFontSize}px ${fontStack}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    if (shadowBlur > 0) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = shadowBlur;
    }

    let drawY = y + currentFontSize * 0.85;
    const textX = align === 'center' ? x + maxW / 2 : (align === 'right' ? x + maxW : x);

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textX, drawY);
      drawY += lineHeight;
    }

    ctx.restore();
    return drawY;
  }

  // --- 📞 MINIMAL EXECUTIVE CONTACT FOOTER ---
  private drawMinimalContactFooter(
    ctx: CanvasRenderingContext2D, W: number, H: number,
    phone: string, addr: string, web: string, isDarkText: boolean = false
  ) {
    ctx.save();
    const footerY = H * 0.92;

    ctx.strokeStyle = isDarkText ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W * 0.08, footerY);
    ctx.lineTo(W * 0.92, footerY);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = isDarkText ? '#334155' : '#cbd5e1';
    ctx.font = `600 ${Math.floor(W * 0.022)}px "Inter", sans-serif`;
    const contactLine = `${phone ? '📞 ' + phone : ''} ${addr ? '  •  📍 ' + addr : ''} ${web ? '  •  🌐 ' + web : ''}`;
    ctx.fillText(contactLine || '📞 Contact Us & Visit Store Today', W / 2, footerY + (H - footerY) * 0.5);
    ctx.restore();
  }

  // --- 🏷️ SUBTLE MKS BILLING FOOTER CREDIT ---
  private drawSubtleMksCredit(ctx: CanvasRenderingContext2D, W: number, H: number) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
    ctx.font = `500 ${Math.floor(W * 0.015)}px "Inter", sans-serif`;
    ctx.fillText('Powered by MKS Billing Software • Smart Business Management', W / 2, H - 12);
    ctx.restore();
  }

  private loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => resolve(null), 1500);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = src;
    });
  }

  private drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
    if (!text) return y;
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
    return currentY;
  }

  // --- ACTIONS ---
  downloadPoster() {
    const dataUrl = this.posterDataUrl();
    if (!dataUrl) return;
    const spec = this.getSelectedCategorySpec();
    const name = (this.businessName() || 'Shop').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const cat = spec.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const link = document.createElement('a');
    link.download = `${name}_${cat}_Marketing_Poster.png`;
    link.href = dataUrl;
    link.click();
    this.toast.success('Poster Downloaded!', 'HD AI मार्केटिंग पोस्टर सफलतापूर्वक डाउनलोड हो गया है।');
  }

  async copyPosterToClipboard() {
    const dataUrl = this.posterDataUrl();
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      this.toast.success('Copied to Clipboard! 📋', 'पोस्टर क्लिपबोर्ड में कॉपी हो गया है! WhatsApp / Instagram पर Ctrl+V से पेस्ट करें।');
    } catch (e) {
      this.toast.info('Copy Image', 'इमेज पर राइट-क्लिक करके "Copy Image" चुनें।');
    }
  }

  shareOnWhatsApp() {
    const text = `📢 *${this.businessName()} - ${this.headlineText()}*\n\n✨ ${this.subtextBody()}\n💥 *${this.offerTagline()}*\n\n📍 ${this.address()}\n📞 ${this.contactNumber()}\n\nPowered by MKS Billing Software`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    this.toast.success('WhatsApp Opened', 'मैसेज टेक्स्ट तैयार है! पोस्टर इमेज कॉपी करके Ctrl+V से भेजें।');
  }
}
