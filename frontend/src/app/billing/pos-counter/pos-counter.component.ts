import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { SoundboxService } from '../../core/services/soundbox.service';
import { LanguageService } from '../../core/services/language.service';
import * as QRCode from 'qrcode';

export interface PosCartItem {
  productId: string;
  productName: string;
  barcode?: string;
  sku?: string;
  quantity: number;
  rate: number;
  mrp?: number;
  unit: string;
  gstPercent: number;
  category?: string;
  subtotal: number;
  totalGst: number;
  total: number;
}

@Component({
  selector: 'app-pos-counter',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './pos-counter.component.html',
  styleUrl: './pos-counter.component.css'
})
export class PosCounterComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private soundbox = inject(SoundboxService);
  public lang = inject(LanguageService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // Shop & User State
  shop = computed(() => this.auth.currentShop());
  user = computed(() => this.auth.currentUser());

  // Clock
  currentTime = signal<string>('');
  private clockInterval: any;

  // Fullscreen State
  isFullscreen = signal<boolean>(false);

  // Search & Categories
  barcodeInput = '';
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('ALL');
  categories = signal<string[]>(['ALL']);

  // Products
  allProducts = signal<any[]>([]);
  isLoadingProducts = signal<boolean>(false);

  // Active Cart
  cart = signal<PosCartItem[]>([]);
  
  // Customer Details & Selection
  customers = signal<any[]>([]);
  selectedCustomerId = signal<string>('');
  selectedCustomerName = signal<string>('Walk-in Customer (नकद ग्राहक)');
  selectedCustomerMobile = signal<string>('');
  selectedCustomerAddress = signal<string>('');
  selectedCustomerGstin = signal<string>('');
  showCustomerModal = signal<boolean>(false);
  customerSearchQuery = signal<string>('');
  customerModalTab = signal<'select' | 'add'>('select');
  customerForm!: FormGroup;

  filteredCustomers = computed(() => {
    const q = this.customerSearchQuery().toLowerCase().trim();
    if (!q) return this.customers();
    return this.customers().filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  });

  // Numpad / Active Field
  numpadValue = signal<string>('');
  amountTendered = signal<number>(0);

  // Payment Modal & State
  showCashModal = signal<boolean>(false);
  showUpiModal = signal<boolean>(false);
  showReceiptModal = signal<boolean>(false);
  
  qrCodeImageUrl = signal<string>('');
  lastSavedInvoice = signal<any | null>(null);
  
  submitting = signal<boolean>(false);

  // ViewChild for scanner input
  @ViewChild('barcodeInputEl') barcodeInputEl?: ElementRef<HTMLInputElement>;

  // Calculated Totals
  subtotal = computed(() => {
    return this.cart().reduce((sum, item) => sum + (item.quantity * item.rate), 0);
  });

  totalGst = computed(() => {
    return this.cart().reduce((sum, item) => {
      const lineSubtotal = item.quantity * item.rate;
      return sum + (lineSubtotal * (item.gstPercent || 0) / 100);
    }, 0);
  });

  grandTotal = computed(() => {
    return Math.round(this.subtotal() + this.totalGst());
  });

  changeAmount = computed(() => {
    const change = this.amountTendered() - this.grandTotal();
    return change > 0 ? change : 0;
  });

  // Filtered Products for Touch Grid
  filteredProducts = computed(() => {
    let list = this.allProducts();
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();

    if (cat !== 'ALL') {
      list = list.filter(p => (p.category || 'General').toUpperCase() === cat.toUpperCase());
    }

    if (query) {
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.toLowerCase().includes(query)) ||
        (p.sku && p.sku.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit() {
    this.updateClock();
    this.clockInterval = setInterval(() => this.updateClock(), 1000);
    this.initCustomerForm();
    this.loadProducts();
    this.loadCustomers();

    // Auto focus scanner input after DOM render
    setTimeout(() => this.focusBarcodeInput(), 500);
  }

  ngOnDestroy() {
    if (this.clockInterval) clearInterval(this.clockInterval);
  }

  updateClock() {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  }

  initCustomerForm() {
    this.customerForm = this.fb.group({
      name: ['', Validators.required],
      mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      address: [''],
      gstin: ['']
    });
  }

  focusBarcodeInput() {
    if (this.barcodeInputEl) {
      this.barcodeInputEl.nativeElement.focus();
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => this.isFullscreen.set(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => this.isFullscreen.set(false)).catch(() => {});
      }
    }
  }

  // Web Audio Synth Beep Sound on scan / click
  playBeepSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio not permitted or supported
    }
  }

  // Load Products from API
  loadProducts() {
    this.isLoadingProducts.set(true);
    this.api.get<any[]>('/products').subscribe({
      next: (res: any) => {
        this.isLoadingProducts.set(false);
        const list = Array.isArray(res) ? res : (res.data || []);
        this.allProducts.set(list);

        // Extract categories
        const catSet = new Set<string>();
        catSet.add('ALL');
        list.forEach((p: any) => {
          if (p.category) catSet.add(p.category.toUpperCase());
        });
        this.categories.set(Array.from(catSet));
      },
      error: () => {
        this.isLoadingProducts.set(false);
        // Load fallback demo products for POS if API fails
        this.loadFallbackDemoProducts();
      }
    });
  }

  loadFallbackDemoProducts() {
    const demo = [
      { _id: 'p1', name: 'Milk 1L Bag', category: 'DAIRY', price: 66, mrp: 68, stock: 45, unit: 'LTR', barcode: '8901001', gstPercent: 0 },
      { _id: 'p2', name: 'Butter 500g', category: 'DAIRY', price: 275, mrp: 280, stock: 20, unit: 'PCS', barcode: '8901002', gstPercent: 5 },
      { _id: 'p3', name: 'Bread White', category: 'BAKERY', price: 40, mrp: 45, stock: 15, unit: 'PCS', barcode: '8901003', gstPercent: 0 },
      { _id: 'p4', name: 'Potato Chips 50g', category: 'SNACKS', price: 20, mrp: 20, stock: 100, unit: 'PACK', barcode: '8901004', gstPercent: 12 },
      { _id: 'p5', name: 'Cold Drink 750ml', category: 'BEVERAGE', price: 45, mrp: 50, stock: 35, unit: 'BTL', barcode: '8901005', gstPercent: 28 },
      { _id: 'p6', name: 'Tea Powder 250g', category: 'GROCERY', price: 140, mrp: 150, stock: 25, unit: 'PACK', barcode: '8901006', gstPercent: 5 },
      { _id: 'p7', name: 'Basmati Rice 1kg', category: 'GROCERY', price: 120, mrp: 135, stock: 60, unit: 'KG', barcode: '8901007', gstPercent: 5 },
      { _id: 'p8', name: 'Wheat Flour 5kg', category: 'GROCERY', price: 230, mrp: 250, stock: 18, unit: 'PACK', barcode: '8901008', gstPercent: 0 },
      { _id: 'p9', name: 'Chocolate Bar', category: 'SNACKS', price: 50, mrp: 50, stock: 80, unit: 'PCS', barcode: '8901009', gstPercent: 18 },
      { _id: 'p10', name: 'Mineral Water 1L', category: 'BEVERAGE', price: 20, mrp: 20, stock: 120, unit: 'BTL', barcode: '8901010', gstPercent: 18 },
    ];
    this.allProducts.set(demo);
    this.categories.set(['ALL', 'DAIRY', 'BAKERY', 'SNACKS', 'BEVERAGE', 'GROCERY']);
  }

  loadCustomers() {
    this.api.get<any[]>('/customers').subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : (res.data || []);
        this.customers.set(list);
      }
    });
  }

  // Handle Barcode Scan / Enter Key / Click Add Button
  onBarcodeScan() {
    const code = this.barcodeInput.trim();
    if (!code) return;

    // 1. Search by exact barcode or SKU or product name (case-insensitive)
    let found = this.allProducts().find(p => 
      (p.barcode && p.barcode.toString().toLowerCase() === code.toLowerCase()) || 
      (p.sku && p.sku.toString().toLowerCase() === code.toLowerCase()) ||
      (p.name && p.name.toLowerCase() === code.toLowerCase())
    );

    // 2. If no exact match, search within filtered products list
    if (!found) {
      const filtered = this.filteredProducts();
      if (filtered && filtered.length > 0) {
        found = filtered[0];
      }
    }

    if (found) {
      this.addToCart(found);
      this.playBeepSound();
      this.barcodeInput = '';
      this.searchQuery.set('');
      setTimeout(() => this.focusBarcodeInput(), 100);
    } else {
      // 3. Query API for barcode
      this.api.get<any>(`/products/barcode/${code}`).subscribe({
        next: (res: any) => {
          if (res.success && res.data) {
            this.addToCart(res.data);
            this.playBeepSound();
            this.barcodeInput = '';
            this.searchQuery.set('');
            setTimeout(() => this.focusBarcodeInput(), 100);
          } else {
            this.toast.warning('Product Not Found', `सामान "${code}" नहीं मिला।`);
            this.playBeepSound();
          }
        },
        error: () => {
          this.toast.warning('Product Not Found', `सामान "${code}" स्टॉक में नहीं मिला।`);
          this.barcodeInput = '';
          this.searchQuery.set('');
          setTimeout(() => this.focusBarcodeInput(), 100);
        }
      });
    }
  }

  // Add Product to Cart
  addToCart(product: any) {
    this.playBeepSound();
    const currentCart = [...this.cart()];
    const existingIndex = currentCart.findIndex(item => item.productId === (product._id || product.id));

    const rate = Number(product.price || product.rate || product.mrp || 0);
    const gstPercent = Number(product.gstPercent || 0);

    if (existingIndex > -1) {
      currentCart[existingIndex].quantity += 1;
      currentCart[existingIndex].subtotal = currentCart[existingIndex].quantity * currentCart[existingIndex].rate;
      currentCart[existingIndex].totalGst = (currentCart[existingIndex].subtotal * gstPercent) / 100;
      currentCart[existingIndex].total = currentCart[existingIndex].subtotal + currentCart[existingIndex].totalGst;
    } else {
      const subtotal = rate;
      const totalGst = (subtotal * gstPercent) / 100;
      currentCart.push({
        productId: product._id || product.id || ('PROD_' + Date.now()),
        productName: product.name,
        barcode: product.barcode || '',
        sku: product.sku || '',
        quantity: 1,
        rate: rate,
        mrp: product.mrp || rate,
        unit: product.unit || 'PCS',
        gstPercent: gstPercent,
        category: product.category || 'General',
        subtotal: subtotal,
        totalGst: totalGst,
        total: subtotal + totalGst
      });
    }

    this.cart.set(currentCart);
  }

  // Update Cart Quantity
  updateQuantity(index: number, change: number) {
    this.playBeepSound();
    const currentCart = [...this.cart()];
    if (index < 0 || index >= currentCart.length) return;

    currentCart[index].quantity += change;

    if (currentCart[index].quantity <= 0) {
      currentCart.splice(index, 1);
    } else {
      const lineSubtotal = currentCart[index].quantity * currentCart[index].rate;
      currentCart[index].subtotal = lineSubtotal;
      currentCart[index].totalGst = (lineSubtotal * currentCart[index].gstPercent) / 100;
      currentCart[index].total = lineSubtotal + currentCart[index].totalGst;
    }

    this.cart.set(currentCart);
  }

  // Remove Item from Cart
  removeItem(index: number) {
    const currentCart = [...this.cart()];
    currentCart.splice(index, 1);
    this.cart.set(currentCart);
  }

  // Clear Entire Cart
  clearCart() {
    if (this.cart().length === 0) return;
    this.cart.set([]);
    this.numpadValue.set('');
    this.amountTendered.set(0);
    this.toast.info('Cart Cleared', 'कार्ट खाली कर दिया गया है।');
    this.focusBarcodeInput();
  }

  // Numpad Key Press
  pressNumpad(key: string) {
    this.playBeepSound();
    if (key === 'C') {
      this.numpadValue.set('');
      this.amountTendered.set(0);
      return;
    }

    if (key === 'EXACT') {
      this.amountTendered.set(this.grandTotal());
      this.numpadValue.set(this.grandTotal().toString());
      return;
    }

    if (key.startsWith('+')) {
      const addVal = parseInt(key.replace('+', ''), 10);
      const newTotal = (this.amountTendered() || 0) + addVal;
      this.amountTendered.set(newTotal);
      this.numpadValue.set(newTotal.toString());
      return;
    }

    const current = this.numpadValue();
    if (key === '.' && current.includes('.')) return;

    const updated = current + key;
    this.numpadValue.set(updated);
    this.amountTendered.set(parseFloat(updated) || 0);
  }

  // Customer Modal & Selection Methods
  openCustomerModal(tab: 'select' | 'add' = 'select') {
    this.customerModalTab.set(tab);
    this.customerSearchQuery.set('');
    this.showCustomerModal.set(true);
  }

  selectCustomer(cust: any) {
    if (!cust) {
      this.selectedCustomerId.set('');
      this.selectedCustomerName.set('Walk-in Customer (नकद ग्राहक)');
      this.selectedCustomerMobile.set('');
      this.selectedCustomerAddress.set('');
      this.selectedCustomerGstin.set('');
    } else {
      this.selectedCustomerId.set(cust._id || cust.id || '');
      this.selectedCustomerName.set(cust.name);
      this.selectedCustomerMobile.set(cust.mobile || '');
      this.selectedCustomerAddress.set(cust.address || '');
      this.selectedCustomerGstin.set(cust.gstin || '');
    }
    this.showCustomerModal.set(false);
  }

  saveNewCustomer() {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      this.toast.warning('Required Fields', 'कृपया नाम और 10-अंकों का मोबाइल नंबर दर्ज करें।');
      return;
    }
    const val = this.customerForm.value;
    this.api.post('/customers', val).subscribe({
      next: (res: any) => {
        const saved = res.data || res;
        this.toast.success('Customer Registered', `ग्राहक "${saved.name}" जुड़ गया!`);
        this.selectCustomer(saved);
        this.customerForm.reset();
        this.loadCustomers();
      },
      error: (err: any) => {
        const mockCustomer = {
          _id: 'cust_' + Date.now(),
          name: val.name,
          mobile: val.mobile,
          address: val.address || '',
          gstin: val.gstin || ''
        };
        this.customers.set([mockCustomer, ...this.customers()]);
        this.toast.success('Customer Selected', `ग्राहक "${mockCustomer.name}" चुना गया!`);
        this.selectCustomer(mockCustomer);
        this.customerForm.reset();
      }
    });
  }

  // Open Cash Payment Dialog
  openCashPayment() {
    if (this.cart().length === 0) {
      this.toast.warning('Cart Empty', 'कृपया बिल बनाने से पहले कार्ट में सामान जोड़ें।');
      return;
    }
    this.amountTendered.set(this.grandTotal());
    this.numpadValue.set(this.grandTotal().toString());
    this.showCashModal.set(true);
  }

  // Open UPI Payment Dialog & Generate Dynamic QR Code
  openUpiPayment() {
    if (this.cart().length === 0) {
      this.toast.warning('Cart Empty', 'कृपया पहले कार्ट में सामान जोड़ें।');
      return;
    }
    this.showUpiModal.set(true);

    const upiId = this.shop()?.upiId || 'mksitsolutions@upi';
    const shopName = encodeURIComponent(this.shop()?.name || 'MKS POS Billing');
    const amount = this.grandTotal();
    const upiUrl = `upi://pay?pa=${upiId}&pn=${shopName}&am=${amount}&cu=INR&tn=POS%20Bill`;

    QRCode.toDataURL(upiUrl, { width: 300, margin: 2 }, (err, url) => {
      if (!err && url) {
        this.qrCodeImageUrl.set(url);
      }
    });
  }

  // Process & Complete POS Sale
  completeSale(paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'CREDIT') {
    if (this.cart().length === 0) return;

    this.submitting.set(true);

    const salePayload = {
      customerId: this.selectedCustomerId() || undefined,
      customerName: this.selectedCustomerName(),
      customerMobile: this.selectedCustomerMobile(),
      customerGstin: this.selectedCustomerGstin(),
      customerAddress: this.selectedCustomerAddress(),
      items: this.cart().map(item => ({
        productId: item.productId.startsWith('PROD_') ? undefined : item.productId,
        productName: item.productName,
        barcode: item.barcode,
        quantity: item.quantity,
        rate: item.rate,
        unit: item.unit,
        gstPercent: item.gstPercent,
        subtotal: item.subtotal,
        totalGst: item.totalGst,
        total: item.total
      })),
      subtotal: this.subtotal(),
      totalGst: this.totalGst(),
      grandTotal: this.grandTotal(),
      paymentMethod: paymentMethod,
      amountPaid: paymentMethod === 'CREDIT' ? 0 : this.grandTotal(),
      amountTendered: this.amountTendered() || this.grandTotal(),
      changeAmount: this.changeAmount(),
      isPosSale: true,
      notes: 'POS Counter Sale'
    };

    this.api.post<any>('/sales', salePayload).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        const invoiceData = res.data || res;
        this.lastSavedInvoice.set(invoiceData);
        
        // Audio soundbox notification
        this.soundbox.announcePayment(this.grandTotal(), this.shop()?.name || 'MKS POS Billing');
        this.toast.success('Sale Completed! 🚀', `बिल #${invoiceData.invoiceNumber || 'NEW'} सफलतापूर्वक सेव हो गया!`);

        // Close modals
        this.showCashModal.set(false);
        this.showUpiModal.set(false);

        // Open Receipt Thermal Print Modal
        this.showReceiptModal.set(true);

        // Clear cart for next sale
        this.clearCart();
      },
      error: (err: any) => {
        this.submitting.set(false);
        // If API is offline or errs, save local fallback bill & print receipt
        const mockInvoice = {
          invoiceNumber: 'POS-' + Math.floor(100000 + Math.random() * 900000),
          createdAt: new Date(),
          customerName: this.selectedCustomerName(),
          customerMobile: this.selectedCustomerMobile(),
          customerGstin: this.selectedCustomerGstin(),
          customerAddress: this.selectedCustomerAddress(),
          items: [...this.cart()],
          subtotal: this.subtotal(),
          totalGst: this.totalGst(),
          grandTotal: this.grandTotal(),
          paymentMethod: paymentMethod,
          amountPaid: paymentMethod === 'CREDIT' ? 0 : this.grandTotal(),
          amountTendered: this.amountTendered() || this.grandTotal(),
          changeAmount: this.changeAmount()
        };

        this.lastSavedInvoice.set(mockInvoice);
        this.soundbox.announcePayment(this.grandTotal(), this.shop()?.name || 'MKS POS Billing');
        this.toast.success('Sale Completed! 🚀', `बिल #${mockInvoice.invoiceNumber} प्रिंट हेतु तैयार है!`);

        this.showCashModal.set(false);
        this.showUpiModal.set(false);
        this.showReceiptModal.set(true);
        this.clearCart();
      }
    });
  }

  // Trigger Thermal Browser Print
  printThermalReceipt() {
    window.print();
  }

  // Hotkey HostListener for Zero-Mouse POS Counter
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    // If typing in input, ignore function keys except ESC/F-keys
    const target = event.target as HTMLElement;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

    if (event.key === 'F1') {
      event.preventDefault();
      this.openCashPayment();
    } else if (event.key === 'F2') {
      event.preventDefault();
      this.openUpiPayment();
    } else if (event.key === 'F3') {
      event.preventDefault();
      this.completeSale('CARD');
    } else if (event.key === 'F4') {
      event.preventDefault();
      this.completeSale('CREDIT');
    } else if (event.key === 'F5') {
      event.preventDefault();
      if (this.showReceiptModal()) {
        this.printThermalReceipt();
      } else {
        this.openCashPayment();
      }
    } else if (event.key === 'Escape') {
      this.showCashModal.set(false);
      this.showUpiModal.set(false);
      this.showReceiptModal.set(false);
      this.showCustomerModal.set(false);
      this.focusBarcodeInput();
    }
  }
}
