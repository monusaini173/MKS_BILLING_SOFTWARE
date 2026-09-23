import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { LanguageService } from '../core/services/language.service';
import { getShopTypeConfig, ShopTypeConfig } from '../core/utils/shop-type-config';

const BACKUP_KEY = 'mks_last_backup_date';
const BACKUP_WARN_DAYS = 3;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);
  public lang = inject(LanguageService);

  shop = this.auth.currentShop;
  user = this.auth.currentUser;

  shopConfig = computed<ShopTypeConfig>(() => getShopTypeConfig(this.shop()?.shopType));

  loading = signal(true);
  stats = signal<any>({
    todaySales: 0, todaySalesCount: 0, todayPurchases: 0, todayExpenses: 0, todayProfit: 0,
    todayCashAmount: 0, todayCashCount: 0,
    todayUpiAmount: 0, todayUpiCount: 0,
    todayCardAmount: 0, todayCardCount: 0,
    todayOtherAmount: 0, todayOtherCount: 0,
    monthlySales: 0, monthlySalesCount: 0, monthlyPurchases: 0, monthlyExpenses: 0, monthlyProfit: 0,
    totalProducts: 0, lowStockProducts: 0, outOfStock: 0,
    totalCustomers: 0, totalSuppliers: 0,
    pendingCustomerAmount: 0, pendingSupplierAmount: 0,
    recentBills: [], monthlySalesChart: [],
    totalBillsCount: 0, totalBillsAmount: 0,
    totalBillsPaid: 0, totalBillsPending: 0,
    paidBillsCount: 0, pendingBillsCount: 0,
  });

  lowStockProductsList = signal<any[]>([]);
  allProductsList = signal<any[]>([]);

  // Backup system
  isBackingUp = signal(false);
  lastBackupDate = signal<string | null>(null);
  backupDaysAgo = signal(0);
  showBackupAlert = signal(false);

  // Medical specific
  expiredMedicines = computed(() => {
    const now = new Date();
    return this.allProductsList().filter(p => p.expiryDate && new Date(p.expiryDate) < now);
  });
  expiringSoonMedicines = computed(() => {
    const now = new Date();
    const future60Days = new Date(); future60Days.setDate(now.getDate() + 60);
    return this.allProductsList().filter(p => {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate);
      return exp >= now && exp <= future60Days;
    });
  });
  looseProducts = computed(() =>
    this.allProductsList().filter(p => p.unit === 'KG' || p.unit === 'GM' || p.unit === 'LTR' || p.unit === 'ML' || p.isLoose));
  sizeColorProducts = computed(() =>
    this.allProductsList().filter(p => p.size || p.color));
  imeiProducts = computed(() =>
    this.allProductsList().filter(p => p.imeiNumber || p.ram || p.storage));

  // Rich Kirana Essential Categories with Hindi + English + Emojis + Navigation
  kiranaCategories = [
    { nameHindi: 'आटा व मैदा', nameEn: 'Atta & Flour', emoji: '🌾', count: 'Essential', color: '#b45309', bg: '#fef3c7', border: '#fde68a', query: 'Atta' },
    { nameHindi: 'दालें व अनाज', nameEn: 'Dals & Pulses', emoji: '🥣', count: 'High Demand', color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', query: 'Dal' },
    { nameHindi: 'चावल व पोहा', nameEn: 'Rice & Grains', emoji: '🍚', count: 'Daily Fast', color: '#047857', bg: '#d1fae5', border: '#a7f3d0', query: 'Rice' },
    { nameHindi: 'तेल व घी', nameEn: 'Cooking Oil & Ghee', emoji: '🛢️', count: 'Staple', color: '#d97706', bg: '#fef9c3', border: '#fef08a', query: 'Oil' },
    { nameHindi: 'मसाले व नमक', nameEn: 'Spices & Masala', emoji: '🌶️', count: 'Popular', color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', query: 'Spices' },
    { nameHindi: 'डेयरी व दूध', nameEn: 'Dairy & Milk', emoji: '🥛', count: 'Fresh', color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd', query: 'Dairy' },
    { nameHindi: 'चाय व कॉफी', nameEn: 'Tea & Coffee', emoji: '☕', count: 'Daily', color: '#78350f', bg: '#fef3c7', border: '#fde68a', query: 'Tea' },
    { nameHindi: 'चीनी व गुड़', nameEn: 'Sugar & Jaggery', emoji: '🧂', count: 'Basic', color: '#4d7c0f', bg: '#ecfccb', border: '#d9f99d', query: 'Sugar' },
    { nameHindi: 'बिस्कुट व बेकरी', nameEn: 'Biscuits & Bakery', emoji: '🍪', count: 'Snacks', color: '#9a3412', bg: '#ffedd5', border: '#fed7aa', query: 'Biscuits' },
    { nameHindi: 'नमकीन व चिप्स', nameEn: 'Namkeen & Snacks', emoji: '🥨', count: 'Fast Move', color: '#a16207', bg: '#fef9c3', border: '#fde047', query: 'Namkeen' },
    { nameHindi: 'साबुन व सर्फ', nameEn: 'Soaps & Cleaners', emoji: '🧼', count: 'Household', color: '#0f766e', bg: '#ccfbf1', border: '#99f6e4', query: 'Soap' },
    { nameHindi: 'पर्सनल केयर', nameEn: 'Personal Care', emoji: '🧴', count: 'Hygiene', color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe', query: 'Personal Care' },
    { nameHindi: 'कोल्ड ड्रिंक्स', nameEn: 'Cold Drinks & Juice', emoji: '🥤', count: 'Beverage', color: '#be185d', bg: '#fce7f3', border: '#fbcfe8', query: 'Cold Drinks' },
    { nameHindi: 'सूखे मेवे व बादाम', nameEn: 'Dry Fruits & Nuts', emoji: '🥜', count: 'Premium', color: '#854d0e', bg: '#fef3c7', border: '#fde68a', query: 'Dry Fruits' },
    { nameHindi: 'पूजा सामग्री', nameEn: 'Pooja Samagri', emoji: '🪔', count: 'Ritual', color: '#ea580c', bg: '#ffedd5', border: '#fed7aa', query: 'Pooja' },
    { nameHindi: 'चॉकलेट व टॉफी', nameEn: 'Chocolates & Candy', emoji: '🍫', count: 'Kids Fav', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe', query: 'Chocolate' }
  ];

  // Backup Included Data Modules
  backupModules = [
    { label: 'बिक्री व बिल (Sales & Invoices)', desc: 'सभी इनवॉइस, पेमेंट मोड व डिस्काउंट्स', icon: 'fa-solid fa-receipt', color: '#16a34a', bg: '#f0fdf4' },
    { label: 'प्रोडक्ट्स व स्टॉक (Inventory)', desc: 'उत्पाद, बारकोड, खरीद/बिक्री रेट, स्टॉक', icon: 'fa-solid fa-boxes-stacked', color: '#0284c7', bg: '#f0f9ff' },
    { label: 'ग्राहक बहीखाता (Customer Khata)', desc: 'उधार, पेमेंट हिस्ट्री व खाता सारांश', icon: 'fa-solid fa-users', color: '#9333ea', bg: '#faf5ff' },
    { label: 'सप्लायर व खरीद (Suppliers & Purchases)', desc: 'सप्लायर बिल, बकाया व पर्चेस रिकॉर्ड्स', icon: 'fa-solid fa-truck-field', color: '#d97706', bg: '#fffbeb' },
    { label: 'दुकान के खर्च (Expenses)', desc: 'दैनिक खर्च, लेबर, रेंट व यूटिलिटी रिकॉर्ड', icon: 'fa-solid fa-wallet', color: '#e11d48', bg: '#fff1f2' }
  ];

  ngOnInit() {
    this.loadStats();
    this.loadProducts();
    if (!this.auth.isEmployee()) {
      this.loadLowStock();
    }
    this.checkBackupStatus();
  }

  loadStats() {
    this.api.get<any>('/reports/dashboard').subscribe({
      next: (res) => {
        if (res.success) this.stats.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'Failed to load dashboard statistics.');
      }
    });
  }

  loadProducts() {
    this.api.get<any>('/products', { limit: 500 }).subscribe({
      next: (res) => { if (res.success) this.allProductsList.set(res.data || []); }
    });
  }

  loadLowStock() {
    this.api.get<any>('/products', { lowStock: 'true' }).subscribe({
      next: (res) => { if (res.success) this.lowStockProductsList.set(res.data); }
    });
  }

  // ============================================================
  // 💾 BACKUP SYSTEM
  // ============================================================
  checkBackupStatus() {
    try {
      const lastBackup = localStorage.getItem(BACKUP_KEY);
      if (!lastBackup) {
        this.showBackupAlert.set(true);
        this.backupDaysAgo.set(999);
        return;
      }
      const last = new Date(lastBackup);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      this.lastBackupDate.set(last.toLocaleDateString('en-IN'));
      this.backupDaysAgo.set(diffDays);
      this.showBackupAlert.set(diffDays >= BACKUP_WARN_DAYS);
    } catch (e) {
      this.showBackupAlert.set(true);
    }
  }

  downloadBackup() {
    this.isBackingUp.set(true);
    const token = this.auth.getAccessToken() || sessionStorage.getItem('mks_access_token') || localStorage.getItem('mks_access_token') || '';
    const url = 'http://localhost:5000/api/reports/backup';

    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Backup failed');
        return res.blob();
      })
      .then(blob => {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
        const filename = `MKS_Backup_${today}.json`;
        const url2 = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url2);

        // Save backup date to localStorage
        localStorage.setItem(BACKUP_KEY, new Date().toISOString());
        this.checkBackupStatus();
        this.isBackingUp.set(false);
        this.toast.success('Backup Complete! ✅', `MKS_Backup_${today}.json download ho gaya. Safe rakhein!`);
      })
      .catch(() => {
        this.isBackingUp.set(false);
        this.toast.error('Backup Failed', 'Backup download nahi ho saka. Server check karein.');
      });
  }

  getBillStatusBadge(status: string): { bg: string; color: string; label: string } {
    switch (status) {
      case 'PAID': return { bg: '#dcfce7', color: '#166534', label: '✅ चुकता (Paid)' };
      case 'PARTIAL': return { bg: '#fef3c7', color: '#92400e', label: '⚠️ आंशिक (Partial)' };
      case 'PENDING': return { bg: '#fee2e2', color: '#991b1b', label: '🚨 उधार (Due)' };
      default: return { bg: '#f1f5f9', color: '#475569', label: status || 'PAID' };
    }
  }
}
