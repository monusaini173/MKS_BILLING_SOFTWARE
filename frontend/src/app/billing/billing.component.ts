import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterModule, RouterLink, ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { LanguageService } from '../core/services/language.service';
import { SoundboxService } from '../core/services/soundbox.service';
import { LiveNotificationService } from '../core/services/live-notification.service';
import { getShopTypeConfig, ShopTypeConfig } from '../core/utils/shop-type-config';
import * as QRCode from 'qrcode';

export interface CartItem {
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number;
  purchasePrice?: number;
  discount: number;
  discountType: 'PERCENT' | 'AMOUNT';
  gstPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  hsnCode?: string;
  subtotal: number;
  totalGst: number;
  total: number;
  gstInclusive: boolean;
  priceTier?: 'RETAIL' | 'WHOLESALE' | 'MRP';
  stockQty?: number;
  minStockLevel?: number;
  isBelowCost?: boolean;
  // 🏥 Medical / Pharmacy Specialized
  batchNumber?: string;
  expiryDate?: any;
  genericName?: string;
  prescriptionRequired?: boolean;
  tabletsPerStrip?: number;
  isTabletUnit?: boolean;
  freeQuantity?: number;
  availableBatches?: any[];
  // 🛒 Kirana / Loose Weight
  isLoose?: boolean;
  weightGrams?: number;
  // 👔 Garments / Shoes
  size?: string;
  color?: string;
  fabric?: string;
  // 📱 Mobile / Electronics
  imeiNumber?: string;
  warranty?: string;
  // 🔧 Hardware / Shelf
  rackLocation?: string;
}

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, RouterLink],
  templateUrl: './billing.component.html'
})

export class BillingComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public lang = inject(LanguageService);
  public soundbox = inject(SoundboxService);
  public liveNotif = inject(LiveNotificationService);

  // 🔊 Instant Sound Box & Payment Success Overlay
  showPaymentSuccessOverlay = signal<boolean>(false);
  successAnnouncedAmount = signal<number>(0);

  // ✏️ Edit Bill / Invoice State
  editingSaleId = signal<string | null>(null);
  editingInvoiceNumber = signal<string>('');

  // Live Bill Date & Time
  liveBillDate = signal<string>('');
  liveBillTime = signal<string>('');
  private billClockTimer: any;

  shop = this.auth.currentShop;
  Math = Math;

  // 🏥🛒 Industry Adaptive Shop Configuration
  shopConfig = computed<ShopTypeConfig>(() => getShopTypeConfig(this.shop()?.shopType));

  // 💊 Medical Specific State
  doctorName = signal<string>('');
  doctorId = signal<string>('');
  doctorRegNumber = signal<string>('');
  patientName = signal<string>('');
  patientAge = signal<string>('');
  patientGender = signal<string>('');
  prescriptionRef = signal<string>('');
  isPrescriptionBill = signal<boolean>(false);
  doctors = signal<any[]>([]);
  showDoctorModal = false;
  doctorForm!: FormGroup;

  // 🛒 Fast Category Filter Tabs
  selectedCategoryTab = signal<string>('All');


  // Search
  searchQuery = '';
  searchResults = signal<any[]>([]);
  showDropdown = false;

  // Mode Switcher: SALE (बिक्री बिल) vs PURCHASE (खरीद बिल)
  billingMode = signal<'SALE' | 'PURCHASE'>('SALE');

  // Cart & State
  cart = signal<CartItem[]>([]);
  isInterState = signal(false);

  // Customer Management (for Sale Billing)
  customers = signal<any[]>([]);
  selectedCustomerId = '';
  selectedCustomerName = 'Walk-in Customer';
  selectedCustomerMobile = '';
  selectedCustomerGstin = '';

  showCustomerModal = false;
  customerForm!: FormGroup;

  // Supplier Management (for Purchase Billing)
  suppliers = signal<any[]>([]);
  selectedSupplierId = '';
  selectedSupplierName = '';
  selectedSupplierMobile = '';
  selectedSupplierGstin = '';
  supplierInvoiceNo = '';

  showSupplierModal = false;
  supplierForm!: FormGroup;

  // Purchase Bill Success Modal & Print State
  showPurchaseBillModal = signal<boolean>(false);
  savedPurchaseBill = signal<any | null>(null);
  purchasePrintFormat = signal<'A4' | 'THERMAL_80' | 'THERMAL_58'>('A4');
  purchaseCopyType = signal<'ORIGINAL' | 'DUPLICATE' | 'OFFICE'>('ORIGINAL');

  // Payment State
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'PARTIAL' = 'CASH';
  amountPaid = 0;
  transactionReference = '';
  notes = '';
  submitting = false;

  // Totals
  subtotal = 0;
  totalDiscount = 0;
  totalGst = 0;
  totalCgst = 0;
  totalSgst = 0;
  totalIgst = 0;
  grandTotal = 0;
  roundOff = 0;
  balanceDue = 0;

  // Online Payment & UPI QR Code State
  showPaymentQrModal = signal(false);
  shopUpiId = signal('');
  shopUpiName = signal('');
  upiIntentUrl = signal('');
  qrCodeImageUrl = signal('');
  isRazorpayLoading = signal(false);

  // --- 1. Pending / Hold Bills State ---
  pendingBills = signal<any[]>([]);
  showPendingBillsModal = signal<boolean>(false);

  // --- 2. Multiple Products Bulk Selector State ---
  showBulkModal = signal<boolean>(false);
  allProductsList = signal<any[]>([]);
  bulkFilteredProducts = signal<any[]>([]);
  bulkSearchText = signal<string>('');
  bulkCategoryFilter = signal<string>('ALL');
  bulkCategories = signal<string[]>([]);
  bulkSelectionMap = signal<{ [prodId: string]: { selected: boolean, qty: number, prod: any } }>({});

  // --- 3. Custom Quick Item State ---
  showCustomItemModal = signal<boolean>(false);
  customItemName = signal<string>('');
  customItemRate = signal<number>(0);
  customItemQty = signal<number>(1);
  customItemUnit = signal<string>('PCS');
  customItemGst = signal<number>(0);

  // --- 📜 Fast Previous Invoice & Customer Bill Search ---
  showInvoiceSearchModal = signal<boolean>(false);
  invoiceSearchQuery = signal<string>('');
  invoiceSearchResults = signal<any[]>([]);
  isInvoiceSearching = signal<boolean>(false);
  private invoiceSearchTimer: any;

  // --- 4. Recent Successful Payments History Modal ---
  showRecentPaymentsModal = signal<boolean>(false);
  recentPayments = signal<any[]>([]);
  isRecentPaymentsLoading = signal<boolean>(false);

  // --- 5. Cash Tender & Change Return Calculator State ---
  showChangeModal = signal<boolean>(false);
  cashReceived = signal<number>(0);
  changeReturn = signal<number>(0);

  // --- 6. Customer Ledger & Previous Balance & Credit Limit ---
  selectedCustomerBalance = signal<number>(0);
  includePreviousDue = signal<boolean>(false);
  selectedCustomerTotalPurchases = signal<number>(0);
  enableCreditLimitBlock = signal<boolean>(true);
  defaultCreditLimit = signal<number>(10000);
  selectedCustomerCreditLimit = signal<number>(10000);
  isCustomerOverCreditLimit = signal<boolean>(false);
  showCollectDueModal = signal<boolean>(false);
  collectDueAmount = signal<number>(0);
  collectDuePaymentMode = signal<string>('CASH');
  collectDueNotes = signal<string>('POS Due Collection');
  isCollectingDue = signal<boolean>(false);

  // --- 7. Fast-Billing Quick Items Bar (Adaptive per Trade) ---
  showFastItemsBar = signal<boolean>(true);
  quickFavorites = computed<any[]>(() => {
    const trade = this.shop()?.shopType;
    if (trade === 'MEDICAL') {
      return [
        { name: 'Band-Aid (Strips)', rate: 5, unit: 'PCS', gstPercent: 12, icon: '🩹' },
        { name: 'ORS Sachet (Electral)', rate: 22, unit: 'PCS', gstPercent: 12, icon: '🧪' },
        { name: 'Paracetamol 650mg (Strip)', rate: 30, unit: 'STRIP', gstPercent: 12, icon: '💊' },
        { name: 'Surgical Cotton (50g)', rate: 25, unit: 'PKT', gstPercent: 12, icon: '🩺' },
        { name: 'Hand Sanitizer (100ml)', rate: 50, unit: 'BTL', gstPercent: 18, icon: '🧴' },
        { name: 'Surgical Gloves (Pair)', rate: 15, unit: 'PAIR', gstPercent: 12, icon: '🧤' },
      ];
    } else if (trade === 'KIRANA') {
      return [
        { name: 'Carry Bag (Small)', rate: 5, unit: 'PCS', gstPercent: 18, icon: '🛍️' },
        { name: 'Carry Bag (Large)', rate: 10, unit: 'PCS', gstPercent: 18, icon: '🛍️' },
        { name: 'Water Bottle 1L', rate: 20, unit: 'PCS', gstPercent: 18, icon: '💧' },
        { name: 'Matchbox (Pack)', rate: 10, unit: 'PACK', gstPercent: 12, icon: '🔥' },
        { name: 'Tea / Coffee', rate: 15, unit: 'CUP', gstPercent: 5, icon: '☕' },
      ];
    } else if (trade === 'GARMENTS') {
      return [
        { name: 'Shopping Bag Premium', rate: 20, unit: 'PCS', gstPercent: 18, icon: '🛍️' },
        { name: 'Gift Wrapping', rate: 30, unit: 'SRV', gstPercent: 18, icon: '🎁' },
        { name: 'Alteration Service', rate: 50, unit: 'SRV', gstPercent: 18, icon: '✂️' },
      ];
    } else if (trade === 'MOBILE') {
      return [
        { name: 'Tempered Glass (Universal)', rate: 99, unit: 'PCS', gstPercent: 18, icon: '📱' },
        { name: 'Back Cover Basic', rate: 149, unit: 'PCS', gstPercent: 18, icon: '🛡️' },
        { name: 'Type-C Cable (Fast)', rate: 199, unit: 'PCS', gstPercent: 18, icon: '⚡' },
        { name: 'OTG Adapter', rate: 49, unit: 'PCS', gstPercent: 18, icon: '🔌' },
      ];
    }
    return [
      { name: 'Packaging Box', rate: 25, unit: 'PCS', gstPercent: 18, icon: '📦' },
      { name: 'Delivery Service', rate: 50, unit: 'SRV', gstPercent: 18, icon: '🚚' },
    ];
  });

  // --- 8. Keyboard Shortcuts Guide Bar ---
  showShortcutsBar = signal<boolean>(true);

  // ViewChild reference for Search Bar to enable F1 quick focus
  @ViewChild('searchInputEl') searchInputEl?: ElementRef<HTMLInputElement>;

  // HostListener for Zero-Mouse POS Keyboard Shortcuts (F1 to F9 & ESC)
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    // F1: Focus Search / Barcode Input
    if (event.key === 'F1') {
      event.preventDefault();
      this.focusSearchInput();
      return;
    }

    // F2: New Customer / Supplier Modal
    if (event.key === 'F2') {
      event.preventDefault();
      if (this.billingMode() === 'SALE') {
        this.showCustomerModal = true;
      } else {
        this.showSupplierModal = true;
      }
      return;
    }

    // F4: UPI QR & Online Payment Modal
    if (event.key === 'F4') {
      event.preventDefault();
      if (this.cart().length > 0) {
        this.openPaymentQrModal();
      } else {
        this.toast.warning('Cart Empty', 'कृपया पहले कार्ट में सामान जोड़ें।');
      }
      return;
    }

    // F6: Hold Current Bill
    if (event.key === 'F6') {
      event.preventDefault();
      this.holdCurrentBill();
      return;
    }

    // F7: Open Pending Bills
    if (event.key === 'F7') {
      event.preventDefault();
      this.showPendingBillsModal.set(true);
      return;
    }

    // F8: Cash Tender & Change Calculator
    if (event.key === 'F8') {
      event.preventDefault();
      this.openChangeModal();
      return;
    }

    // F9: Save & Submit Bill
    if (event.key === 'F9') {
      event.preventDefault();
      if (!this.submitting && this.cart().length > 0) {
        this.submitBill();
      }
      return;
    }

    // Escape: Close all active modals
    if (event.key === 'Escape') {
      this.closeAllModals();
    }
  }

  ngOnInit() {
    this.updateBillClock();
    this.billClockTimer = setInterval(() => this.updateBillClock(), 1000);

    this.initCustomerForm();
    this.initSupplierForm();
    this.initDoctorForm();
    this.loadCustomers();
    this.loadSuppliers();
    this.loadDoctors();
    this.loadShopSettings();
    this.loadPendingBills();
    this.isInterState.set(this.shop()?.state !== 'Delhi'); // fallback state check

    // ✏️ Check if an existing Sale Bill is requested to be edited
    this.route.queryParams.subscribe(params => {
      if (params['editSaleId']) {
        this.loadSaleForEdit(params['editSaleId']);
      }
    });
  }

  // ✏️ Load Sale Bill for Editing
  loadSaleForEdit(saleId: string) {
    this.api.get<any>(`/sales/${saleId}`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const sale = res.data;
          this.editingSaleId.set(sale._id);
          this.editingInvoiceNumber.set(sale.invoiceNumber);
          this.billingMode.set('SALE');
          this.selectedCustomerId = sale.customerId?._id || sale.customerId || '';
          this.selectedCustomerName = sale.customerName || 'Walk-in Customer';
          this.selectedCustomerMobile = sale.customerMobile || '';
          this.selectedCustomerGstin = sale.customerGstin || '';
          this.doctorName.set(sale.doctorName || '');
          this.doctorId.set(sale.doctorId || '');
          this.doctorRegNumber.set(sale.doctorRegNumber || '');
          this.patientName.set(sale.patientName || '');
          this.patientAge.set(sale.patientAge || '');
          this.patientGender.set(sale.patientGender || '');
          this.prescriptionRef.set(sale.prescriptionRef || '');
          this.isPrescriptionBill.set(!!sale.isPrescription);
          this.isInterState.set(!!sale.isInterState);
          this.paymentMethod = sale.paymentMethod || 'CASH';
          this.amountPaid = sale.amountPaid || 0;
          this.notes = sale.notes || '';
          
          const cartItems: CartItem[] = (sale.items || []).map((item: any) => ({
            ...item,
            productId: item.productId || ('CUSTOM_' + Math.random().toString(36).substring(2, 7)),
            productName: item.productName,
            quantity: item.quantity,
            unit: item.unit || 'PCS',
            rate: item.rate,
            mrp: item.mrp || item.rate,
            discount: item.discount || 0,
            discountType: item.discountType || 'PERCENT',
            gstPercent: item.gstPercent || 0,
            cgst: item.cgst || 0,
            sgst: item.sgst || 0,
            igst: item.igst || 0,
            hsnCode: item.hsnCode || '',
            subtotal: item.subtotal || (item.quantity * item.rate),
            totalGst: item.totalGst || 0,
            total: item.total || (item.quantity * item.rate),
            gstInclusive: false,
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || null,
            genericName: item.genericName || '',
            rackLocation: item.rackLocation || '',
            tabletsPerStrip: item.tabletsPerStrip || 10,
            isTabletUnit: item.isTabletUnit || false
          }));
          this.cart.set(cartItems);
          this.calculateTotals();
          this.toast.info('बिल संपादन मोड (Edit Mode)', `बिल नं. ${sale.invoiceNumber} लोड हो गया है। आप बिल में आइटम व पेमेंट एडिट कर सकते हैं।`);
        }
      },
      error: () => {
        this.toast.error('त्रुटि', 'पुराना बिल लोड नहीं हो सका।');
      }
    });
  }

  // ✕ Cancel Edit Mode
  cancelEditMode() {
    this.editingSaleId.set(null);
    this.editingInvoiceNumber.set('');
    this.cart.set([]);
    this.calculateTotals();
    this.router.navigate(['/billing']);
    this.toast.info('एडिट मोड बंद', 'नया बिलिंग मोड सक्रिय हो गया है।');
  }

  ngOnDestroy() {
    if (this.billClockTimer) clearInterval(this.billClockTimer);
  }

  setBillingMode(mode: 'SALE' | 'PURCHASE') {
    if (this.billingMode() === mode) return;
    this.billingMode.set(mode);
    this.toast.info(
      'मोड बदला गया', 
      mode === 'SALE' 
        ? '🟢 बिक्री बिल मोड (Sale POS Bill)' 
        : '🔵 खरीद बिल मोड (Purchase Inward Bill)'
    );
  }

  private updateBillClock() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = now.toLocaleString('en-IN', { month: 'short' });
    const year = now.getFullYear();
    this.liveBillDate.set(`${day} ${month} ${year}`);
    this.liveBillTime.set(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
  }

  loadPendingBills() {
    try {
      const saved = localStorage.getItem('mks_pending_bills');
      if (saved) {
        this.pendingBills.set(JSON.parse(saved));
      }
    } catch (e) {
      this.pendingBills.set([]);
    }
  }

  savePendingBillsToStorage() {
    localStorage.setItem('mks_pending_bills', JSON.stringify(this.pendingBills()));
  }

  loadShopSettings() {
    this.api.get<any>('/settings').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const upi = res.data.upiId || this.shop()?.upiId || '';
          const name = res.data.upiName || this.shop()?.upiName || this.shop()?.ownerName || this.shop()?.name || '';
          this.shopUpiId.set(upi);
          this.shopUpiName.set(name);
          this.enableCreditLimitBlock.set(res.data.enableCreditLimitBlock !== false);
          this.defaultCreditLimit.set(res.data.defaultCreditLimit || 10000);
        }
      },
      error: () => {
        const upi = this.shop()?.upiId || '';
        const name = this.shop()?.upiName || this.shop()?.ownerName || this.shop()?.name || '';
        this.shopUpiId.set(upi);
        this.shopUpiName.set(name);
      }
    });
  }

  initCustomerForm() {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: [''],
      address: [''],
      gstin: ['']
    });
  }

  loadCustomers() {
    this.api.get<any>('/customers', { limit: 500 }).subscribe({
      next: (res) => { if (res.success) this.customers.set(res.data); }
    });
  }

  initSupplierForm() {
    this.supplierForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      companyName: [''],
      mobile: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      email: ['', Validators.email],
      address: [''],
      gstin: [''],
      drugLicenseNumber: ['']
    });
  }

  loadSuppliers() {
    this.api.get<any>('/suppliers').subscribe({
      next: (res) => { if (res.success) this.suppliers.set(res.data || []); }
    });
  }

  onSupplierChange(id: string) {
    if (!id) {
      this.selectedSupplierId = '';
      this.selectedSupplierName = '';
      this.selectedSupplierMobile = '';
      this.selectedSupplierGstin = '';
      return;
    }
    const sup = this.suppliers().find(s => s._id === id);
    if (sup) {
      this.selectedSupplierId = sup._id;
      this.selectedSupplierName = sup.name || sup.companyName;
      this.selectedSupplierMobile = sup.mobile || '';
      this.selectedSupplierGstin = sup.gstin || '';
    }
  }

  saveSupplier() {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      return;
    }
    this.api.post<any>('/suppliers', this.supplierForm.value).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('सप्लायर सुरक्षित', 'नया सप्लायर सफलतापूर्वक जोड़ दिया गया।');
          this.loadSuppliers();
          this.selectedSupplierId = res.data._id;
          this.selectedSupplierName = res.data.name;
          this.selectedSupplierMobile = res.data.mobile;
          this.selectedSupplierGstin = res.data.gstin || '';
          this.showSupplierModal = false;
          this.supplierForm.reset();
        }
      },
      error: (err) => {
        this.toast.error('त्रुटि', err.error?.message || 'सप्लायर नहीं जोड़ा जा सका।');
      }
    });
  }

  initDoctorForm() {
    this.doctorForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      clinic: [''],
      regNumber: [''],
      mobile: [''],
      specialization: [''],
      address: ['']
    });
  }

  loadDoctors() {
    this.api.get<any>('/doctors').subscribe({
      next: (res) => { if (res.success) this.doctors.set(res.data || []); }
    });
  }

  onDoctorChange(id: string) {
    if (!id) {
      this.doctorId.set('');
      this.doctorName.set('');
      this.doctorRegNumber.set('');
      return;
    }
    const doc = this.doctors().find(d => d._id === id);
    if (doc) {
      this.doctorId.set(doc._id);
      this.doctorName.set(doc.name + (doc.clinic ? ` (${doc.clinic})` : ''));
      this.doctorRegNumber.set(doc.regNumber || '');
    }
  }

  saveDoctor() {
    if (this.doctorForm.invalid) {
      this.doctorForm.markAllAsTouched();
      return;
    }
    this.api.post<any>('/doctors', this.doctorForm.value).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('डॉक्टर सुरक्षित', 'डॉक्टर रजिस्ट्री में दर्ज कर लिया गया।');
          this.loadDoctors();
          this.doctorId.set(res.data._id);
          this.doctorName.set(res.data.name + (res.data.clinic ? ` (${res.data.clinic})` : ''));
          this.doctorRegNumber.set(res.data.regNumber || '');
          this.showDoctorModal = false;
          this.doctorForm.reset();
        }
      },
      error: (err) => {
        this.toast.error('त्रुटि', err.error?.message || 'डॉक्टर सुरक्षित नहीं हो सका।');
      }
    });
  }

  searchProducts(query: string) {
    if (!query.trim()) {
      this.searchResults.set([]);
      this.showDropdown = false;
      return;
    }

    this.api.get<any>('/products', { search: query, limit: 200 }).subscribe({
      next: (res) => {
        if (res.success) {
          this.searchResults.set(res.data);
          this.showDropdown = res.data.length > 0;
        }
      }
    });
  }

  // Add all search results to cart at once (useful for category-based search like "Kirana")
  addAllToCart() {
    const results = this.searchResults();
    if (results.length === 0) return;

    let skippedOutOfStock = 0;

    results.forEach((prod: any) => {
      if (this.billingMode() === 'SALE' && (Number(prod.quantity) || 0) <= 0) {
        skippedOutOfStock++;
        return;
      }

      const existing = this.cart().find(item => item.productId === prod._id);
      if (existing) {
        if (this.billingMode() === 'SALE') {
          const maxStock = (existing.stockQty !== undefined && existing.stockQty !== null) ? existing.stockQty : (Number(prod.quantity) || 0);
          if (existing.quantity + 1 > maxStock) {
            return;
          }
        }
        this.updateQty(existing, existing.quantity + 1);
      } else {
        const itemRate = this.billingMode() === 'PURCHASE' ? (prod.purchasePrice || prod.sellingPrice || 0) : prod.sellingPrice;
        const newItem: CartItem = {
          productId: prod._id,
          productName: prod.name,
          sku: prod.sku,
          barcode: prod.barcode,
          quantity: 1,
          unit: prod.unit || 'PCS',
          rate: itemRate,
          mrp: prod.mrp || prod.sellingPrice,
          purchasePrice: prod.purchasePrice || 0,
          discount: 0,
          discountType: 'PERCENT',
          gstPercent: prod.gstPercent || 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          hsnCode: prod.hsnCode,
          subtotal: 0,
          totalGst: 0,
          total: 0,
          gstInclusive: prod.gstInclusive || false,
          priceTier: 'RETAIL',
          stockQty: prod.quantity !== undefined ? Number(prod.quantity) : undefined,
          minStockLevel: prod.minStockLevel || 5
        };
        this.cart.update(items => [...items, newItem]);
        this.calculateRow(newItem);
      }
    });

    if (skippedOutOfStock > 0) {
      this.toast.warning('स्टॉक सूचना', `${skippedOutOfStock} प्रोडक्ट का स्टॉक 0 होने के कारण नहीं जोड़े गए।`);
    }

    this.searchQuery = '';
    this.searchResults.set([]);
    this.showDropdown = false;
    this.calculateTotals();
  }

  // Handle barcode scanner Enter press
  onBarcodeScan(event: any) {
    const code = this.searchQuery.trim();
    if (!code) return;

    this.api.get<any>(`/products/barcode/${code}`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.addToCart(res.data);
          this.searchQuery = '';
          this.searchResults.set([]);
          this.showDropdown = false;
        }
      },
      error: () => {
        // Fallback to name search if barcode lookup fails
        this.searchProducts(code);
      }
    });
  }

  addToCart(prod: any) {
    if (this.billingMode() === 'SALE') {
      const availStock = Number(prod.quantity) || 0;
      if (availStock <= 0) {
        this.toast.error('आउट ऑफ स्टॉक (Out of Stock)', `"${prod.name}" का स्टॉक उपलब्ध नहीं है (उपलब्ध स्टॉक: 0)।`);
        return;
      }
    }

    const existing = this.cart().find(item => item.productId === prod._id);
    if (existing) {
      if (this.billingMode() === 'SALE') {
        const maxStock = (existing.stockQty !== undefined && existing.stockQty !== null) ? existing.stockQty : (Number(prod.quantity) || 0);
        if (existing.quantity + 1 > maxStock) {
          this.toast.warning(
            'अपर्याप्त स्टॉक (Stock Limit)', 
            `"${existing.productName}" का उपलब्ध स्टॉक केवल ${maxStock} ${existing.unit || 'PCS'} है। आप इससे अधिक मात्रा नहीं जोड़ सकते।`
          );
          return;
        }
      }
      this.updateQty(existing, existing.quantity + 1);
    } else {
      let selectedBatch = null;
      let availableBatches: any[] = [];
      
      if (prod.batches && prod.batches.length > 0) {
        availableBatches = prod.batches.slice().sort((a: any, b: any) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        // FEFO: First Expiry First Out (pick first batch with quantity > 0, or first batch)
        selectedBatch = availableBatches.find((b: any) => (b.quantity || 0) > 0) || availableBatches[0];
      }

      const itemBatchNumber = selectedBatch ? selectedBatch.batchNumber : (prod.batchNumber || '');
      const itemExpiryDate = selectedBatch ? selectedBatch.expiryDate : (prod.expiryDate || null);
      const itemMrp = selectedBatch ? (selectedBatch.mrp || prod.mrp || prod.sellingPrice) : (prod.mrp || prod.sellingPrice);
      const itemRate = this.billingMode() === 'PURCHASE' 
        ? (selectedBatch?.purchasePrice || prod.purchasePrice || prod.sellingPrice || 0) 
        : (selectedBatch?.sellingPrice || prod.sellingPrice);
      const itemRack = selectedBatch ? (selectedBatch.rackLocation || prod.rackLocation || '') : (prod.rackLocation || '');
      const isLooseItem = prod.unit === 'KG' || prod.unit === 'GM' || prod.unit === 'LTR' || prod.unit === 'ML' || prod.isLoose === true;

      const currentStock = selectedBatch ? (selectedBatch.quantity ?? prod.quantity) : prod.quantity;

      const newItem: CartItem = {
        productId: prod._id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        quantity: isLooseItem ? 1 : 1,
        freeQuantity: 0,
        unit: prod.unit || 'PCS',
        rate: itemRate,
        mrp: itemMrp,
        purchasePrice: selectedBatch?.purchasePrice || prod.purchasePrice || 0,
        discount: 0,
        discountType: 'PERCENT',
        gstPercent: prod.gstPercent || 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        hsnCode: prod.hsnCode,
        subtotal: 0,
        totalGst: 0,
        total: 0,
        gstInclusive: prod.gstInclusive || false,
        priceTier: 'RETAIL',
        stockQty: currentStock !== undefined ? Number(currentStock) : undefined,
        minStockLevel: prod.minStockLevel || 5,
        // Specialized Industry Fields
        batchNumber: itemBatchNumber,
        expiryDate: itemExpiryDate,
        genericName: prod.genericName || prod.salt || '',
        prescriptionRequired: prod.prescriptionRequired || false,
        tabletsPerStrip: prod.tabletsPerStrip || 10,
        isTabletUnit: false,
        isLoose: isLooseItem,
        size: prod.size || '',
        color: prod.color || '',
        fabric: prod.fabric || '',
        imeiNumber: prod.imeiNumber || prod.serialNumber || '',
        warranty: prod.warranty || '',
        rackLocation: itemRack,
        availableBatches: availableBatches
      };
      this.cart.update(items => [...items, newItem]);
      this.calculateRow(newItem);
    }

    this.searchQuery = '';
    this.searchResults.set([]);
    this.showDropdown = false;
    this.calculateTotals();
  }

  // 💊 FEFO / Multi-Batch Switcher for Cart Items
  onBatchChange(item: CartItem, selectedBatchNo: string) {
    if (!item.availableBatches || item.availableBatches.length === 0) return;
    const found = item.availableBatches.find(b => b.batchNumber === selectedBatchNo);
    if (found) {
      item.batchNumber = found.batchNumber;
      item.expiryDate = found.expiryDate;
      if (found.mrp) item.mrp = found.mrp;
      if (this.billingMode() === 'SALE' && found.sellingPrice) {
        item.rate = found.sellingPrice;
      } else if (this.billingMode() === 'PURCHASE' && found.purchasePrice) {
        item.rate = found.purchasePrice;
      }
      if (found.rackLocation) item.rackLocation = found.rackLocation;
      if (found.quantity !== undefined) item.stockQty = found.quantity;
      this.calculateRow(item);
      this.calculateTotals();
      this.toast.info('Batch Switched', `बैच बदला गया: ${found.batchNumber} (Exp: ${new Date(found.expiryDate).toLocaleDateString('en-IN')})`);
    }
  }

  removeFromCart(item: CartItem) {
    this.cart.update(items => items.filter(i => i.productId !== item.productId));
    this.calculateTotals();
  }

  updateQty(item: CartItem, qty: number) {
    if (qty <= 0) return;
    if (this.billingMode() === 'SALE' && item.stockQty !== undefined && item.stockQty !== null) {
      if (qty > item.stockQty) {
        this.toast.warning(
          'अपर्याप्त स्टॉक (Insufficient Stock)',
          `"${item.productName}" का उपलब्ध स्टॉक केवल ${item.stockQty} ${item.unit || ''} है। उपलब्ध स्टॉक से अधिक का बिल नहीं बनाया जा सकता!`
        );
        item.quantity = Math.max(1, item.stockQty);
        this.calculateRow(item);
        this.calculateTotals();
        return;
      }
    }
    item.quantity = parseFloat(Number(qty).toFixed(3));
    this.calculateRow(item);
    this.calculateTotals();
  }

  // 🛒 Kirana: Quick Weight Multipliers (+100g, +250g, +500g, +1kg, +5kg)
  addLooseWeight(item: CartItem, gramsToAdd: number) {
    const currentKg = Number(item.quantity) || 0;
    const addKg = gramsToAdd / 1000;
    this.updateQty(item, currentKg + addKg);
  }

  setExactGrams(item: CartItem, grams: number) {
    const kg = grams / 1000;
    this.updateQty(item, kg);
  }

  // 💊 Medical: Toggle Strip vs Loose Tablet
  toggleStripTablet(item: CartItem) {
    const tabletsPerStrip = item.tabletsPerStrip || 10;
    item.isTabletUnit = !item.isTabletUnit;
    if (item.isTabletUnit) {
      item.rate = parseFloat((item.rate / tabletsPerStrip).toFixed(2));
      item.unit = 'TAB';
    } else {
      item.rate = parseFloat((item.rate * tabletsPerStrip).toFixed(2));
      item.unit = 'STRIP';
    }
    this.calculateRow(item);
    this.calculateTotals();
  }

  // 💊 Medical: Expiry Checker
  getExpiryBadge(dateStr: any): { label: string; bg: string; color: string } | null {
    if (!dateStr) return null;
    const exp = new Date(dateStr);
    if (isNaN(exp.getTime())) return null;
    const now = new Date();
    const diffMs = exp.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: '🔴 EXPIRED (' + Math.abs(diffDays) + 'd ago)', bg: '#fee2e2', color: '#991b1b' };
    } else if (diffDays <= 30) {
      return { label: '🟠 EXPIRING SOON (' + diffDays + 'd left)', bg: '#fef3c7', color: '#92400e' };
    } else if (diffDays <= 90) {
      return { label: '🟡 Near Exp (' + Math.round(diffDays / 30) + 'm)', bg: '#fef9c3', color: '#854d0e' };
    }
    return { label: '🟢 Fresh (' + (exp.getMonth() + 1) + '/' + exp.getFullYear() + ')', bg: '#dcfce7', color: '#166534' };
  }

  // 🏷️ Category Filter Tab Selection
  selectCategoryTab(category: string) {
    this.selectedCategoryTab.set(category);
    if (category.startsWith('सभी') || category.startsWith('All')) {
      this.searchProducts('');
    } else {
      // Extract clean text without emoji
      const cleanCat = category.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').replace(/[()]/g, '').trim();
      this.searchProducts(cleanCat);
    }
  }

  updateDiscount(item: CartItem, disc: number, type: 'PERCENT' | 'AMOUNT') {
    item.discount = disc;
    item.discountType = type;
    this.calculateRow(item);
    this.calculateTotals();
  }

  onQtyChange(item: CartItem, qty: any) {
    let val = parseFloat(qty);
    if (isNaN(val) || val <= 0) {
      val = 1;
    }
    if (this.billingMode() === 'SALE' && item.stockQty !== undefined && item.stockQty !== null) {
      if (val > item.stockQty) {
        this.toast.warning(
          'अपर्याप्त स्टॉक (Insufficient Stock)',
          `"${item.productName}" का उपलब्ध स्टॉक केवल ${item.stockQty} ${item.unit || ''} है। आप ${val} का बिल नहीं बना सकते!`
        );
        val = item.stockQty > 0 ? item.stockQty : 1;
      }
    }
    item.quantity = val;
    this.calculateRow(item);
    this.calculateTotals();
  }

  onRateChange(item: CartItem, rate: any) {
    const val = parseFloat(rate);
    item.rate = isNaN(val) ? 0 : val;
    this.calculateRow(item);
    this.calculateTotals();
  }

  onDiscountChange(item: CartItem, disc: any) {
    const val = parseFloat(disc);
    item.discount = isNaN(val) ? 0 : val;
    this.calculateRow(item);
    this.calculateTotals();
  }

  toggleDiscountType(item: CartItem) {
    item.discountType = item.discountType === 'PERCENT' ? 'AMOUNT' : 'PERCENT';
    this.calculateRow(item);
    this.calculateTotals();
  }

  calculateRow(item: CartItem) {
    let grossAmount = item.rate * item.quantity;
    let discountAmount = 0;

    if (item.discountType === 'PERCENT') {
      discountAmount = (grossAmount * item.discount) / 100;
    } else {
      discountAmount = item.discount;
    }

    const taxableAmount = grossAmount - discountAmount;
    let baseAmount = taxableAmount;
    let gstAmount = 0;

    if (item.gstInclusive) {
      baseAmount = (taxableAmount * 100) / (100 + item.gstPercent);
      gstAmount = taxableAmount - baseAmount;
    } else {
      gstAmount = (taxableAmount * item.gstPercent) / 100;
    }

    item.subtotal = parseFloat(baseAmount.toFixed(2));
    item.totalGst = parseFloat(gstAmount.toFixed(2));
    item.total = parseFloat((baseAmount + gstAmount).toFixed(2));

    // Loss-Selling Alert: Check if sold below purchase cost in Sale Mode
    if (this.billingMode() === 'SALE' && item.purchasePrice && item.purchasePrice > 0) {
      item.isBelowCost = (item.rate < item.purchasePrice);
    } else {
      item.isBelowCost = false;
    }

    if (this.isInterState()) {
      item.igst = item.totalGst;
      item.cgst = 0;
      item.sgst = 0;
    } else {
      item.cgst = parseFloat((item.totalGst / 2).toFixed(2));
      item.sgst = parseFloat((item.totalGst / 2).toFixed(2));
      item.igst = 0;
    }
  }

  calculateTotals() {
    let sub = 0;
    let gst = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let disc = 0;

    this.cart().forEach(item => {
      sub += item.subtotal;
      gst += item.totalGst;
      cgst += item.cgst;
      sgst += item.sgst;
      igst += item.igst;
      if (item.discountType === 'PERCENT') {
        disc += (item.rate * item.quantity * item.discount) / 100;
      } else {
        disc += item.discount;
      }
    });

    this.subtotal = parseFloat(sub.toFixed(2));
    this.totalGst = parseFloat(gst.toFixed(2));
    this.totalCgst = parseFloat(cgst.toFixed(2));
    this.totalSgst = parseFloat(sgst.toFixed(2));
    this.totalIgst = parseFloat(igst.toFixed(2));
    this.totalDiscount = parseFloat(disc.toFixed(2));

    const itemsTotal = this.subtotal + this.totalGst;
    const prevDueToAdd = (this.includePreviousDue() && this.selectedCustomerBalance() > 0) ? Number(this.selectedCustomerBalance()) : 0;
    const exactTotal = itemsTotal + prevDueToAdd;
    this.grandTotal = Math.round(exactTotal);
    this.roundOff = parseFloat((this.grandTotal - exactTotal).toFixed(2));

    if (this.paymentMethod !== 'CREDIT' && this.paymentMethod !== 'PARTIAL') {
      this.amountPaid = this.grandTotal;
    }
    this.balanceDue = Math.max(0, this.grandTotal - this.amountPaid);
    this.updateChangeReturn();
    this.saveDraftCart();
  }

  toggleIncludePreviousDue() {
    this.includePreviousDue.update(val => !val);
    this.calculateTotals();
  }

  private customerLookupTimer: any;

  onCustomerMobileInput(mobile: string) {
    this.selectedCustomerMobile = mobile;
    const clean = (mobile || '').trim();
    if (!clean) {
      if (!this.selectedCustomerId) {
        this.selectedCustomerBalance.set(0);
        this.includePreviousDue.set(false);
      }
      this.calculateTotals();
      return;
    }

    // 1. Fast immediate check in memory list
    const digitsOnly = clean.replace(/\D/g, '');
    const found = this.customers().find(c => {
      const cMob = (c.mobile || '').replace(/\D/g, '');
      return (cMob && digitsOnly && (cMob === digitsOnly || (digitsOnly.length >= 10 && cMob.endsWith(digitsOnly.slice(-10)))));
    });

    if (found) {
      this.selectCustomer(found);
    }

    // 2. Comprehensive live backend check across all database customer records & bills
    clearTimeout(this.customerLookupTimer);
    this.customerLookupTimer = setTimeout(() => {
      this.api.get<any>('/customers/lookup', { mobile: clean, name: this.selectedCustomerName }).subscribe({
        next: (res) => {
          if (res.success && res.found && res.data) {
            const cust = res.data;
            this.selectedCustomerId = cust._id || '';
            if (cust.name && (!this.selectedCustomerName || this.selectedCustomerName === 'Walk-in Customer')) {
              this.selectedCustomerName = cust.name;
            }
            if (cust.gstin) this.selectedCustomerGstin = cust.gstin;
            const due = Number(cust.pendingAmount) || 0;
            this.selectedCustomerBalance.set(due);
            this.selectedCustomerCreditLimit.set(cust.creditLimit || this.defaultCreditLimit());
            this.selectedCustomerTotalPurchases.set(cust.totalPurchases || 0);

            const isOver = this.enableCreditLimitBlock() && (due >= this.selectedCustomerCreditLimit());
            this.isCustomerOverCreditLimit.set(isOver);

            if (due > 0) {
              this.toast.warning(
                '🚨 पुराना बकाया अलर्ट (Previous Due Alert)',
                `ग्राहक "${this.selectedCustomerName}" का ₹${due.toLocaleString('en-IN')} पुराना उधार बाकी है!`
              );
            }
            this.calculateTotals();
          } else if (digitsOnly.length === 10 && !found) {
            this.selectedCustomerId = '';
            this.selectedCustomerBalance.set(0);
            this.includePreviousDue.set(false);
            this.calculateTotals();
          }
        },
        error: () => {}
      });
    }, 180);

    this.calculateTotals();
  }

  onCustomerNameInput(name: string) {
    this.selectedCustomerName = name;
    const clean = (name || '').trim();
    if (clean.length >= 3 && clean.toLowerCase() !== 'walk-in customer') {
      clearTimeout(this.customerLookupTimer);
      this.customerLookupTimer = setTimeout(() => {
        this.api.get<any>('/customers/lookup', { name: clean, mobile: this.selectedCustomerMobile }).subscribe({
          next: (res) => {
            if (res.success && res.found && res.data) {
              const cust = res.data;
              this.selectedCustomerId = cust._id || '';
              if (cust.mobile && !this.selectedCustomerMobile) {
                this.selectedCustomerMobile = cust.mobile;
              }
              if (cust.gstin) this.selectedCustomerGstin = cust.gstin;
              const due = Number(cust.pendingAmount) || 0;
              this.selectedCustomerBalance.set(due);
              this.selectedCustomerCreditLimit.set(cust.creditLimit || this.defaultCreditLimit());
              this.selectedCustomerTotalPurchases.set(cust.totalPurchases || 0);

              const isOver = this.enableCreditLimitBlock() && (due >= this.selectedCustomerCreditLimit());
              this.isCustomerOverCreditLimit.set(isOver);

              if (due > 0) {
                this.toast.warning(
                  '🚨 पुराना बकाया अलर्ट (Previous Due Alert)',
                  `ग्राहक "${cust.name}" का ₹${due.toLocaleString('en-IN')} पुराना उधार बाकी है!`
                );
              }
              this.calculateTotals();
            }
          },
          error: () => {}
        });
      }, 300);
    }
  }

  onCustomerChange(id: string) {
    if (!id) {
      this.selectCustomer('walk-in');
      return;
    }
    const customer = this.customers().find(c => c._id === id);
    this.selectCustomer(customer || 'walk-in');
  }

  selectCustomer(cust: any) {
    if (cust === 'walk-in') {
      this.selectedCustomerId = '';
      this.selectedCustomerName = 'Walk-in Customer';
      this.selectedCustomerMobile = '';
      this.selectedCustomerGstin = '';
      this.selectedCustomerBalance.set(0);
      this.includePreviousDue.set(false);
      this.selectedCustomerTotalPurchases.set(0);
      this.isCustomerOverCreditLimit.set(false);
    } else {
      this.selectedCustomerId = cust._id;
      this.selectedCustomerName = cust.name;
      this.selectedCustomerMobile = cust.mobile;
      this.selectedCustomerGstin = cust.gstin;
      const pending = cust.pendingAmount || 0;
      const limit = (cust.creditLimit !== undefined && cust.creditLimit !== null) ? cust.creditLimit : this.defaultCreditLimit();
      this.selectedCustomerBalance.set(pending);
      this.selectedCustomerTotalPurchases.set(cust.totalPurchases || 0);
      this.selectedCustomerCreditLimit.set(limit);
      
      const isOver = this.enableCreditLimitBlock() && (pending >= limit || cust.isCreditBlocked);
      this.isCustomerOverCreditLimit.set(isOver);
    }
    this.calculateTotals();
    this.saveDraftCart();
  }

  toggleGSTMode() {
    this.isInterState.update(val => !val);
    this.cart().forEach(item => this.calculateRow(item));
    this.calculateTotals();
  }

  setPaymentMethod(method: any) {
    this.paymentMethod = method;
    if (method === 'CREDIT') {
      this.amountPaid = 0;
    } else {
      this.amountPaid = this.grandTotal;
    }
    this.calculateTotals();
  }

  saveCustomer() {
    const rawMobile = (this.customerForm.get('mobile')?.value || '').toString().replace(/\D/g, '');
    const cleanMobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile;
    this.customerForm.patchValue({ mobile: cleanMobile });

    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      this.toast.warning('विवरण अधूरा है', 'कृपया ग्राहक का नाम और 10 अंकों का मान्य मोबाइल नंबर दर्ज करें।');
      return;
    }

    const formVal = this.customerForm.value;
    const body = {
      name: formVal.name?.trim(),
      mobile: cleanMobile,
      email: formVal.email?.trim() || undefined,
      gstin: formVal.gstin?.trim()?.toUpperCase() || undefined,
      address: formVal.address?.trim() || undefined
    };

    this.api.post<any>('/customers', body).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('सफल', res.message || 'Customer added successfully.');
          this.loadCustomers();
          this.selectCustomer(res.data);
          this.showCustomerModal = false;
          this.customerForm.reset();
        }
      },
      error: (err) => {
        this.toast.error('त्रुटि', err.error?.message || 'ग्राहक जोड़ने में समस्या आई।');
      }
    });
  }

  // --- Online Payment & QR Code Modal Methods ---
  async openPaymentQrModal() {
    if (this.cart().length === 0) {
      this.toast.warning('Empty Cart', 'कृपया पहले कार्ट में कम से कम 1 प्रोडक्ट जोड़ें।');
      return;
    }
    this.calculateTotals();
    const payeeName = this.shopUpiName() || this.shop()?.upiName || this.shop()?.ownerName || this.shop()?.name || 'MKS Store';
    const upi = this.shopUpiId() || this.shop()?.upiId || '';
    const total = this.grandTotal.toFixed(2);
    const upiUrl = `upi://pay?pa=${upi}&pn=${encodeURIComponent(payeeName)}&am=${total}&cu=INR&tn=${encodeURIComponent('Bill Payment ' + payeeName)}`;
    this.upiIntentUrl.set(upiUrl);

    try {
      const qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 320,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      this.qrCodeImageUrl.set(qrDataUrl);
    } catch (err) {
      this.qrCodeImageUrl.set(`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(upiUrl)}`);
    }

    this.paymentMethod = 'UPI';
    this.amountPaid = this.grandTotal;
    this.showPaymentQrModal.set(true);
  }

  payViaRazorpay() {
    if (typeof (window as any).Razorpay === 'undefined') {
      this.toast.error('Razorpay Error', 'Razorpay SDK लोड नहीं हो सका। कृपया इंटरनेट जांचें।');
      return;
    }

    this.isRazorpayLoading.set(true);
    const shopName = this.shop()?.name || 'MKS Billing Store';
    const amountInPaise = Math.round(this.grandTotal * 100);

    const options: any = {
      key: 'rzp_test_TR7vSW6DHXNObT',
      amount: amountInPaise,
      currency: 'INR',
      name: shopName,
      description: `Bill Payment - Total: ₹${this.grandTotal}`,
      image: 'https://cdn-icons-png.flaticon.com/512/9131/9131529.png',
      handler: (response: any) => {
        this.isRazorpayLoading.set(false);
        this.transactionReference = response.razorpay_payment_id || 'RZP_' + Date.now();
        this.paymentMethod = 'UPI';
        this.amountPaid = this.grandTotal;

        // 🔊 Soundbox Voice Announcement
        this.soundbox.announcePayment(this.grandTotal, this.shop()?.name || 'MKS Store');
        this.successAnnouncedAmount.set(this.grandTotal);
        this.showPaymentSuccessOverlay.set(true);

        setTimeout(() => {
          this.showPaymentSuccessOverlay.set(false);
          this.showPaymentQrModal.set(false);
          this.submitBill();
        }, 2200);
      },
      prefill: {
        name: this.selectedCustomerName || 'Customer',
        contact: this.selectedCustomerMobile || ''
      },
      notes: {
        shopName: shopName,
        totalItems: this.cart().length
      },
      theme: {
        color: '#4f46e5'
      },
      modal: {
        ondismiss: () => {
          this.isRazorpayLoading.set(false);
          this.toast.info('Payment Modal Closed', 'भुगतान विंडो बंद कर दी गई।');
        }
      }
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        this.isRazorpayLoading.set(false);
        this.toast.error('Payment Failed', resp.error?.description || 'भुगतान असफल रहा।');
      });
      this.isRazorpayLoading.set(false);
      rzp.open();
    } catch (err) {
      this.isRazorpayLoading.set(false);
      this.toast.error('Error', 'Razorpay खोलने में समस्या हुई।');
    }
  }

  confirmAndSaveBill() {
    this.paymentMethod = 'UPI';
    this.amountPaid = this.grandTotal;
    if (!this.transactionReference) {
      this.transactionReference = 'UPI_QR_' + Date.now().toString().slice(-6);
    }

    // 🔊 Smart Soundbox Chime + Hindi Voice Announcement
    this.soundbox.announcePayment(this.grandTotal, this.shop()?.name || 'दुकान');
    this.successAnnouncedAmount.set(this.grandTotal);
    this.showPaymentSuccessOverlay.set(true);

    // After celebration animation, proceed to submit bill
    setTimeout(() => {
      this.showPaymentSuccessOverlay.set(false);
      this.showPaymentQrModal.set(false);
      this.submitBill();
    }, 2200);
  }

  copyUpiLink() {
    const upi = this.shopUpiId();
    navigator.clipboard.writeText(upi).then(() => {
      this.toast.success('Copied!', `Shop UPI ID (${upi}) कॉपी हो गई है।`);
    });
  }

  // --- 1. Pending / Hold Bill Operations ---
  holdCurrentBill() {
    if (this.cart().length === 0) {
      this.toast.warning('Empty Cart', 'पेंडिंग में रखने के लिए पहले कार्ट में आइटम जोड़ें।');
      return;
    }

    const pendingItem = {
      id: 'HOLD_' + Date.now(),
      title: `${this.selectedCustomerName || 'Walk-in'} (₹${this.grandTotal})`,
      cart: JSON.parse(JSON.stringify(this.cart())),
      customerId: this.selectedCustomerId,
      customerName: this.selectedCustomerName,
      customerMobile: this.selectedCustomerMobile,
      customerGstin: this.selectedCustomerGstin,
      paymentMethod: this.paymentMethod,
      subtotal: this.subtotal,
      grandTotal: this.grandTotal,
      isInterState: this.isInterState(),
      notes: this.notes,
      itemCount: this.cart().length,
      timestamp: new Date().toISOString()
    };

    const updated = [pendingItem, ...this.pendingBills()];
    this.pendingBills.set(updated);
    this.savePendingBillsToStorage();

    // Clear current cart for next customer
    this.clearCart(false);
    this.toast.success('Bill Placed on Hold', 'बिल पेंडिंग बॉक्स में सुरक्षित रख दिया गया है। आप नए ग्राहक का बिल बना सकते हैं।');
  }

  restorePendingBill(bill: any) {
    if (this.cart().length > 0) {
      if (!confirm('वर्तमान कार्ट में पहले से आइटम हैं। क्या आप पेंडिंग बिल को लोड करना चाहते हैं?')) {
        return;
      }
    }

    this.cart.set(bill.cart || []);
    this.selectedCustomerId = bill.customerId || '';
    this.selectedCustomerName = bill.customerName || 'Walk-in Customer';
    this.selectedCustomerMobile = bill.customerMobile || '';
    this.selectedCustomerGstin = bill.customerGstin || '';
    this.paymentMethod = bill.paymentMethod || 'CASH';
    this.notes = bill.notes || '';
    if (typeof bill.isInterState === 'boolean') {
      this.isInterState.set(bill.isInterState);
    }

    // Remove from pending list
    const filtered = this.pendingBills().filter(b => b.id !== bill.id);
    this.pendingBills.set(filtered);
    this.savePendingBillsToStorage();

    // Recalculate totals
    this.cart().forEach(item => this.calculateRow(item));
    this.calculateTotals();

    this.showPendingBillsModal.set(false);
    this.toast.success('Bill Resumed', 'पेंडिंग बिल सफलतापूर्वक कार्ट में लोड हो गया है।');
  }

  deletePendingBill(billId: string, event?: Event) {
    if (event) event.stopPropagation();
    if (!confirm('क्या आप इस पेंडिंग बिल को हटाना चाहते हैं?')) return;
    const filtered = this.pendingBills().filter(b => b.id !== billId);
    this.pendingBills.set(filtered);
    this.savePendingBillsToStorage();
    this.toast.info('Deleted', 'पेंडिंग बिल हटा दिया गया है।');
  }

  startNewBill(autoHold = true) {
    if (this.cart().length > 0 && autoHold) {
      // Automatically place active cart onto Hold so it's not lost
      const pendingItem = {
        id: 'HOLD_' + Date.now(),
        title: `${this.selectedCustomerName || 'Walk-in'} (₹${this.grandTotal})`,
        cart: JSON.parse(JSON.stringify(this.cart())),
        customerId: this.selectedCustomerId,
        customerName: this.selectedCustomerName,
        customerMobile: this.selectedCustomerMobile,
        customerGstin: this.selectedCustomerGstin,
        paymentMethod: this.paymentMethod,
        subtotal: this.subtotal,
        grandTotal: this.grandTotal,
        isInterState: this.isInterState(),
        notes: this.notes,
        itemCount: this.cart().length,
        timestamp: new Date().toISOString()
      };

      this.pendingBills.update(bills => [pendingItem, ...bills]);
      this.savePendingBillsToStorage();
      this.toast.info('बिल होल्ड पर रखा गया', 'पिछला बिल होल्ड सूची में सुरक्षित रख दिया गया है। नया बिल तैयार है!');
    }

    // Completely reset cart and all bill state
    this.cart.set([]);
    this.selectedCustomerId = '';
    this.selectedCustomerName = 'Walk-in Customer';
    this.selectedCustomerMobile = '';
    this.selectedCustomerGstin = '';
    this.selectedCustomerBalance.set(0);
    this.selectedCustomerTotalPurchases.set(0);
    this.notes = '';
    this.transactionReference = '';
    this.paymentMethod = 'CASH';
    this.cashReceived.set(0);
    this.changeReturn.set(0);
    try { localStorage.removeItem('mks_billing_draft'); } catch(e) {}
    this.calculateTotals();
    this.focusSearchInput();
  }

  clearCart(showConfirm = true) {
    if (showConfirm && this.cart().length > 0) {
      if (!confirm('क्या आप कार्ट को खाली करना चाहते हैं?')) return;
    }
    this.cart.set([]);
    this.selectedCustomerId = '';
    this.selectedCustomerName = 'Walk-in Customer';
    this.selectedCustomerMobile = '';
    this.selectedCustomerGstin = '';
    this.selectedCustomerBalance.set(0);
    this.selectedCustomerTotalPurchases.set(0);
    this.notes = '';
    this.transactionReference = '';
    this.paymentMethod = 'CASH';
    this.cashReceived.set(0);
    this.changeReturn.set(0);
    try { localStorage.removeItem('mks_billing_draft'); } catch(e) {}
    this.calculateTotals();
    if (showConfirm) {
      this.toast.info('Cart Cleared', 'कार्ट खाली कर दिया गया है।');
    }
    this.focusSearchInput();
  }

  // --- 2. Multiple Products Bulk Selector Operations ---
  openBulkProductModal() {
    this.api.get<any>('/products', { limit: 500 }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allProductsList.set(res.data);
          // extract unique categories
          const cats = Array.from(new Set(res.data.map((p: any) => p.category).filter(Boolean))) as string[];
          this.bulkCategories.set(cats);
          this.filterBulkProducts();
          this.showBulkModal.set(true);
        }
      },
      error: () => {
        this.toast.error('Error', 'प्रोडक्ट सूची लोड नहीं हो सकी।');
      }
    });
  }

  filterBulkProducts() {
    const text = this.bulkSearchText().toLowerCase().trim();
    const cat = this.bulkCategoryFilter();

    const filtered = this.allProductsList().filter(p => {
      const matchCat = cat === 'ALL' || p.category === cat;
      const matchText = !text || 
        p.name?.toLowerCase().includes(text) || 
        p.sku?.toLowerCase().includes(text) || 
        p.barcode?.includes(text);
      return matchCat && matchText;
    });

    this.bulkFilteredProducts.set(filtered);
  }

  toggleBulkItem(prod: any) {
    const map = { ...this.bulkSelectionMap() };
    if (map[prod._id]?.selected) {
      delete map[prod._id];
    } else {
      map[prod._id] = { selected: true, qty: 1, prod };
    }
    this.bulkSelectionMap.set(map);
  }

  isBulkItemSelected(prodId: string): boolean {
    return !!this.bulkSelectionMap()[prodId]?.selected;
  }

  getBulkItemQty(prodId: string): number {
    return this.bulkSelectionMap()[prodId]?.qty || 1;
  }

  updateBulkQty(prodId: string, deltaOrVal: number, isDirect = false, event?: Event) {
    if (event) event.stopPropagation();
    const map = { ...this.bulkSelectionMap() };
    if (!map[prodId]) return;

    let newQty = isDirect ? deltaOrVal : (map[prodId].qty + deltaOrVal);
    if (newQty < 1) newQty = 1;
    map[prodId].qty = newQty;
    this.bulkSelectionMap.set(map);
  }

  selectAllBulkFiltered(select: boolean) {
    const map = { ...this.bulkSelectionMap() };
    this.bulkFilteredProducts().forEach(prod => {
      if (select) {
        if (!map[prod._id]) {
          map[prod._id] = { selected: true, qty: 1, prod };
        }
      } else {
        delete map[prod._id];
      }
    });
    this.bulkSelectionMap.set(map);
  }

  getSelectedBulkCount(): number {
    return Object.keys(this.bulkSelectionMap()).length;
  }

  applyBulkSelectionToCart() {
    const map = this.bulkSelectionMap();
    const keys = Object.keys(map);
    if (keys.length === 0) {
      this.toast.warning('No Items Selected', 'कृपया कम से कम एक प्रोडक्ट चुनें।');
      return;
    }

    let cappedCount = 0;
    let addedCount = 0;

    keys.forEach(id => {
      const entry = map[id];
      if (entry && entry.selected) {
        const prod = entry.prod;
        let qty = entry.qty || 1;
        const avail = prod.quantity !== undefined ? Number(prod.quantity) : 999999;

        if (this.billingMode() === 'SALE') {
          if (avail <= 0) {
            cappedCount++;
            return;
          }
          if (qty > avail) {
            qty = avail;
            cappedCount++;
          }
        }

        const existing = this.cart().find(item => item.productId === prod._id);
        if (existing) {
          const totalQty = existing.quantity + qty;
          const maxStock = (existing.stockQty !== undefined && existing.stockQty !== null) ? existing.stockQty : avail;
          if (this.billingMode() === 'SALE' && totalQty > maxStock) {
            this.updateQty(existing, maxStock);
            cappedCount++;
          } else {
            this.updateQty(existing, totalQty);
          }
          addedCount++;
        } else {
          const itemRate = this.billingMode() === 'PURCHASE' ? (prod.purchasePrice || prod.sellingPrice || 0) : prod.sellingPrice;
          const newItem: CartItem = {
            productId: prod._id,
            productName: prod.name,
            sku: prod.sku,
            barcode: prod.barcode,
            quantity: qty,
            unit: prod.unit || 'PCS',
            rate: itemRate,
            mrp: prod.mrp,
            discount: 0,
            discountType: 'PERCENT',
            gstPercent: prod.gstPercent || 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            hsnCode: prod.hsnCode,
            subtotal: 0,
            totalGst: 0,
            total: 0,
            gstInclusive: prod.gstInclusive || false,
            stockQty: prod.quantity !== undefined ? Number(prod.quantity) : undefined,
            minStockLevel: prod.minStockLevel || 5
          };
          this.cart.update(items => [...items, newItem]);
          this.calculateRow(newItem);
          addedCount++;
        }
      }
    });

    this.bulkSelectionMap.set({});
    this.showBulkModal.set(false);
    this.calculateTotals();
    
    if (cappedCount > 0) {
      this.toast.warning('स्टॉक सीमा', 'कुछ आइटम की मात्रा उपलब्ध स्टॉक सीमा तक सीमित कर दी गई है।');
    }
    this.toast.success('Added to Bill', `${addedCount} प्रोडक्ट्स बिल में जोड़ दिए गए हैं!`);
  }

  // --- 3. Custom Quick Item Operations ---
  openCustomItemModal() {
    this.customItemName.set('');
    this.customItemRate.set(0);
    this.customItemQty.set(1);
    this.customItemUnit.set('PCS');
    this.customItemGst.set(0);
    this.showCustomItemModal.set(true);
  }

  addCustomItemToCart() {
    const name = this.customItemName().trim();
    const rate = this.customItemRate();
    const qty = this.customItemQty() || 1;

    if (!name) {
      this.toast.warning('Name Required', 'कृपया आइटम का नाम दर्ज करें।');
      return;
    }
    if (rate <= 0) {
      this.toast.warning('Rate Required', 'कृपया सही दर / कीमत (Rate) दर्ज करें।');
      return;
    }

    const customId = 'CUSTOM_' + Date.now();
    const newItem: CartItem = {
      productId: customId,
      productName: name,
      quantity: qty,
      unit: this.customItemUnit() || 'PCS',
      rate: rate,
      mrp: rate,
      discount: 0,
      discountType: 'PERCENT',
      gstPercent: this.customItemGst() || 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      subtotal: 0,
      totalGst: 0,
      total: 0,
      gstInclusive: false
    };

    this.cart.update(items => [...items, newItem]);
    this.calculateRow(newItem);
    this.calculateTotals();
    this.showCustomItemModal.set(false);
    this.toast.success('Item Added', `${name} को कार्ट में जोड़ दिया गया है।`);
  }

  submitBill() {
    if (this.cart().length === 0) {
      this.toast.warning('खाली कार्ट', 'कृपया कम से कम एक प्रोडक्ट बिल में जोड़ें।');
      return;
    }

    if (this.billingMode() === 'SALE') {
      // 📦 Pre-flight Stock Validation in Cart
      for (const item of this.cart()) {
        if (item.stockQty !== undefined && item.stockQty !== null) {
          if (item.quantity > item.stockQty) {
            this.toast.error(
              'अपर्याप्त स्टॉक (Insufficient Stock)',
              `"${item.productName}" का उपलब्ध स्टॉक केवल ${item.stockQty} ${item.unit || ''} है, जबकि बिल में ${item.quantity} मात्रा दर्ज है। बिल नहीं बन सकता!`
            );
            return;
          }
        }
      }

      // ================= SALE BILLING =================
      const cName = (this.selectedCustomerName || '').trim();
      const rawMobile = (this.selectedCustomerMobile || '').trim().replace(/\D/g, '');

      // 👤 1. Customer Name Validation
      if (!cName || (cName.toLowerCase() === 'walk-in customer' && !rawMobile)) {
        this.toast.warning('ग्राहक का नाम आवश्यक (Customer Name Required)', 'कृपया बिल बनाने के लिए ग्राहक का सही नाम दर्ज करें।');
        return;
      }

      // 📱 2. Customer Mobile Number Validation (Required for WhatsApp & Broadcast)
      if (!rawMobile || rawMobile.length < 10) {
        this.toast.warning('10-अंकों का मोबाइल नंबर आवश्यक (Mobile Required)', 'कृपया ग्राहक का 10 अंकों का वैध मोबाइल नंबर दर्ज करें (ताकि WhatsApp इनवॉइस व स्टॉक ब्रॉडकास्ट में स्वतः सेव हो सके)।');
        return;
      }

      if (this.paymentMethod === 'CREDIT' && !this.selectedCustomerId) {
        this.toast.warning('ग्राहक आवश्यक', 'उधार बिक्री के लिए ग्राहक विवरण अनिवार्य है।');
        return;
      }

      // 🚨 Check Overdue Credit Limit
      if (this.isCustomerOverCreditLimit() && (this.paymentMethod === 'CREDIT' || this.balanceDue > 0)) {
        this.toast.error(
          'उधार सीमा पार (Credit Blocked)', 
          `इस ग्राहक का पिछला उधार ₹${this.selectedCustomerBalance().toLocaleString('en-IN')} है (अधिकतम सीमा ₹${this.selectedCustomerCreditLimit().toLocaleString('en-IN')})। पहले पुराना बकाया जमा करवाएं, फिर माल दें!`
        );
        this.openCollectDueModal();
        return;
      }

      this.submitting = true;
      const paymentDetails = [{
        method: this.paymentMethod,
        amount: this.amountPaid,
        reference: this.transactionReference
      }];

      const saleItems = this.cart().map(item => ({
        ...item,
        productId: (item.productId && (item.productId.startsWith('FAST_') || item.productId.startsWith('CUSTOM_'))) ? null : item.productId,
        batchNumber: item.batchNumber || '',
        expiryDate: item.expiryDate || null,
        genericName: item.genericName || '',
        rackLocation: item.rackLocation || '',
        isTabletUnit: item.isTabletUnit || false,
        tabletsPerStrip: item.tabletsPerStrip || 10
      }));

      const payload = {
        customerId: this.selectedCustomerId || null,
        customerName: this.selectedCustomerName,
        customerMobile: this.selectedCustomerMobile,
        customerGstin: this.selectedCustomerGstin,
        doctorId: this.doctorId() || null,
        doctorName: this.doctorName() || '',
        doctorRegNumber: this.doctorRegNumber() || '',
        patientName: this.patientName() || '',
        patientAge: this.patientAge() || '',
        patientGender: this.patientGender() || '',
        prescriptionRef: this.prescriptionRef() || '',
        isPrescription: this.isPrescriptionBill(),
        items: saleItems,
        subtotal: this.subtotal,
        totalDiscount: this.totalDiscount,
        totalCgst: this.totalCgst,
        totalSgst: this.totalSgst,
        totalIgst: this.totalIgst,
        totalGst: this.totalGst,
        isInterState: this.isInterState(),
        roundOff: this.roundOff,
        previousDue: (this.includePreviousDue() && this.selectedCustomerBalance() > 0) ? this.selectedCustomerBalance() : 0,
        grandTotal: this.grandTotal,
        amountPaid: this.amountPaid,
        paymentMethod: this.paymentMethod,
        paymentDetails,
        invoiceDate: new Date().toISOString(),
        notes: this.notes
      };

      if (this.editingSaleId()) {
        this.api.put<any>(`/sales/${this.editingSaleId()}`, payload).subscribe({
          next: (res) => {
            this.submitting = false;
            const updatedId = this.editingSaleId();
            const invNo = this.editingInvoiceNumber();
            this.editingSaleId.set(null);
            this.editingInvoiceNumber.set('');
            this.toast.success('बिल अपडेट सफल', `Sale Invoice ${invNo} सफलतापूर्वक अपडेट हो गया।`);
            this.router.navigate(['/billing', updatedId, 'invoice']);
          },
          error: (err) => {
            this.submitting = false;
            this.toast.error('Update Failed', err.error?.message || 'बिल अपडेट नहीं हो सका।');
          }
        });
      } else {
        this.api.post<any>('/sales', payload).subscribe({
          next: (res) => {
            this.submitting = false;
            this.toast.success('बिक्री बिल तैयार', `Sale Invoice ${res.data?.invoiceNumber || ''} सुरक्षित हो गया।`);
            if (res?.data) {
              this.liveNotif.pushSaleNotification(res.data);
            }
            this.router.navigate(['/billing', res.data._id, 'invoice']);
          },
          error: (err) => {
            this.submitting = false;
            this.toast.error('Billing Failed', err.error?.message || 'बिक्री बिल सुरक्षित नहीं हो सका।');
          }
        });
      }
    } else {
      // ================= PURCHASE BILLING =================
      this.submitting = true;
      const purchaseItems = this.cart().map(item => ({
        productId: (item.productId && item.productId.startsWith('CUSTOM_')) ? null : item.productId,
        productName: item.productName,
        sku: item.sku,
        quantity: item.quantity,
        freeQuantity: item.freeQuantity || 0,
        batchNumber: item.batchNumber || '',
        expiryDate: item.expiryDate || null,
        rackLocation: item.rackLocation || '',
        unit: item.unit,
        purchasePrice: item.rate,
        mrp: item.mrp || item.rate,
        sellingPrice: item.mrp || item.rate,
        gstPercent: item.gstPercent || 0,
        cgst: item.cgst || 0,
        sgst: item.sgst || 0,
        igst: item.igst || 0,
        hsnCode: item.hsnCode,
        subtotal: item.subtotal,
        totalGst: item.totalGst || 0,
        total: item.total
      }));

      const payload = {
        supplierId: this.selectedSupplierId || null,
        supplierName: this.selectedSupplierName || 'Direct Vendor',
        supplierInvoice: this.supplierInvoiceNo || '',
        items: purchaseItems,
        subtotal: this.subtotal,
        totalGst: this.totalGst,
        totalCgst: this.totalCgst,
        totalSgst: this.totalSgst,
        totalIgst: this.totalIgst,
        grandTotal: this.grandTotal,
        amountPaid: this.amountPaid,
        paymentMethod: this.paymentMethod,
        notes: this.notes
      };

      this.api.post<any>('/purchases', payload).subscribe({
        next: (res) => {
          this.submitting = false;
          this.savedPurchaseBill.set(res.data);
          this.showPurchaseBillModal.set(true);
          this.toast.success('खरीद बिल तैयार', `Purchase Bill ${res.data?.purchaseNumber || ''} सुरक्षित हुआ और स्टॉक बढ़ गया!`);
          this.cart.set([]);
          this.calculateTotals();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('Purchase Failed', err.error?.message || 'खरीद बिल सुरक्षित नहीं हो सका।');
        }
      });
    }
  }

  printPurchaseReceipt() {
    window.print();
  }

  // --- 4. Recent Payments Drawer/Modal ---
  openRecentPaymentsModal() {
    this.isRecentPaymentsLoading.set(true);
    this.api.get<any>('/payments', { limit: 15, status: 'SUCCESS' }).subscribe({
      next: (res) => {
        this.isRecentPaymentsLoading.set(false);
        if (res.success) {
          this.recentPayments.set(res.data || []);
          this.showRecentPaymentsModal.set(true);
        }
      },
      error: () => {
        this.isRecentPaymentsLoading.set(false);
        this.toast.error('Error', 'हाल के भुगतान लोड नहीं हो सके।');
      }
    });
  }

  // --- 5. Cash Tender & Change Return Methods ---
  openChangeModal() {
    if (this.grandTotal <= 0) {
      this.toast.warning('Cart Empty', 'कृपया पहले कार्ट में कम से कम एक सामान जोड़ें।');
      return;
    }
    this.cashReceived.set(this.grandTotal);
    this.updateChangeReturn();
    this.showChangeModal.set(true);
  }

  setCashTender(amount: number) {
    this.cashReceived.set(amount);
    this.updateChangeReturn();
  }

  addCashTender(delta: number) {
    const current = this.cashReceived() || 0;
    this.cashReceived.set(current + delta);
    this.updateChangeReturn();
  }

  onCashReceivedInput(val: number) {
    this.cashReceived.set(val || 0);
    this.updateChangeReturn();
  }

  updateChangeReturn() {
    const recv = this.cashReceived();
    const total = this.grandTotal;
    const change = Math.max(0, recv - total);
    this.changeReturn.set(parseFloat(change.toFixed(2)));
  }

  confirmCashAndSubmit() {
    this.paymentMethod = 'CASH';
    this.amountPaid = this.grandTotal;
    this.showChangeModal.set(false);
    this.submitBill();
  }

  // --- 6. WhatsApp Instant Share ---
  shareBillOnWhatsApp(customPhone?: string) {
    const phone = customPhone || this.selectedCustomerMobile;
    if (!phone) {
      this.toast.warning('Mobile Missing', 'व्हाट्सएप पर बिल भेजने के लिए ग्राहक का 10 अंकों का मोबाइल नंबर दर्ज करें।');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const mobileNo = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    
    const shopName = this.shop()?.name || 'MKS Store';
    const shopPhone = this.shop()?.mobile || '';
    
    let itemsList = '';
    this.cart().forEach((item, index) => {
      itemsList += `\n${index + 1}. *${item.productName}* (${item.quantity} ${item.unit}) - ₹${item.total}`;
    });

    const msg = `🧾 *${shopName.toUpperCase()} - INVOICE ESTIMATE*\n` +
      `📅 *Date:* ${this.liveBillDate()} ${this.liveBillTime()}\n` +
      `👤 *Customer:* ${this.selectedCustomerName}\n` +
      `--------------------------------\n` +
      `🛍️ *ITEMS:*${itemsList}\n` +
      `--------------------------------\n` +
      `💵 *Subtotal:* ₹${this.subtotal.toFixed(2)}\n` +
      (this.totalDiscount > 0 ? `🎁 *Discount:* ₹${this.totalDiscount.toFixed(2)}\n` : '') +
      `📊 *GST Total:* ₹${this.totalGst.toFixed(2)}\n` +
      `💰 *Grand Total:* ₹${this.grandTotal.toFixed(2)}\n` +
      `💳 *Paid:* ₹${this.amountPaid.toFixed(2)} (${this.paymentMethod})\n` +
      (this.balanceDue > 0 ? `⚠️ *Balance Due:* ₹${this.balanceDue.toFixed(2)}\n` : '') +
      (this.selectedCustomerBalance() > 0 ? `📒 *Old Pending Balance:* ₹${this.selectedCustomerBalance().toFixed(2)}\n` : '') +
      `--------------------------------\n` +
      `🙏 *Thank you for shopping with us!* \n` +
      (shopPhone ? `📞 Helpline: ${shopPhone}` : '');

    const url = `https://wa.me/${mobileNo}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    this.toast.success('WhatsApp Ready', 'व्हाट्सएप बिल विंडो खुल रही है...');
  }

  // --- 7. Fast-Billing Quick Item Actions ---
  addFastItemToCart(fastItem: any) {
    const customId = 'FAST_' + fastItem.name.replace(/\s+/g, '_') + '_' + Date.now();
    const newItem: CartItem = {
      productId: customId,
      productName: fastItem.name,
      quantity: 1,
      unit: fastItem.unit || 'PCS',
      rate: fastItem.rate,
      mrp: fastItem.rate,
      purchasePrice: parseFloat((fastItem.rate * 0.7).toFixed(2)),
      discount: 0,
      discountType: 'PERCENT',
      gstPercent: fastItem.gstPercent || 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      subtotal: 0,
      totalGst: 0,
      total: 0,
      gstInclusive: false,
      priceTier: 'RETAIL'
    };

    this.cart.update(items => [...items, newItem]);
    this.calculateRow(newItem);
    this.calculateTotals();
    this.toast.success('Quick Item Added', `${fastItem.name} कार्ट में जोड़ा गया।`);
  }

  // --- 8. Price Tier Switcher (Retail / Wholesale / MRP) ---
  setPriceTier(item: CartItem, tier: 'RETAIL' | 'WHOLESALE' | 'MRP') {
    item.priceTier = tier;
    if (tier === 'MRP' && item.mrp) {
      item.rate = item.mrp;
      item.discount = 0;
    } else if (tier === 'WHOLESALE') {
      if (item.mrp) {
        item.rate = parseFloat((item.mrp * 0.85).toFixed(2));
      } else {
        item.rate = parseFloat((item.rate * 0.9).toFixed(2));
      }
    } else if (tier === 'RETAIL') {
      if (item.mrp) {
        item.rate = item.mrp;
      }
    }
    this.calculateRow(item);
    this.calculateTotals();
  }

  // --- 9. Auto-Draft Cart Persistence ---
  saveDraftCart() {
    try {
      if (this.cart().length > 0) {
        const draft = {
          cart: this.cart(),
          selectedCustomerId: this.selectedCustomerId,
          selectedCustomerName: this.selectedCustomerName,
          selectedCustomerMobile: this.selectedCustomerMobile,
          selectedCustomerGstin: this.selectedCustomerGstin,
          billingMode: this.billingMode(),
          notes: this.notes,
          timestamp: Date.now()
        };
        localStorage.setItem('mks_billing_draft', JSON.stringify(draft));
      } else {
        localStorage.removeItem('mks_billing_draft');
      }
    } catch (e) {}
  }

  loadDraftCart() {
    try {
      const saved = localStorage.getItem('mks_billing_draft');
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && draft.timestamp && (Date.now() - draft.timestamp < 12 * 3600 * 1000)) {
          if (draft.cart && draft.cart.length > 0 && this.cart().length === 0) {
            this.cart.set(draft.cart);
            this.selectedCustomerId = draft.selectedCustomerId || '';
            this.selectedCustomerName = draft.selectedCustomerName || 'Walk-in Customer';
            this.selectedCustomerMobile = draft.selectedCustomerMobile || '';
            this.selectedCustomerGstin = draft.selectedCustomerGstin || '';
            this.notes = draft.notes || '';
            this.calculateTotals();
            this.toast.info('Draft Restored', 'पिछला ड्राफ्ट बिल सुरक्षित रूप से पुनः लोड कर दिया गया है।');
          }
        }
      }
    } catch (e) {}
  }

  focusSearchInput() {
    if (this.searchInputEl && this.searchInputEl.nativeElement) {
      this.searchInputEl.nativeElement.focus();
      this.searchInputEl.nativeElement.select();
    }
  }

  // --- 5. Quick Overdue Udhaar Collection ---
  openCollectDueModal() {
    this.collectDueAmount.set(this.selectedCustomerBalance());
    this.collectDuePaymentMode.set('CASH');
    this.collectDueNotes.set('POS Counter Old Due Payment');
    this.showCollectDueModal.set(true);
  }

  submitCollectDuePayment() {
    const amount = Number(this.collectDueAmount());
    if (!amount || amount <= 0) {
      this.toast.warning('Invalid Amount', 'कृपया सही बकाया राशि दर्ज करें।');
      return;
    }
    if (!this.selectedCustomerId) {
      this.toast.warning('No Customer', 'कृपया पहले ग्राहक चुनें।');
      return;
    }

    this.isCollectingDue.set(true);
    const payload = {
      customerId: this.selectedCustomerId,
      amount: amount,
      paymentMethod: this.collectDuePaymentMode(),
      paymentType: 'CUSTOMER_PAYMENT',
      notes: this.collectDueNotes()
    };

    this.api.post<any>('/payments', payload).subscribe({
      next: (res) => {
        this.isCollectingDue.set(false);
        this.showCollectDueModal.set(false);
        this.toast.success('भुगतान सफल!', `₹${amount.toLocaleString('en-IN')} का पुराना बकाया जमा हो गया।`);
        
        const newBalance = Math.max(0, this.selectedCustomerBalance() - amount);
        this.selectedCustomerBalance.set(newBalance);
        const limit = this.selectedCustomerCreditLimit();
        this.isCustomerOverCreditLimit.set(this.enableCreditLimitBlock() && newBalance >= limit);
        
        this.calculateTotals();
        this.loadCustomers();

        // 🔊 Soundbox Voice Announcement
        try {
          this.soundbox.announcePayment(amount, this.shop()?.name || 'दुकान');
        } catch (e) {}

        // Live refresh recent invoice search and payments if open
        if (this.showInvoiceSearchModal()) {
          this.searchInvoices(this.invoiceSearchQuery());
        }
      },
      error: (err) => {
        this.isCollectingDue.set(false);
        this.toast.error('Payment Failed', err.error?.message || 'पुराना बकाया जमा नहीं हो सका।');
      }
    });
  }

  getPurchaseSupplierDetails(supplierId?: string): any {
    if (!supplierId) return null;
    return this.suppliers().find(s => s._id === supplierId || s.id === supplierId);
  }

  // --- 📜 Fast Previous Invoice & Customer Bill Search Handlers ---
  openInvoiceSearch(initialQuery = '') {
    this.invoiceSearchQuery.set(initialQuery);
    this.showInvoiceSearchModal.set(true);
    this.searchInvoices(initialQuery);
  }

  onInvoiceSearchInput(query: string) {
    this.invoiceSearchQuery.set(query);
    clearTimeout(this.invoiceSearchTimer);
    this.invoiceSearchTimer = setTimeout(() => {
      this.searchInvoices(query);
    }, 250);
  }

  searchInvoices(query: string = '') {
    this.isInvoiceSearching.set(true);
    this.api.get<any>('/sales', { search: query.trim(), limit: 50 }).subscribe({
      next: (res) => {
        this.isInvoiceSearching.set(false);
        if (res.success) {
          this.invoiceSearchResults.set(res.data || []);
        }
      },
      error: () => {
        this.isInvoiceSearching.set(false);
      }
    });
  }

  shareInvoiceWhatsApp(sale: any, event?: Event) {
    if (event) event.stopPropagation();
    const mobile = (sale.customerMobile || '').replace(/\D/g, '');
    const custName = sale.customerName || 'ग्राहक';
    const invNo = sale.invoiceNumber;
    const total = (sale.grandTotal || 0).toLocaleString('en-IN');
    const paid = (sale.amountPaid || 0).toLocaleString('en-IN');
    const due = (sale.balanceDue || 0).toLocaleString('en-IN');
    const pdfViewUrl = `http://localhost:5000/api/sales/${sale._id}/pdf`;

    let msg = `नमस्ते ${custName} जी! 🙏\nआपकी खरीदारी का बिल:\n🧾 *इनवॉइस:* ${invNo}\n💰 *कुल राशि:* ₹${total}\n✅ *जमा:* ₹${paid}`;
    if (sale.balanceDue > 0) {
      msg += `\n⏳ *बकाया (Due):* ₹${due}`;
    }
    msg += `\n\n📥 *अपना ओरिजिनल बिल PDF देखें / डाउनलोड करें:* \n${pdfViewUrl}\n\nधन्यवाद! 🙏`;

    const encoded = encodeURIComponent(msg);
    const url = mobile 
      ? `https://api.whatsapp.com/send?phone=91${mobile.slice(-10)}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    
    window.open(url, '_blank');
  }

  closeAllModals() {
    this.showPaymentQrModal.set(false);
    this.showPendingBillsModal.set(false);
    this.showBulkModal.set(false);
    this.showCustomItemModal.set(false);
    this.showRecentPaymentsModal.set(false);
    this.showPurchaseBillModal.set(false);
    this.showChangeModal.set(false);
    this.showCollectDueModal.set(false);
    this.showInvoiceSearchModal.set(false);
    this.showCustomerModal = false;
    this.showSupplierModal = false;
  }
}

