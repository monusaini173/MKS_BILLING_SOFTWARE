import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import * as QRCode from 'qrcode';
import { ApiService } from '../core/services/api.service';
import { AuthService, Shop } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { SubscriptionService } from '../core/services/subscription.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './products.component.html'
})
export class ProductsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  protected auth = inject(AuthService);
  protected subService = inject(SubscriptionService);
  private toast = inject(ToastService);

  shop = this.auth.currentShop;
  products = signal<any[]>([]);
  categories = signal<any[]>([]);
  brands = signal<any[]>([]);
  customers = signal<any[]>([]);
  loading = signal(true);
  submitting = signal(false);

  showModal = signal(false);
  editMode = signal(false);
  selectedProduct = signal<any | null>(null);

  // Stock Filter & Search state
  stockFilter = signal<'ALL' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  searchQuery = signal<string>('');

  lowStockCount = computed(() => {
    return this.products().filter(p => p.quantity <= (p.minStockLevel || 5)).length;
  });

  outOfStockCount = computed(() => {
    return this.products().filter(p => p.quantity <= 0).length;
  });

  filteredProducts = computed(() => {
    const filter = this.stockFilter();
    const q = this.searchQuery().toLowerCase().trim();
    let list = this.products();

    if (filter === 'LOW_STOCK') {
      list = list.filter(p => p.quantity <= (p.minStockLevel || 5));
    } else if (filter === 'OUT_OF_STOCK') {
      list = list.filter(p => p.quantity <= 0);
    }

    if (q) {
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.genericName && p.genericName.toLowerCase().includes(q)) ||
        (p.company && p.company.toLowerCase().includes(q)) ||
        (p.batchNumber && p.batchNumber.toLowerCase().includes(q)) ||
        (p.imeiNumber && p.imeiNumber.toLowerCase().includes(q)) ||
        (p.rackLocation && p.rackLocation.toLowerCase().includes(q))
      );
    }

    return list;
  });

  // WhatsApp Marketing / Broadcast State
  showBroadcastModal = signal(false);
  isWhatsAppBotReady = signal<boolean>(false);
  isCheckingWhatsApp = signal<boolean>(false);
  private whatsappPollTimer: any = null;
  private windowMessageListener: any = null;

  broadcastProduct = signal<any>({
    name: '',
    mrp: 0,
    sellingPrice: 0,
    size: '',
    color: '',
    fabric: '',
    image: '',
    category: ''
  });
  broadcastTemplate = signal<'NEW_ARRIVAL' | 'MEGA_DISCOUNT' | 'LIMITED_STOCK' | 'FESTIVAL' | 'CUSTOM'>('NEW_ARRIVAL');
  broadcastMessage = signal<string>('');
  broadcastImagePreview = signal<string>('');
  customerSendStatus = signal<{ [key: string]: boolean }>({});
  customBroadcastPhone = signal<string>('');
  selectedCustomerIds = signal<string[]>([]);
  activeBatchIndex = signal<number>(-1);
  isBatchRunning = signal<boolean>(false);

  // 🪔 30+ Major Hindu Festivals List (प्रमुख हिंदू त्योहार)
  selectedFestivalId = signal<string>('DIWALI');
  festivalSearch = signal<string>('');

  // 🎨 Instagram Festival Poster Generator State
  posterStyle = signal<'FESTIVE_PURPLE_MANDALA' | 'ROYAL_GOLD' | 'FESTIVE_VIBRANT' | 'DARK_LUXURY' | 'MODERN_GLASS'>('FESTIVE_PURPLE_MANDALA');
  posterCustomWish = signal<string>('');
  posterCustomOffer = signal<string>('');
  includeProductOnPoster = signal<boolean>(true);
  posterCanvasDataUrl = signal<string>('');
  isGeneratingPoster = signal<boolean>(false);
  posterTabActive = signal<boolean>(true);
  festivalsList: any[] = [
    { id: 'MAKAR_SANKRANTI', name: 'मकर संक्रांति', emoji: '🪁', greeting: 'मकर संक्रांति की हार्दिक शुभकामनाएं! पतंगों के इस उत्सव पर सूर्य देव आपके जीवन में नई उमंग व ऊर्जा का संचार करें।', blessing: 'मकर संक्रांति स्पेशल महा ऑफर: नए स्टॉक पर पाएं भारी डिस्काउंट व विशेष छूट!', badgeColor: '#ea580c' },
    { id: 'VASANT_PANCHAMI', name: 'वसंत पंचमी', emoji: '🌸', greeting: 'वसंत पंचमी व माँ सरस्वती पूजा की हार्दिक शुभकामनाएं! माँ शारदा आपको विद्या, ज्ञान व समृद्धि प्रदान करें।', blessing: 'वसंत पंचमी के शुभ अवसर पर पाएं विशेष त्योहारी छूट!', badgeColor: '#eab308' },
    { id: 'MAHASHIVRATRI', name: 'महाशिवरात्रि', emoji: '🔱', greeting: 'महाशिवरात्रि की हार्दिक शुभकामनाएं! देवाधिदेव महादेव व माता पार्वती की असीम कृपा आप पर सदा बनी रहे।', blessing: 'हर हर महादेव! पावन शिवरात्रि पर पाएं विशेष खरीदारी ऑफर!', badgeColor: '#0284c7' },
    { id: 'HOLI', name: 'होली (Holi)', emoji: '🌈', greeting: 'रंगों के महापर्व होली की आप और आपके परिवार को हार्दिक शुभकामनाएं! जीवन में खुशियों के सभी रंग खिलें।', blessing: 'होली स्पेशल धमाकेदार ऑफर: नए फैंसी स्टॉक पर महा डिस्काउंट उपलब्ध है!', badgeColor: '#dc2626' },
    { id: 'RAM_NAVAMI', name: 'राम नवमी', emoji: '🚩', greeting: 'श्री राम नवमी की मंगलमय शुभकामनाएं! मर्यादा पुरुषोत्तम भगवान श्री राम का आशीर्वाद सदा बना रहे।', blessing: 'जय श्री राम! राम नवमी के पावन पर्व पर विशेष त्योहारी ऑफर!', badgeColor: '#ea580c' },
    { id: 'HANUMAN_JAYANTI', name: 'हनुमान जयंती', emoji: '🐒', greeting: 'हनुमान जयंती की हार्दिक शुभकामनाएं! संकटमोचन श्री हनुमान जी आपके सभी कष्टों का निवारण करें।', blessing: 'जय बजरंगबली! हनुमान जन्मोत्सव पर विशेष त्योहारी छूट उपलब्ध है!', badgeColor: '#c2410c' },
    { id: 'AKSHAYA_TRITIYA', name: 'अक्षय तृतीया (आखा तीज)', emoji: '🌿', greeting: 'अक्षय तृतीया की हार्दिक शुभकामनाएं! आपके जीवन में सुख, समृद्धि और सौभाग्य का कभी क्षय न हो।', blessing: 'अक्षय तृतीया के अबूझ सावे पर शुभ खरीदारी करें और महा बचत का लाभ उठाएं!', badgeColor: '#15803d' },
    { id: 'BUDDHA_PURNIMA', name: 'बुद्ध पूर्णिमा', emoji: '🌺', greeting: 'बुद्ध पूर्णिमा की हार्दिक शुभकामनाएं! भगवान बुद्ध की शिक्षाएं आपके जीवन में शांति व प्रेम लाएं।', blessing: 'बुद्ध पूर्णिमा के पावन अवसर पर विशेष खरीदारी छूट!', badgeColor: '#d97706' },
    { id: 'NAG_PANCHAMI', name: 'नाग पंचमी', emoji: '🐍', greeting: 'नाग पंचमी की हार्दिक शुभकामनाएं! नाग देवता आपके परिवार की सदैव रक्षा करें व मंगल करें।', blessing: 'नाग पंचमी के पावन पर्व पर विशेष त्योहारी ऑफर!', badgeColor: '#059669' },
    { id: 'RAKSHA_BANDHAN', name: 'रक्षाबंधन', emoji: '🪢', greeting: 'रक्षाबंधन के पावन पर्व की हार्दिक शुभकामनाएं! भाई-बहन के इस पवित्र व अटूट रिश्ते में सदैव प्यार बना रहे।', blessing: 'राखी स्पेशल ऑफर: अपनी प्यारी बहना व परिवार के लिए स्पेशल गिफ्ट्स पर भारी छूट!', badgeColor: '#db2777' },
    { id: 'GANESH_CHATURTHI', name: 'गणेश चतुर्थी', emoji: '🐘', greeting: 'गणेश चतुर्थी की हार्दिक शुभकामनाएं! विघ्नहर्ता भगवान श्री गणेश आपके जीवन के सभी विघ्न दूर करें।', blessing: 'गणपति बप्पा मोरया! गणेशोत्सव के पावन अवसर पर विशेष खरीदारी डिस्काउंट!', badgeColor: '#e11d48' },
    { id: 'JANMASHTAMI', name: 'श्री कृष्ण जन्माष्टमी', emoji: '🌼', greeting: 'श्री कृष्ण जन्माष्टमी की हार्दिक शुभकामनाएं! नटखट बाल गोपाल आपके जीवन में आनंद और खुशियां भरें।', blessing: 'हाथी घोड़ा पालकी, जय कन्हैया लाल की! जन्माष्टमी स्पेशल ऑफर!', badgeColor: '#2563eb' },
    { id: 'NAVRATRI', name: 'नवरात्रि (Durga Puja)', emoji: '🪔', greeting: 'शुभ नवरात्रि! माँ अम्बे आपके घर में सुख, शांति, शक्ति, स्वास्थ्य और समृद्धि का वरदान दें।', blessing: 'जय माता दी! नवरात्रि व फेस्टिव सीजन पर पाएं महा डिस्काउंट और स्पेशल ऑफर्स!', badgeColor: '#dc2626' },
    { id: 'DUSSEHRA', name: 'दशहरा / विजयादशमी', emoji: '🏹', greeting: 'विजयादशमी (दशहरा) की हार्दिक शुभकामनाएं! अधर्म पर धर्म और बुराई पर अच्छाई की विजय हो।', blessing: 'दशहरा व विजय उत्सव पर नई खरीदारी पर पाएं धमाकेदार डिस्काउंट!', badgeColor: '#d97706' },
    { id: 'DHANTERAS', name: 'धनतेरस', emoji: '🪔', greeting: 'धनतेरस की हार्दिक शुभकामनाएं! भगवान धनवंतरी व कुबेर देव आपके घर में धन-धान्य और आरोग्य भरें।', blessing: 'धनतेरस पर शुभ खरीदारी करें और पाएं महा बचत त्योहारी डिस्काउंट!', badgeColor: '#ca8a04' },
    { id: 'DIWALI', name: 'दीपावली (Deepawali)', emoji: '🪔', greeting: 'शुभ दीपावली! दीपों का यह महापर्व आपके जीवन को सुख, समृद्धि, वैभव और खुशियों से आलोकित करे।', blessing: 'दीपावली महा धमाका सेल: सभी नए कलेक्शन पर विशेष त्योहारी डिस्काउंट व उपहार!', badgeColor: '#d97706' },
    { id: 'GOVARDHAN_PUJA', name: 'गोवर्धन पूजा / अन्नकूट', emoji: '🌙', greeting: 'गोवर्धन पूजा व अन्नकूट महोत्सव की हार्दिक शुभकामनाएं! भगवान श्री कृष्ण की कृपा आप पर सदा बनी रहे।', blessing: 'गोवर्धन पूजा के पावन पर्व पर विशेष खरीदारी ऑफर!', badgeColor: '#059669' },
    { id: 'BHAI_DOOJ', name: 'भाई दूज', emoji: '🙏', greeting: 'भाई दूज (यम द्वितीया) के पावन पर्व की हार्दिक शुभकामनाएं! भाई-बहन के स्नेह का बंधन सदा अटूट रहे।', blessing: 'भाई दूज स्पेशल ऑफर: नए आइटम्स पर पाएं विशेष डिस्काउंट!', badgeColor: '#7c3aed' },
    { id: 'CHHATH_PUJA', name: 'छठ पूजा', emoji: '🌞', greeting: 'लोक आस्था के महापर्व छठ पूजा की हार्दिक शुभकामनाएं! छठी मईया व भगवान सूर्य देव आप पर कृपा बनाए रखें।', blessing: 'जय छठी मईया! छठ महापर्व पर पाएं विशेष त्योहारी खरीदारी ऑफर!', badgeColor: '#ea580c' },
    { id: 'KARWA_CHAUTH', name: 'करवा चौथ', emoji: '🌺', greeting: 'करवा चौथ के पावन पर्व की हार्दिक शुभकामनाएं! अखंड सौभाग्य और अटूट प्रेम का यह पर्व सदा खुशियां लाए।', blessing: 'करवा चौथ स्पेशल ऑफर: नए लेडीज कलेक्शन पर भारी छूट उपलब्ध है!', badgeColor: '#be123c' },
    { id: 'HARIYALI_TEEJ', name: 'हरियाली तीज', emoji: '🌿', greeting: 'हरियाली तीज की हार्दिक शुभकामनाएं! माता पार्वती और भगवान शिव आपके दांपत्य जीवन में खुशहाली लाएं।', blessing: 'तीज महोत्सव स्पेशल: नए फैंसी आइटम व साड़ियों/सूट पर विशेष त्योहारी छूट!', badgeColor: '#16a34a' },
    { id: 'GANGAUR', name: 'गणगौर', emoji: '🌸', greeting: 'गणगौर पर्व की घणी-घणी शुभकामनाएं! ईसर जी और गौरा माता आपके घर में सुख-शांति बनाए रखें।', blessing: 'गणगौर स्पेशल ऑफर: नए कलेक्शन पर विशेष त्योहारी डिस्काउंट!', badgeColor: '#db2777' },
    { id: 'SHARAD_PURNIMA', name: 'शरद पूर्णिमा', emoji: '🌕', greeting: 'शरद पूर्णिमा / रास पूर्णिमा की हार्दिक शुभकामनाएं! अमृतमयी चांदनी आपके जीवन में आरोग्यता व शीतलता लाए।', blessing: 'शरद पूर्णिमा पर विशेष त्योहारी खरीदारी ऑफर!', badgeColor: '#0284c7' },
    { id: 'EKADASHI', name: 'एकादशी व्रत', emoji: '🙏', greeting: 'पवित्र एकादशी व्रत की हार्दिक शुभकामनाएं! भगवान श्री हरि विष्णु आपके सभी मनोरथ पूर्ण करें।', blessing: 'एकादशी के पावन दिन पर विशेष खरीदारी ऑफर!', badgeColor: '#d97706' },
    { id: 'GURU_PURNIMA', name: 'गुरु पूर्णिमा', emoji: '🌕', greeting: 'गुरु पूर्णिमा की पावन शुभकामनाएं! गुरु कृपा से आपके जीवन का हर अंधकार दूर हो।', blessing: 'गुरु पूर्णिमा के शुभ अवसर पर विशेष छूट उपलब्ध है!', badgeColor: '#ca8a04' },
    { id: 'VAT_SAVITRI', name: 'वट सावित्री व्रत', emoji: '🌳', greeting: 'वट सावित्री व्रत की हार्दिक शुभकामनाएं! आपका सुहाग सदा अक्षुण्ण रहे और घर में खुशहाली रहे।', blessing: 'वट सावित्री व्रत स्पेशल त्योहारी ऑफर!', badgeColor: '#15803d' },
    { id: 'JAYA_EKADASHI', name: 'जया एकादशी', emoji: '🌺', greeting: 'जया एकादशी की मंगलमय शुभकामनाएं! भगवान विष्णु की कृपा से जीवन में हर क्षेत्र में विजय प्राप्त हो।', blessing: 'जया एकादशी पर विशेष ऑफर!', badgeColor: '#e11d48' },
    { id: 'PRADOSH_VRAT', name: 'प्रदोष व्रत', emoji: '🕉️', greeting: 'प्रदोष व्रत की हार्दिक शुभकामनाएं! भगवान भोलेनाथ आपके सभी दुख दूर करें।', blessing: 'प्रदोष व्रत पर विशेष खरीदारी ऑफर!', badgeColor: '#0284c7' },
    { id: 'GOVATSA_DWADASHI', name: 'गोवत्स द्वादशी (बछ बारस)', emoji: '🌿', greeting: 'गोवत्स द्वादशी (बछ बारस) की हार्दिक शुभकामनाएं! गौ माता व बछड़े की कृपा से संतान सुख व समृद्धि मिले।', blessing: 'बछ बारस के पावन अवसर पर स्पेशल ऑफर!', badgeColor: '#16a34a' },
    { id: 'DEV_DEEPAWALI', name: 'देव दीपावली', emoji: '🪔', greeting: 'कार्तिक पूर्णिमा व देव दीपावली की हार्दिक शुभकामनाएं! देवताओं की दीपावली आपके जीवन को आलोकित करे।', blessing: 'देव दीपावली पर महा बचत त्योहारी डिस्काउंट!', badgeColor: '#d97706' }
  ];

  productForm!: FormGroup;

  checkWhatsAppBotStatus(showFeedback = false) {
    if (showFeedback) {
      this.isCheckingWhatsApp.set(true);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1800);

    fetch('http://localhost:5000/whatsapp-status', { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        clearTimeout(timeoutId);
        if (showFeedback) {
          this.isCheckingWhatsApp.set(false);
        }
        const connected = !!data.connected;
        if (this.isWhatsAppBotReady() !== connected) {
          this.isWhatsAppBotReady.set(connected);
        }
        if (connected) {
          if (showFeedback) {
            this.toast.success('WhatsApp Connected! ✅', 'WhatsApp बॉट एक्टिव है। अब 1-क्लिक में फोटो + मैसेज जाएगा!');
          }
          this.stopWhatsAppAutoPoll();
        } else if (showFeedback) {
          this.toast.info('Not Connected', 'WhatsApp अभी कनेक्ट नहीं है। कृपया QR कोड स्कैन करें।');
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        if (showFeedback) {
          this.isCheckingWhatsApp.set(false);
          this.toast.warning('Server Offline', 'WhatsApp बॉट सर्वर से संपर्क नहीं हो सका।');
        }
        if (this.isWhatsAppBotReady() !== false) {
          this.isWhatsAppBotReady.set(false);
        }
      });
  }

  startWhatsAppAutoPoll() {
    this.stopWhatsAppAutoPoll();
    this.checkWhatsAppBotStatus(false);
    this.whatsappPollTimer = setInterval(() => {
      if (this.isWhatsAppBotReady() || !this.showBroadcastModal()) {
        this.stopWhatsAppAutoPoll();
        return;
      }
      this.checkWhatsAppBotStatus(false);
    }, 4000);
  }

  stopWhatsAppAutoPoll() {
    if (this.whatsappPollTimer) {
      clearInterval(this.whatsappPollTimer);
      this.whatsappPollTimer = null;
    }
  }

  openWhatsAppQrWindow() {
    window.open('http://localhost:5000/whatsapp-qr', '_blank', 'width=520,height=680');
    this.toast.info('Scan QR Code', 'अपने फोन के WhatsApp से QR कोड स्कैन करें। स्कैन होते ही यह विंडो अपने-आप ऑटो-रिफ्रेश हो जाएगी!');
    this.startWhatsAppAutoPoll();
  }

  closeBroadcastModal() {
    this.showBroadcastModal.set(false);
    this.stopWhatsAppAutoPoll();
  }

  quickAddStock(prod: any, addQty: number) {
    this.api.post<any>(`/products/${prod._id}/adjust-stock`, {
      quantity: addQty,
      notes: `Quick Restock (+${addQty} ${prod.unit || 'PCS'})`
    }).subscribe({
      next: (res) => {
        this.toast.success(
          'स्टॉक फुल हुआ',
          `"${prod.name}" में +${addQty} स्टॉक जोड़ दिया गया। नया स्टॉक: ${res.data?.quantity || (prod.quantity + addQty)}`
        );
        this.loadProducts();
      },
      error: (err) => {
        this.toast.error('Restock Failed', err.error?.message || 'स्टॉक अपडेट नहीं हो सका।');
      }
    });
  }

  ngOnInit() {
    this.initForm();
    this.loadProducts();
    this.loadMetadata();
    this.loadCustomers();
    this.checkWhatsAppBotStatus();

    // 📡 Real-time listener for WhatsApp QR popup completion
    this.windowMessageListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'WHATSAPP_CONNECTED') {
        this.isWhatsAppBotReady.set(true);
        this.toast.success('WhatsApp Connected! ✅', 'WhatsApp बॉट सफलतापूर्वक कनेक्ट हो गया है। अब 1-क्लिक में फोटो + मैसेज जाएगा!');
        this.stopWhatsAppAutoPoll();
      }
    };
    window.addEventListener('message', this.windowMessageListener);

    this.route.queryParams.subscribe(params => {
      if (params['action'] === 'broadcast') {
        setTimeout(() => this.openBroadcastModal(), 300);
      }
    });
  }

  ngOnDestroy() {
    this.stopWhatsAppAutoPoll();
    if (this.windowMessageListener) {
      window.removeEventListener('message', this.windowMessageListener);
    }
  }


  initForm() {
    const shopType = this.shop()?.shopType || 'GARMENTS';

    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      sku: [''],
      barcode: [''],
      category: [''],
      brand: [''],
      purchasePrice: [0, [Validators.required, Validators.min(0)]],
      sellingPrice: [0, [Validators.required, Validators.min(0)]],
      mrp: [0],
      gstPercent: [18, [Validators.required, Validators.min(0)]],
      gstInclusive: [false],
      hsnCode: [''],
      quantity: [0, [Validators.required, Validators.min(0)]],
      minStockLevel: [5, [Validators.required, Validators.min(0)]],
      unit: ['PCS'],

      // Garments / Shoes
      size: [''],
      color: [''],
      fabric: [''],
      model: [''],

      // Mobile
      ram: [''],
      storage: [''],
      imeiNumber: [''],
      serialNumber: [''],
      warranty: [''],

      // 💊 Medical & Pharmacy Master
      genericName: [''],
      company: [''],
      manufacturer: [''],
      medicineType: ['Tablet'],
      packaging: ['Strip'],
      tabletsPerStrip: [10],
      batchNumber: [''],
      expiryDate: [''],
      prescriptionRequired: [false],
      scheduleType: ['NONE'],
      rack: [''],
      shelf: [''],
      rackLocation: [''],
      maxStockLevel: [100],
      shade: [''],

      // Hardware
      material: [''],
      supplier: ['']
    });
  }

  loadProducts() {
    this.loading.set(true);
    this.api.get<any>('/products').subscribe({
      next: (res) => {
        if (res.success) this.products.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'Failed to load products list.');
      }
    });
  }

  loadMetadata() {
    this.api.get<any>('/categories').subscribe({
      next: (res) => { if (res.success) this.categories.set(res.data); }
    });
    this.api.get<any>('/brands').subscribe({
      next: (res) => { if (res.success) this.brands.set(res.data); }
    });
    this.loadCustomers();
  }

  loadCustomers() {
    this.api.get<any>('/customers').subscribe({
      next: (res) => {
        if (res.success) {
          const list = res.data || [];
          this.customers.set(list);
          this.selectedCustomerIds.set(list.map((c: any) => c._id));
        }
      }
    });
  }

  // --- WhatsApp New Stock Broadcast Methods ---
  openBroadcastModal(product?: any) {
    if (!this.subService.canSendWhatsApp()) {
      this.toast.warning('WhatsApp Broadcast Locked', 'WhatsApp मैसेज भेजने के लिए कृपया ₹500 वाला Pro Plan या ₹4,999 वाला Yearly Plan एक्टिवेट करें।');
      this.subService.showUpgradeModal.set(true);
      return;
    }

    if (this.customers().length > 0) {
      this.selectedCustomerIds.set(this.customers().map(c => c._id));
    }

    if (product) {
      this.broadcastProduct.set({
        ...product,
        image: product.image || ''
      });
      this.broadcastImagePreview.set(product.image || '');
    } else if (this.products().length > 0) {
      const first = this.products()[0];
      this.broadcastProduct.set({
        ...first,
        image: first.image || ''
      });
      this.broadcastImagePreview.set(first.image || '');
    } else {
      this.broadcastProduct.set({
        name: 'नया फैंसी आइटम (New Stock Item)',
        mrp: 999,
        sellingPrice: 799,
        size: 'सभी साइज उपलब्ध',
        color: 'सभी पसंदीदा कलर',
        category: 'नया माल'
      });
      this.broadcastImagePreview.set('');
    }

    this.broadcastTemplate.set('NEW_ARRIVAL');
    this.broadcastMessage.set(this.buildBroadcastMessage(this.broadcastProduct(), 'NEW_ARRIVAL'));
    this.isBatchRunning.set(false);
    this.activeBatchIndex.set(-1);
    this.startWhatsAppAutoPoll();
    this.showBroadcastModal.set(true);
    this.renderFestivalPoster();
  }

  toggleSelectAll(checked: boolean) {
    if (checked) {
      this.selectedCustomerIds.set(this.customers().map(c => c._id));
    } else {
      this.selectedCustomerIds.set([]);
    }
  }

  toggleCustomer(id: string) {
    const current = this.selectedCustomerIds();
    if (current.includes(id)) {
      this.selectedCustomerIds.set(current.filter((x: string) => x !== id));
    } else {
      this.selectedCustomerIds.set([...current, id]);
    }
  }

  isCustomerSelected(id: string): boolean {
    return this.selectedCustomerIds().includes(id);
  }

  isAllCustomersSelected(): boolean {
    return this.customers().length > 0 && this.selectedCustomerIds().length === this.customers().length;
  }

  getSelectedCustomers(): any[] {
    const selectedIds = new Set(this.selectedCustomerIds());
    return this.customers().filter(c => selectedIds.has(c._id));
  }

  startBatchSending() {
    const selected = this.getSelectedCustomers();
    if (selected.length === 0) {
      this.toast.warning('No Customers Selected', 'कृपया कम से कम एक ग्राहक को सेलेक्ट करें।');
      return;
    }
    this.isBatchRunning.set(true);
    this.activeBatchIndex.set(0);
    this.sendCurrentBatchCustomer();
  }

  sendCurrentBatchCustomer() {
    const selected = this.getSelectedCustomers();
    const idx = this.activeBatchIndex();
    if (idx >= 0 && idx < selected.length) {
      const cust = selected[idx];
      this.sendToCustomer(cust);
    }
  }

  nextBatchCustomer() {
    const selected = this.getSelectedCustomers();
    const nextIdx = this.activeBatchIndex() + 1;
    if (nextIdx < selected.length) {
      this.activeBatchIndex.set(nextIdx);
      this.sendCurrentBatchCustomer();
    } else {
      this.isBatchRunning.set(false);
      this.toast.success('Broadcast Complete', `सभी ${selected.length} चयनित ग्राहकों को संदेश सफलतापूर्वक भेजा जा चुका है!`);
    }
  }

  stopBatchSending() {
    this.isBatchRunning.set(false);
    this.activeBatchIndex.set(-1);
  }

  onBroadcastProductSelect(event: any) {
    const id = event.target.value;
    const found = this.products().find(p => p._id === id);
    if (found) {
      this.broadcastProduct.set({ ...found });
      this.broadcastImagePreview.set(found.image || '');
      this.broadcastMessage.set(this.buildBroadcastMessage(found, this.broadcastTemplate()));
    }
  }

  onImageSelected(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.broadcastImagePreview.set(base64);
        const cur = this.broadcastProduct();
        this.broadcastProduct.set({ ...cur, image: base64 });
        this.toast.success('Image Attached', 'प्रोडक्ट की फोटो सफलतापूर्वक लोड हो गई है।');
      };
      reader.readAsDataURL(file);
    }
  }

  getFestivalById(id: string): any {
    return this.festivalsList.find(f => f.id === id) || this.festivalsList[0];
  }

  onFestivalSelect(id: string) {
    this.selectedFestivalId.set(id);
    this.broadcastTemplate.set('FESTIVAL');
    const fest = this.getFestivalById(id);
    this.broadcastMessage.set(this.buildFestivalMessage(fest, this.broadcastProduct()));
    this.renderFestivalPoster();
  }

  onBroadcastTemplateSelect(template: 'NEW_ARRIVAL' | 'MEGA_DISCOUNT' | 'LIMITED_STOCK' | 'FESTIVAL' | 'CUSTOM') {
    this.broadcastTemplate.set(template);
    if (template === 'FESTIVAL') {
      const fest = this.getFestivalById(this.selectedFestivalId());
      this.broadcastMessage.set(this.buildFestivalMessage(fest, this.broadcastProduct()));
      this.renderFestivalPoster();
    } else if (template !== 'CUSTOM') {
      this.broadcastMessage.set(this.buildBroadcastMessage(this.broadcastProduct(), template));
    }
  }

  updateBroadcastField(field: string, val: any) {
    const cur = { ...this.broadcastProduct(), [field]: val };
    this.broadcastProduct.set(cur);
    if (this.broadcastTemplate() === 'FESTIVAL') {
      const fest = this.getFestivalById(this.selectedFestivalId());
      this.broadcastMessage.set(this.buildFestivalMessage(fest, cur));
      this.renderFestivalPoster();
    } else if (this.broadcastTemplate() !== 'CUSTOM') {
      this.broadcastMessage.set(this.buildBroadcastMessage(cur, this.broadcastTemplate()));
    }
  }

  buildFestivalMessage(festival: any, prod?: any): string {
    const shopName = this.auth.currentShop()?.name || 'हमारी दुकान (Our Shop)';
    const shopMobile = this.auth.currentShop()?.mobile || '';
    const shopAddress = this.auth.currentShop()?.address || '';
    const prodName = prod?.name || '';
    const sellingPrice = prod?.sellingPrice ? Number(prod.sellingPrice).toLocaleString('en-IN') : '';
    const mrp = prod?.mrp ? Number(prod.mrp).toLocaleString('en-IN') : '';

    let productSection = '';
    if (prodName && prodName !== 'नया उत्पाद' && prodName !== 'नया फैंसी आइटम (New Stock Item)') {
      productSection = `\n━━━━━━━━━━━━━━━━━━━━\n🎁 *त्योहारी स्पेशल ऑफर:* *${prodName}*` +
        (mrp ? `\n🏷️ *MRP:* ~₹${mrp}~` : '') +
        (sellingPrice ? `\n💥 *धमाका ऑफर रेट:* *₹${sellingPrice}/-* मात्र!` : '') +
        (prod?.size ? `\n📏 *साइज:* ${prod.size}` : '') +
        (prod?.color ? `\n🎨 *कलर:* ${prod.color}` : '');
    }

    return `${festival.emoji} *${festival.name.toUpperCase()} की हार्दिक शुभकामनाएं!* ${festival.emoji}\n━━━━━━━━━━━━━━━━━━━━\n✨ ${festival.greeting}\n\n🎉 ${festival.blessing}${productSection}\n━━━━━━━━━━━━━━━━━━━━\n🏪 *दुकान:* *${shopName}*${shopAddress ? `\n📍 ${shopAddress}` : ''}\n📞 *संपर्क / WhatsApp बुकिंग:* ${shopMobile}\n\n🙏 *आप सपरिवार पधारें और त्योहारी खुशियों का आनंद लें!* 🌸`;
  }

  buildBroadcastMessage(prod: any, template: string): string {
    const shopName = this.auth.currentShop()?.name || 'हमारी दुकान (Our Shop)';
    const shopMobile = this.auth.currentShop()?.mobile || '';
    const shopAddress = this.auth.currentShop()?.address || '';
    const prodName = prod?.name || 'नया उत्पाद';
    const mrp = Number(prod?.mrp || prod?.sellingPrice || 0).toLocaleString('en-IN');
    const sellingPrice = Number(prod?.sellingPrice || 0).toLocaleString('en-IN');
    const size = prod?.size ? `\n📏 *साइज (Size):* ${prod.size}` : '';
    const color = prod?.color ? `\n🎨 *रंग (Color):* ${prod.color}` : '';
    const fabric = prod?.fabric ? `\n🧵 *कपड़ा (Fabric):* ${prod.fabric}` : '';

    switch (template) {
      case 'NEW_ARRIVAL':
        return `🎉 *NEW STOCK ARRIVAL / नया माल आ गया!* 🎉\n━━━━━━━━━━━━━━━━━━━━\n✨ *${prodName}*\n\n🏷️ *MRP:* ~₹${mrp}~\n💥 *धमाका ऑफर मूल्य:* *₹${sellingPrice}/-* (Special Offer)${size}${color}${fabric}\n━━━━━━━━━━━━━━━━━━━━\n📍 *दुकान:* *${shopName}*${shopAddress ? `\n🏢 ${shopAddress}` : ''}\n📞 *ऑर्डर / पूछताछ:* ${shopMobile}\n\n🏃‍♂️ *सीमित स्टॉक उपलब्ध है! आज ही पधारें या WhatsApp पर बुक करें।* 🙏`;

      case 'MEGA_DISCOUNT':
        return `🔥 *MEGA FESTIVAL SALE / भारी छूट ऑफर!* 🔥\n━━━━━━━━━━━━━━━━━━━━\n🛍️ *उत्पाद:* *${prodName}*\n❌ *मार्केट रेट:* ~₹${mrp}~\n✅ *हमारी दुकान का डिस्काउंट रेट:* *₹${sellingPrice}/-* मात्र!${size}${color}\n━━━━━━━━━━━━━━━━━━━━\n🎁 *सीमित समय का ऑफर!*\n🏪 *${shopName}*${shopAddress ? `\n📍 ${shopAddress}` : ''}\n📱 *संपर्क करें:* ${shopMobile}\n\n🙏 *जल्दी करें, ऑफर स्टॉक समाप्त होने तक मान्य है!*`;

      case 'LIMITED_STOCK':
        return `⚡ *HURRY UP / केवल कुछ ही पीस शेष!* ⚡\n━━━━━━━━━━━━━━━━━━━━\n🌟 *${prodName}*\n💰 *स्पेशल रेट:* *₹${sellingPrice}/-*\n📦 *ताजा स्टॉक अभी-अभी पहुँचा है!*${size}${color}\n━━━━━━━━━━━━━━━━━━━━\n🛒 तुरंत बुक करने के लिए रिप्लाई करें या दुकान पर विजिट करें।\n*${shopName}* | 📞 ${shopMobile}`;

      default:
        return `🎉 *नया स्टॉक आ गया है!* 🎉\n*${prodName}* - केवल ₹${sellingPrice}/- में उपलब्ध।\n*${shopName}* पर पधारें।`;
    }
  }

  copyBroadcastText() {
    const text = this.broadcastMessage();
    navigator.clipboard.writeText(text).then(() => {
      this.toast.success('Copied!', 'मैसेज कॉपी हो गया! अब आप इसे सीधे WhatsApp Broadcast List, Group या Status में पेस्ट कर सकते हैं।');
    });
  }

  async copyImageToClipboard(): Promise<boolean> {
    const base64 = this.broadcastImagePreview();
    if (!base64) {
      this.toast.info('No Image', 'पहले फोटो चुनें या अपलोड करें।');
      return false;
    }
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = base64;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.drawImage(img, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) return false;

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      this.toast.success('📸 फोटो कॉपी हो गई!', 'फोटो क्लिपबोर्ड में कॉपी हो गई है। WhatsApp में सिर्फ Ctrl + V (Paste) दबाएं!');
      return true;
    } catch (err) {
      console.warn('Could not copy image to clipboard:', err);
      return false;
    }
  }

  downloadBroadcastImage() {
    const base64 = this.broadcastImagePreview();
    if (!base64) {
      this.toast.warning('No Image', 'डाउनलोड करने के लिए कोई फोटो उपलब्ध नहीं है।');
      return;
    }
    const link = document.createElement('a');
    link.href = base64;
    const prodName = (this.broadcastProduct().name || 'product').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `Offer_${prodName}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success('Downloaded', 'फोटो डाउनलोड हो गई। आप इसे WhatsApp में ड्रैग या सेलेक्ट कर सकते हैं।');
  }

  async openWhatsAppGeneral() {
    const message = this.broadcastMessage();
    const image = this.broadcastImagePreview();
    await this.fallbackOpenWhatsApp('', message, image);
  }

  async sendToCustomer(cust: any) {
    if (!cust.mobile) {
      this.toast.warning('Mobile Missing', 'ग्राहक का मोबाइल नंबर उपलब्ध नहीं है।');
      return;
    }

    let phone = cust.mobile.toString().trim().replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const message = this.broadcastMessage();
    const image = this.broadcastImagePreview();

    // Try Server Gateway first (direct photo delivery)
    if (image) {
      this.api.post<any>('/products/broadcast-whatsapp', {
        mobile: phone,
        message: message,
        image: image
      }).subscribe({
        next: (res) => {
          if (res.success && res.gatewayReady) {
            const status = { ...this.customerSendStatus(), [cust._id]: true };
            this.customerSendStatus.set(status);
            this.toast.success('✅ Sent with Photo', `${cust.name} को फोटो सहित WhatsApp भेजा गया!`);
          } else {
            this.fallbackOpenWhatsApp(phone, message, image, cust);
          }
        },
        error: () => {
          this.fallbackOpenWhatsApp(phone, message, image, cust);
        }
      });
    } else {
      this.fallbackOpenWhatsApp(phone, message, image, cust);
    }
  }

  async sendToCustomNumber() {
    let raw = this.customBroadcastPhone().trim();
    if (!raw) {
      this.toast.warning('Number Required', 'कृपया 10 अंकों का मोबाइल नंबर दर्ज करें।');
      return;
    }
    let phone = raw.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const message = this.broadcastMessage();
    const image = this.broadcastImagePreview();

    if (image) {
      this.api.post<any>('/products/broadcast-whatsapp', {
        mobile: phone,
        message: message,
        image: image
      }).subscribe({
        next: (res) => {
          if (res.success && res.gatewayReady) {
            this.toast.success('✅ Sent with Photo', `+${phone} पर फोटो सहित WhatsApp भेजा गया!`);
          } else {
            this.fallbackOpenWhatsApp(phone, message, image);
          }
        },
        error: () => {
          this.fallbackOpenWhatsApp(phone, message, image);
        }
      });
    } else {
      this.fallbackOpenWhatsApp(phone, message, image);
    }
  }

  async fallbackOpenWhatsApp(phone: string, message: string, image: string, cust?: any) {
    if (image) {
      // Auto-copy image to clipboard so user can instantly paste with Ctrl+V
      await this.copyImageToClipboard();
    }

    const encoded = encodeURIComponent(message);
    const url = phone ? `https://api.whatsapp.com/send?phone=${phone}&text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');

    if (cust) {
      const status = { ...this.customerSendStatus(), [cust._id]: true };
      this.customerSendStatus.set(status);
      this.toast.info('WhatsApp Opened', `${cust.name} का चैट खुला। फोटो क्लिपबोर्ड में है (Ctrl+V दबाएं)।`);
    } else {
      this.toast.info('WhatsApp Opened', 'WhatsApp खुला। फोटो क्लिपबोर्ड में कॉपी है (Ctrl+V दबाएं)।');
    }
  }

  openAddModal() {
    this.editMode.set(false);
    this.selectedProduct.set(null);
    this.initForm();
    this.showModal.set(true);
  }

  openEditModal(prod: any) {
    this.editMode.set(true);
    this.selectedProduct.set(prod);
    this.initForm();

    // Patch values
    const dateFormatted = prod.expiryDate ? new Date(prod.expiryDate).toISOString().split('T')[0] : '';
    this.productForm.patchValue({
      ...prod,
      expiryDate: dateFormatted
    });
    this.showModal.set(true);
  }

  onSubmit() {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const body = {
      ...this.productForm.value,
      shopType: this.shop()?.shopType
    };

    if (this.editMode()) {
      this.api.put<any>(`/products/${this.selectedProduct()._id}`, body).subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.showModal.set(false);
          this.toast.success('Updated', 'Product updated successfully.');
          this.loadProducts();
        },
        error: (err) => {
          this.submitting.set(false);
          this.toast.error('Failed', err.error?.message || 'Failed to update product.');
        }
      });
    } else {
      this.api.post<any>('/products', body).subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.showModal.set(false);
          this.toast.success('Created', 'Product added successfully.');
          this.loadProducts();
        },
        error: (err) => {
          this.submitting.set(false);
          this.toast.error('Failed', err.error?.message || 'Failed to add product.');
        }
      });
    }
  }

  // --- Barcode & Google Lens QR Sticker State ---
  showBarcodeModal = signal<boolean>(false);
  barcodeProduct = signal<any | null>(null);
  barcodeQrDataUrl = signal<string>('');
  barcodePrintQty = signal<number>(24);
  barcodePrintSize = signal<'A4_24' | 'A4_40' | 'SINGLE'>('A4_24');
  lensProductUrl = signal<string>('');
  barcodeCopied = signal<boolean>(false);

  autoGenerateBarcode() {
    const unique = '890' + Date.now().toString().slice(-7) + Math.floor(100 + Math.random() * 900);
    this.productForm.patchValue({ barcode: unique });
    this.toast.info('Barcode Generated', `यूनिक बारकोड: ${unique} तैयार किया गया।`);
  }

  openBarcodeModal(product: any) {
    const code = product.barcode || product._id;
    const url = `${window.location.origin}/p/${code}`;
    this.barcodeProduct.set(product);
    this.lensProductUrl.set(url);
    this.barcodePrintQty.set(24);

    QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(qr => {
      this.barcodeQrDataUrl.set(qr);
      this.showBarcodeModal.set(true);
    }).catch(err => {
      console.error(err);
      this.showBarcodeModal.set(true);
    });
  }

  testGoogleLensLink() {
    const url = this.lensProductUrl();
    if (url) {
      window.open(url, '_blank');
    }
  }

  copyGoogleLensLink() {
    const url = this.lensProductUrl();
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        this.barcodeCopied.set(true);
        this.toast.success('Link Copied', 'Google Lens प्रोडक्ट वेब लिंक कॉपी हो गया!');
        setTimeout(() => this.barcodeCopied.set(false), 2500);
      });
    }
  }

  printBarcodeStickers() {
    window.print();
  }

  getPrintStickers(): any[] {
    const qty = Math.max(1, Math.min(200, this.barcodePrintQty() || 1));
    return Array.from({ length: qty });
  }

  deleteProduct(id: string) {
    if (confirm('Are you sure you want to delete this product?')) {
      this.api.delete<any>(`/products/${id}`).subscribe({
        next: () => {
          this.toast.success('Deleted', 'Product deleted successfully.');
          this.loadProducts();
        },
        error: () => {
          this.toast.error('Failed', 'Failed to delete product.');
        }
      });
    }
  }

  // --- 🎨 HD Instagram Festival Poster Generator Canvas Engine ---

  setPosterStyle(style: 'FESTIVE_PURPLE_MANDALA' | 'ROYAL_GOLD' | 'FESTIVE_VIBRANT' | 'DARK_LUXURY' | 'MODERN_GLASS') {
    this.posterStyle.set(style);
    this.renderFestivalPoster();
  }

  setPosterCustomWish(val: string) {
    this.posterCustomWish.set(val);
    this.renderFestivalPoster();
  }

  setPosterCustomOffer(val: string) {
    this.posterCustomOffer.set(val);
    this.renderFestivalPoster();
  }

  toggleIncludeProductOnPoster(checked: boolean) {
    this.includeProductOnPoster.set(checked);
    this.renderFestivalPoster();
  }

  async renderFestivalPoster() {
    this.isGeneratingPoster.set(true);
    try {
      const dataUrl = await this.generateFestivalPosterDataUrl();
      this.posterCanvasDataUrl.set(dataUrl);
      if (this.broadcastTemplate() === 'FESTIVAL') {
        this.broadcastImagePreview.set(dataUrl);
      }
    } catch (err) {
      console.error('Error generating festival poster canvas:', err);
    } finally {
      this.isGeneratingPoster.set(false);
    }
  }

  async generateFestivalPosterDataUrl(): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const fest = this.getFestivalById(this.selectedFestivalId());
    const style = this.posterStyle();
    const shop: any = this.auth.currentShop() || {};
    const prod: any = this.broadcastProduct();
    const shopName = shop.name || 'हमारी दुकान (Our Shop)';
    const shopMobile = shop.mobile || '';
    const shopAddress = shop.address || shop.branchName || '';

    const wishText = this.posterCustomWish() || fest.greeting;
    const offerText = this.posterCustomOffer() || fest.blessing;

    // 1. Background Gradient Fill
    if (style === 'FESTIVE_PURPLE_MANDALA') {
      const grad = ctx.createLinearGradient(0, 0, 0, 1080);
      grad.addColorStop(0, '#3d0743');
      grad.addColorStop(0.4, '#5c0b62');
      grad.addColorStop(0.8, '#440649');
      grad.addColorStop(1, '#210224');
      ctx.fillStyle = grad;
    } else if (style === 'ROYAL_GOLD') {
      const grad = ctx.createRadialGradient(540, 540, 80, 540, 540, 780);
      grad.addColorStop(0, '#581c87');
      grad.addColorStop(0.4, '#831843');
      grad.addColorStop(0.85, '#4c0519');
      grad.addColorStop(1, '#180208');
      ctx.fillStyle = grad;
    } else if (style === 'FESTIVE_VIBRANT') {
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, '#ea580c');
      grad.addColorStop(0.5, '#dc2626');
      grad.addColorStop(1, '#7c3aed');
      ctx.fillStyle = grad;
    } else if (style === 'DARK_LUXURY') {
      const grad = ctx.createRadialGradient(540, 540, 80, 540, 540, 750);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(0.7, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
    } else { // MODERN_GLASS
      const grad = ctx.createLinearGradient(0, 0, 1080, 1080);
      grad.addColorStop(0, '#0284c7');
      grad.addColorStop(0.5, '#2563eb');
      grad.addColorStop(1, '#4f46e5');
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, 1080, 1080);

    // 2. Specialized Festive Elements for FESTIVE_PURPLE_MANDALA (Toran, Arch, Mandalas, Sparkles & Diyas)
    if (style === 'FESTIVE_PURPLE_MANDALA') {
      this.drawBuntingToran(ctx);
      this.drawTempleArchFrame(ctx);
      this.draw3DMandala(ctx, 110, 200, 100);
      this.draw3DMandala(ctx, 970, 200, 100);
      this.draw3DMandala(ctx, 110, 880, 110);
      this.draw3DMandala(ctx, 970, 880, 110);
      this.drawStarSparkles(ctx);
      this.drawTriDiyaArrangement(ctx);
    } else {
      // Radial Gold Light Beams / Sunburst Background
      ctx.save();
      ctx.translate(540, 540);
      const beamCount = 20;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
      for (let i = 0; i < beamCount; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 800, (i * 2 * Math.PI) / beamCount, ((i + 0.5) * 2 * Math.PI) / beamCount);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Ornate Gold Mandala Background Pattern
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(540, 540, 360, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(540, 540, 480, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.arc(540, 540, 420, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 4. Festival-Specific Graphics & Motifs
    this.drawCanvasFestivalMotifs(ctx, fest.id);

    // 5. Royal Gold Borders
    ctx.save();
    const borderGrad = ctx.createLinearGradient(0, 0, 1080, 1080);
    borderGrad.addColorStop(0, '#fde047');
    borderGrad.addColorStop(0.3, '#d97706');
    borderGrad.addColorStop(0.7, '#fef08a');
    borderGrad.addColorStop(1, '#b45309');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 18;
    ctx.strokeRect(20, 20, 1040, 1040);

    ctx.lineWidth = 3;
    ctx.strokeRect(36, 36, 1008, 1008);

    this.drawCornerDiamond(ctx, 36, 36);
    this.drawCornerDiamond(ctx, 1044, 36);
    this.drawCornerDiamond(ctx, 36, 1044);
    this.drawCornerDiamond(ctx, 1044, 1044);
    ctx.restore();

    // 6. Top Header Pill (Shop Branding & Contact)
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
    ctx.lineWidth = 3;
    this.drawCanvasRoundRect(ctx, 90, 60, 900, 105, 52);
    ctx.fill();
    ctx.stroke();

    let logoDrawn = false;
    if (shop.logo) {
      try {
        const logoImg = await this.loadCanvasImage(shop.logo);
        if (logoImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(150, 112, 38, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(logoImg, 112, 74, 76, 76);
          ctx.restore();
          logoDrawn = true;
        }
      } catch (e) { logoDrawn = false; }
    }

    if (!logoDrawn) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(150, 112, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🏪', 150, 112);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 38px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    ctx.fillText(shopName, 205, 104);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 22px Arial, sans-serif';
    const shopMeta = `${shopMobile ? '📞 ' + shopMobile : ''} ${shopAddress ? ' • 📍 ' + shopAddress : ''}`;
    ctx.fillText(shopMeta || 'आपकी अपनी भरोसेमंद दुकान', 205, 136);
    ctx.restore();

    // 7. Festival Main Title Banner
    ctx.save();
    ctx.textAlign = 'center';

    const festivalTitle = `${fest.emoji} ${fest.name.toUpperCase()} ${fest.emoji}`;
    ctx.font = '900 58px "Segoe UI", Arial, sans-serif';

    const titleGrad = ctx.createLinearGradient(0, 200, 0, 260);
    titleGrad.addColorStop(0, '#ffffff');
    titleGrad.addColorStop(0.5, '#fef08a');
    titleGrad.addColorStop(1, '#f59e0b');

    ctx.fillStyle = titleGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillText(festivalTitle, 540, 235);

    ctx.font = '800 40px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 10;
    ctx.fillText('की हार्दिक शुभकामनाएं!', 540, 295);
    ctx.restore();

    // 8. Main Card Area (Product Offer OR Standalone Greeting)
    const hasProduct = this.includeProductOnPoster() && prod && prod.name && prod.name !== 'नया उत्पाद' && prod.name !== 'नया फैंसी आइटम (New Stock Item)';

    if (hasProduct) {
      // PRODUCT OFFER CARD
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.lineWidth = 3;
      this.drawCanvasRoundRect(ctx, 90, 330, 900, 570, 28);
      ctx.fill();
      ctx.stroke();

      let prodImgDrawn = false;
      if (prod.image) {
        try {
          const pImg = await this.loadCanvasImage(prod.image);
          if (pImg) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            this.drawCanvasRoundRect(ctx, 120, 360, 340, 340, 20);
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.stroke();

            ctx.clip();
            ctx.drawImage(pImg, 120, 360, 340, 340);
            ctx.restore();
            prodImgDrawn = true;
          }
        } catch (e) { prodImgDrawn = false; }
      }

      if (!prodImgDrawn) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        this.drawCanvasRoundRect(ctx, 120, 360, 340, 340, 20);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🎁', 290, 530);
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = 'left';

      // Product Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
      this.wrapCanvasText(ctx, prod.name, 480, 400, 480, 48);

      // MRP Strikethrough
      const mrpVal = prod.mrp ? Number(prod.mrp).toLocaleString('en-IN') : '';
      if (mrpVal) {
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 28px Arial';
        ctx.fillText(`MRP: ₹${mrpVal}`, 480, 515);
        const textWidth = ctx.measureText(`MRP: ₹${mrpVal}`).width;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(480, 505);
        ctx.lineTo(480 + textWidth, 505);
        ctx.stroke();
      }

      // Offer Rate Pill
      const sellVal = Number(prod.sellingPrice || 0).toLocaleString('en-IN');
      ctx.fillStyle = '#16a34a';
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 2;
      this.drawCanvasRoundRect(ctx, 480, 545, 480, 85, 18);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 38px "Segoe UI", Arial, sans-serif';
      ctx.fillText(`💥 ऑफर रेट: ₹${sellVal}/-`, 500, 602);

      // Size / Color Pill
      ctx.fillStyle = '#fde68a';
      ctx.font = '600 24px Arial';
      const sizeColor = `${prod.size ? '📏 ' + prod.size : ''} ${prod.color ? ' • 🎨 ' + prod.color : ''}`;
      ctx.fillText(sizeColor || 'सभी वैरायटी व स्टॉक उपलब्ध', 480, 670);

      // Custom Offer Tagline Banner inside card
      ctx.fillStyle = 'rgba(234, 88, 12, 0.45)';
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.4)';
      ctx.lineWidth = 2;
      this.drawCanvasRoundRect(ctx, 120, 730, 840, 140, 20);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
      this.wrapCanvasText(ctx, `🎉 ${offerText}`, 540, 770, 800, 38);
      ctx.restore();

    } else {
      // STANDALONE FESTIVE GREETING CARD (No product attached)
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.lineWidth = 3;
      this.drawCanvasRoundRect(ctx, 90, 330, 900, 570, 28);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef3c7';
      ctx.font = '800 34px "Segoe UI", Arial, sans-serif';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 10;
      this.wrapCanvasText(ctx, `✨ ${wishText}`, 540, 410, 820, 52);

      // Offer Blessing Pill
      ctx.fillStyle = 'rgba(234, 88, 12, 0.7)';
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2;
      this.drawCanvasRoundRect(ctx, 140, 560, 800, 120, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px "Segoe UI", Arial, sans-serif';
      this.wrapCanvasText(ctx, `🎁 ${offerText}`, 540, 610, 760, 44);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText('🙏 त्योहार की शुभ खरीदारी हेतु आज ही पधारें!', 540, 740);

      ctx.fillStyle = '#fcd34d';
      ctx.font = 'bold 24px Arial';
      ctx.fillText(`🏪 ${shopName} पर पाएं बेस्ट क्वालिटी व स्पेशल त्योहारी डिस्काउंट!`, 540, 790);
      ctx.restore();
    }

    // 9. Bottom Footer Ribbon (Call-To-Action & Address)
    ctx.save();
    const footGrad = ctx.createLinearGradient(0, 940, 0, 1080);
    footGrad.addColorStop(0, '#c2410c');
    footGrad.addColorStop(1, '#7c2d12');
    ctx.fillStyle = footGrad;
    ctx.fillRect(0, 930, 1080, 150);

    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 930);
    ctx.lineTo(1080, 930);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(`✨ ${shopName} • 📞 ${shopMobile || 'संपर्क करें'} • 📍 ${shopAddress || 'स्थान'} ✨`, 540, 975);

    ctx.fillStyle = '#ffedd5';
    ctx.font = '600 20px Arial';
    ctx.fillText('🙏 सपरिवार पधारें और त्योहारी खुशियों का आनंद लें! 🙏', 540, 1015);
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  private loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => resolve(null), 1500);
      img.onload = () => {
        clearTimeout(timer);
        resolve(img);
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      img.src = src;
    });
  }

  private drawCanvasRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

  private drawCornerDiamond(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x + 12, y);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x - 12, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
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

  private drawCanvasFestivalMotifs(ctx: CanvasRenderingContext2D, festivalId: string) {
    ctx.save();
    if (festivalId === 'DIWALI' || festivalId === 'DHANTERAS' || festivalId === 'DEV_DEEPAWALI') {
      this.drawDiyaMotif(ctx, 160, 880, 1.3);
      this.drawDiyaMotif(ctx, 920, 880, 1.3);
    } else if (festivalId === 'HOLI') {
      this.drawColorSplashMotif(ctx, 120, 200, '#ec4899');
      this.drawColorSplashMotif(ctx, 960, 220, '#06b6d4');
      this.drawColorSplashMotif(ctx, 150, 850, '#84cc16');
      this.drawColorSplashMotif(ctx, 930, 870, '#eab308');
    } else if (festivalId === 'MAKAR_SANKRANTI') {
      this.drawKiteMotif(ctx, 140, 200, '#f97316');
      this.drawKiteMotif(ctx, 940, 230, '#06b6d4');
    } else if (festivalId === 'MAHASHIVRATRI') {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(950, 180, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(935, 170, 36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawDiyaMotif(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI);
    ctx.fill();

    const flameGrad = ctx.createRadialGradient(0, -25, 5, 0, -25, 30);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.3, '#fef08a');
    flameGrad.addColorStop(0.7, '#f97316');
    flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.arc(0, -25, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(0, -45);
    ctx.quadraticCurveTo(12, -25, 0, -10);
    ctx.quadraticCurveTo(-12, -25, 0, -45);
    ctx.fill();
    ctx.restore();
  }

  private drawColorSplashMotif(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x, y, 45, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle) * 55, y + Math.sin(angle) * 55, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawKiteMotif(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.3);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -35);
    ctx.lineTo(35, 0);
    ctx.lineTo(0, 35);
    ctx.lineTo(-35, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  downloadPosterImage() {
    const dataUrl = this.posterCanvasDataUrl();
    if (!dataUrl) return;
    const fest = this.getFestivalById(this.selectedFestivalId());
    const shopName = ((this.auth.currentShop() as any)?.name || 'Shop').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const festName = (fest.name || 'Festival').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const link = document.createElement('a');
    link.download = `${shopName}_${festName}_Instagram_Poster.png`;
    link.href = dataUrl;
    link.click();
    this.toast.success('Downloaded!', '1080x1080 HD इंस्टाग्राम पोस्टर सफलतापूर्वक डाउनलोड हो गया है।');
  }

  async copyPosterToClipboard() {
    const dataUrl = this.posterCanvasDataUrl();
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      this.toast.success('Copied to Clipboard! 📋', 'इंस्टाग्राम पोस्टर इमेज क्लिपबोर्ड में कॉपी हो गई है! अब आप सीधे WhatsApp / Instagram पर Ctrl+V से पेस्ट कर सकते हैं।');
    } catch (e) {
      this.toast.info('Poster Ready', 'इमेज पर राइट-क्लिक (Right Click) करके "Copy Image" चुनें।');
    }
  }

  attachPosterToWhatsAppBroadcast() {
    const dataUrl = this.posterCanvasDataUrl();
    if (!dataUrl) return;
    this.broadcastImagePreview.set(dataUrl);
    this.toast.success('Attached to WhatsApp! 📲', 'फेस्टिवल पोस्टर इमेज को WhatsApp ब्रॉडकास्ट में जोड़ दिया गया है।');
  }

  private drawBuntingToran(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const count = 22;
    const width = 1080 / count;
    const colors = ['#f59e0b', '#fef08a', '#ec4899', '#ea580c'];

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.quadraticCurveTo(540, 45, 1080, 15);
    ctx.stroke();

    for (let i = 0; i < count; i++) {
      const x1 = i * width;
      const x2 = (i + 1) * width;
      const xMid = (x1 + x2) / 2;
      const yTop = 15 + Math.sin((i / count) * Math.PI) * 15;

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(x1, yTop);
      ctx.lineTo(x2, yTop);
      ctx.lineTo(xMid, yTop + 45);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTempleArchFrame(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.fillStyle = 'rgba(28, 3, 31, 0.65)';
    ctx.beginPath();
    ctx.moveTo(110, 960);
    ctx.lineTo(110, 320);
    ctx.bezierCurveTo(110, 140, 970, 140, 970, 320);
    ctx.lineTo(970, 960);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(253, 224, 71, 0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(125, 960);
    ctx.lineTo(125, 330);
    ctx.bezierCurveTo(125, 160, 955, 160, 955, 330);
    ctx.lineTo(955, 960);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private draw3DMandala(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
    ctx.save();
    ctx.translate(cx, cy);

    const petals = 12;
    ctx.fillStyle = '#db2777';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    for (let i = 0; i < petals; i++) {
      const angle = (i * 2 * Math.PI) / petals;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(radius * 0.4, -radius * 0.5, 0, -radius);
      ctx.quadraticCurveTo(-radius * 0.4, -radius * 0.5, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const innerR = radius * 0.65;
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < petals; i++) {
      const angle = (i * 2 * Math.PI) / petals + Math.PI / petals;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(innerR * 0.4, -innerR * 0.5, 0, -innerR);
      ctx.quadraticCurveTo(-innerR * 0.4, -innerR * 0.5, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    const coreR = radius * 0.38;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(0, 0, coreR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#831843';
    ctx.beginPath();
    ctx.arc(0, 0, coreR * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawStarSparkles(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const stars = [
      { x: 320, y: 210, s: 18 },
      { x: 760, y: 210, s: 18 },
      { x: 540, y: 270, s: 24 },
      { x: 220, y: 500, s: 16 },
      { x: 860, y: 500, s: 16 },
      { x: 300, y: 730, s: 18 },
      { x: 780, y: 730, s: 18 }
    ];

    for (const st of stars) {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(0, -st.s);
      ctx.quadraticCurveTo(0, 0, st.s, 0);
      ctx.quadraticCurveTo(0, 0, 0, st.s);
      ctx.quadraticCurveTo(0, 0, -st.s, 0);
      ctx.quadraticCurveTo(0, 0, 0, -st.s);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawTriDiyaArrangement(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const shadowGrad = ctx.createRadialGradient(540, 830, 20, 540, 830, 280);
    shadowGrad.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(540, 830, 280, 0, Math.PI * 2);
    ctx.fill();

    this.drawDiyaMotif(ctx, 390, 800, 1.15);
    this.drawDiyaMotif(ctx, 690, 800, 1.15);
    this.drawDiyaMotif(ctx, 540, 825, 1.55);
    ctx.restore();
  }
}

