import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { SubscriptionService } from '../../core/services/subscription.service';
import { LanguageService } from '../../core/services/language.service';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { getShopTypeConfig, ShopTypeConfig } from '../../core/utils/shop-type-config';

import { LiveNotificationService, LiveNotification } from '../../core/services/live-notification.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, FormsModule],
  templateUrl: './layout.component.html'
})
export class LayoutComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  api = inject(ApiService);
  toast = inject(ToastService);
  subService = inject(SubscriptionService);
  langService = inject(LanguageService);
  ai = inject(AiAssistantService);
  router = inject(Router);
  liveNotif = inject(LiveNotificationService);

  currentUser = this.auth.currentUser;
  currentShop = this.auth.currentShop;

  // Live Date & Time Clock
  liveDate = signal<string>('');
  liveTime = signal<string>('');
  private clockTimer: any;

  // Shop type specific config
  shopConfig = computed<ShopTypeConfig>(() => getShopTypeConfig(this.currentShop()?.shopType));

  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  profileDropdownOpen = signal(false);
  branchDropdownOpen = signal(false);
  showAddBranchModal = signal(false);
  savingBranch = signal(false);

  newBranchData = {
    name: '',
    shopType: 'GARMENTS',
    branchName: '',
    branchCode: '',
    address: '',
    mobile: ''
  };

  selectedUpgradePlan = signal<'BASIC_MONTHLY' | 'PRO_MONTHLY' | 'ENTERPRISE_YEARLY'>('PRO_MONTHLY');

  // 1-Click Fast Hindi / English Language Switcher (0ms delay)
  toggleLang() {
    const newLang = this.langService.toggleLanguage();
    if (newLang === 'hi') {
      this.toast.success('भाषा बदली (Language Changed)', '🇮🇳 हिन्दी भाषा सक्रिय है (Hindi Active).');
    } else {
      this.toast.success('Language Switched', '🇬🇧 English language is now active.');
    }
  }

  // Live countdown / days counter for Navbar Premium / Subscription Badge
  premiumCountdownText = computed(() => {
    const status = this.subService.status();
    const days = this.subService.daysRemaining();
    const isExpired = this.subService.isExpired();
    const plan = status?.subscriptionPlan;
    
    let planLabel = 'Premium';
    if (plan === 'BASIC_MONTHLY') planLabel = 'Starter';
    else if (plan === 'PRO_MONTHLY' || plan === 'PREMIUM_MONTHLY') planLabel = 'Pro WhatsApp';
    else if (plan === 'ENTERPRISE_YEARLY' || plan === 'PREMIUM_YEARLY') planLabel = 'Yearly';

    if (isExpired) {
      return this.langService.isHindi() ? `⚠️ ${planLabel} समाप्त (रिन्यू करें)` : `⚠️ ${planLabel} Expired (Renew)`;
    }

    if (this.langService.isHindi()) {
      if (days <= 0) return `👑 ${planLabel}: आज समाप्त`;
      return `👑 ${planLabel}: ⏳ ${days} दिन बाकी`;
    } else {
      if (days <= 0) return `👑 ${planLabel}: Ends Today`;
      return `👑 ${planLabel}: ⏳ ${days} ${days === 1 ? 'day' : 'days'} left`;
    }
  });

  constructor() {
    this.subService.loadStatus();
    if (this.auth.isAuthenticated()) {
      this.auth.loadMyShops().subscribe({ error: () => {} });
    }

    // Auto-close mobile sidebar when navigating to new page
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.mobileSidebarOpen.set(false);
        this.branchDropdownOpen.set(false);
        this.profileDropdownOpen.set(false);
      }
    });
  }

  ngOnInit() {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);
  }

  ngOnDestroy() {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private updateClock() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = now.toLocaleString('en-IN', { month: 'short' });
    const year = now.getFullYear();
    this.liveDate.set(`${day} ${month} ${year}`);
    this.liveTime.set(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
  }

  toggleSidebar() {
    if (window.innerWidth <= 768) {
      this.mobileSidebarOpen.update(val => !val);
    } else {
      this.sidebarCollapsed.update(val => !val);
    }
  }

  toggleMobileSidebar() {
    this.mobileSidebarOpen.update(val => !val);
  }

  closeMobileSidebar() {
    this.mobileSidebarOpen.set(false);
  }

  toggleProfileDropdown() {
    this.profileDropdownOpen.update(val => !val);
    if (this.profileDropdownOpen()) this.branchDropdownOpen.set(false);
  }

  toggleBranchDropdown() {
    this.branchDropdownOpen.update(val => !val);
    if (this.branchDropdownOpen()) this.profileDropdownOpen.set(false);
  }

  notificationsOpen = signal(false);
  helpModalOpen = signal(false);
  globalSearchOpen = signal(false);
  searchQuery = signal('');

  // Live Notifications powered by LiveNotificationService
  notificationsCount = computed(() => this.liveNotif.unreadCount());
  notificationsList = computed(() => this.liveNotif.filteredNotifications());

  private notifTimer: any;

  onNotifMouseEnter() {
    if (this.notifTimer) clearTimeout(this.notifTimer);
  }

  onNotifMouseLeave() {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.notifTimer = setTimeout(() => {
      this.notificationsOpen.set(false);
    }, 450);
  }

  toggleNotifications() {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.notificationsOpen.update(v => !v);
    if (this.notificationsOpen()) {
      this.profileDropdownOpen.set(false);
      this.branchDropdownOpen.set(false);
      this.liveNotif.fetchLiveAlerts();
    }
  }

  closeNotifications() {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.notifTimer = setTimeout(() => {
      this.notificationsOpen.set(false);
    }, 300);
  }

  setNotifFilter(filter: 'ALL' | 'SALES' | 'LOW_STOCK' | 'DUES' | 'EXPIRY') {
    this.liveNotif.activeFilter.set(filter);
  }

  toggleNotifSound() {
    const isEnabled = this.liveNotif.toggleSound();
    if (isEnabled) {
      this.toast.info('ध्वनि चालू 🔊', 'लाइव सूचना साउंड अलर्ट सक्रिय है।');
    } else {
      this.toast.info('ध्वनि बंद 🔇', 'लाइव सूचना साउंड म्यूट कर दिया गया है।');
    }
  }

  requestDesktopAlerts() {
    this.liveNotif.requestDesktopPermission().then(granted => {
      if (granted) {
        this.toast.success('डेस्कटॉप अलर्ट सक्रिय 🔔', 'अब नए बिल और अलर्ट पर सिस्टम नोटिफिकेशन भी आएगा।');
      } else {
        this.toast.warning('अनुमति नहीं मिली', 'कृपया ब्राउज़र सेटिंग्स में नोटिफिकेशन की अनुमति दें।');
      }
    });
  }

  markAllNotificationsRead() {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.liveNotif.markAllAsRead();
    this.toast.success('सूचनाएं (Notifications)', 'सभी सूचनाएं पढ़ी हुई मार्क कर दी गईं।');
  }

  dismissNotification(e: Event, item: LiveNotification) {
    e.stopPropagation();
    this.liveNotif.dismiss(item.id);
  }

  clearAllNotifications() {
    this.liveNotif.clearAll();
    this.toast.info('सूचनाएं साफ', 'सभी सूचनाएं हटा दी गईं।');
  }

  refreshLiveAlerts() {
    this.liveNotif.fetchLiveAlerts();
    this.liveNotif.playChime();
    this.toast.info('रिफ्रेश 🔄', 'लाइव सूचनाएं अपडेट कर दी गईं।');
  }

  onNotificationClick(item: any) {
    if (!item) return;
    this.liveNotif.markAsRead(item.id);
    this.liveNotif.dismissLiveAlert();
    this.notificationsOpen.set(false);
    if (item.route) {
      this.router.navigateByUrl(item.route);
    }
  }

  toggleHelpModal() {
    this.helpModalOpen.update(v => !v);
  }

  // Live Search Suggestions State
  isSearching = signal(false);
  searchResults = signal<{ bills: any[]; products: any[]; customers: any[] }>({ bills: [], products: [], customers: [] });
  showSearchResults = signal(false);
  private searchTimeout: any;

  onSearchInput(query: string) {
    this.searchQuery.set(query);
    const q = query.trim();
    if (this.searchTimeout) clearTimeout(this.searchTimeout);

    if (!q || q.length < 2) {
      this.searchResults.set({ bills: [], products: [], customers: [] });
      this.showSearchResults.set(false);
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.isSearching.set(true);

      // Parallel search across Bills (Sales), Products, Customers
      this.api.get<any>('/sales', { search: q, limit: 4 }).subscribe({
        next: (salesRes) => {
          const bills = salesRes.success ? (salesRes.data || []) : [];
          
          this.api.get<any>('/products', { search: q, limit: 4 }).subscribe({
            next: (prodRes) => {
              const products = prodRes.success ? (prodRes.data || []) : [];

              this.api.get<any>('/customers', { search: q, limit: 3 }).subscribe({
                next: (custRes) => {
                  const customers = custRes.success ? (custRes.data || []) : [];
                  this.searchResults.set({ bills, products, customers });
                  this.isSearching.set(false);
                  this.showSearchResults.set(bills.length > 0 || products.length > 0 || customers.length > 0);
                },
                error: () => {
                  this.searchResults.set({ bills, products, customers: [] });
                  this.isSearching.set(false);
                  this.showSearchResults.set(bills.length > 0 || products.length > 0);
                }
              });
            },
            error: () => {
              this.searchResults.set({ bills, products: [], customers: [] });
              this.isSearching.set(false);
              this.showSearchResults.set(bills.length > 0);
            }
          });
        },
        error: () => {
          this.isSearching.set(false);
        }
      });
    }, 250);
  }

  openBill(sale: any) {
    this.showSearchResults.set(false);
    this.searchQuery.set('');
    this.router.navigate([`/billing/${sale._id}/invoice`]);
  }

  openProduct(prod: any) {
    this.showSearchResults.set(false);
    this.searchQuery.set('');
    this.router.navigate(['/products'], { queryParams: { search: prod.name } });
  }

  openCustomer(cust: any) {
    this.showSearchResults.set(false);
    this.searchQuery.set('');
    this.router.navigate([`/customers/${cust._id}`]);
  }

  onGlobalSearchSubmit() {
    const q = this.searchQuery().trim();
    if (!q) return;

    this.showSearchResults.set(false);

    // 1. Check if user typed Invoice Number (like INV-00001, INV..., or number)
    const isInvoiceSearch = /^INV/i.test(q) || /^BILL/i.test(q);

    if (isInvoiceSearch) {
      this.api.get<any>('/sales', { search: q, limit: 1 }).subscribe({
        next: (res) => {
          if (res.success && res.data && res.data.length > 0) {
            const sale = res.data[0];
            this.router.navigate([`/billing/${sale._id}/invoice`]);
            this.toast.success('बिल मिला (Invoice Found)', `इनवॉइस #${sale.invoiceNumber} खोला जा रहा है।`);
          } else {
            this.router.navigate(['/reports'], { queryParams: { type: 'sales', search: q } });
            this.toast.info('इनवॉइस खोज', `इनवॉइस #${q} सेल्स रिपोर्ट में खोजा जा रहा है।`);
          }
        },
        error: () => {
          this.router.navigate(['/reports'], { queryParams: { type: 'sales', search: q } });
        }
      });
      return;
    }

    // 2. Check general search in sales first (to see if an invoice matches)
    this.api.get<any>('/sales', { search: q, limit: 1 }).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0 && 
            (res.data[0].invoiceNumber.toLowerCase() === q.toLowerCase() || 
             res.data[0].invoiceNumber.endsWith(q))) {
          // Exact invoice match! Direct to invoice view
          this.router.navigate([`/billing/${res.data[0]._id}/invoice`]);
          this.toast.success('बिल मिला (Invoice Found)', `इनवॉइस #${res.data[0].invoiceNumber} खोला जा रहा है।`);
        } else {
          // Default to product catalog search
          this.router.navigate(['/products'], { queryParams: { search: q } });
        }
      },
      error: () => {
        this.router.navigate(['/products'], { queryParams: { search: q } });
      }
    });
  }

  openWhatsAppSupport() {
    const phone = '911234567890';
    const text = encodeURIComponent(`Hello MKS Billing Support, please assist me.`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }

  selectBranch(shopId: string) {
    this.branchDropdownOpen.set(false);
    this.auth.switchShop(shopId);
  }

  openAddBranchModal() {
    const count = (this.auth.myShops()?.length || 0) + 1;
    const current = this.currentShop();
    this.newBranchData = {
      name: current?.name || 'MKS Store',
      shopType: current?.shopType || 'GARMENTS',
      branchName: `शाखा ${count} (Branch ${count})`,
      branchCode: `BR-${count}`,
      address: current?.address || '',
      mobile: current?.mobile || ''
    };
    this.branchDropdownOpen.set(false);
    this.showAddBranchModal.set(true);
  }

  saveNewBranch() {
    if (!this.newBranchData.name || !this.newBranchData.branchName) {
      this.toast.error('त्रुटि', 'कृपया दुकान व शाखा का नाम दर्ज करें।');
      return;
    }
    this.savingBranch.set(true);
    this.auth.createBranch(this.newBranchData).subscribe({
      next: (res) => {
        this.savingBranch.set(false);
        this.showAddBranchModal.set(false);
        if (res.success && res.data?._id) {
          this.auth.switchShop(res.data._id);
        }
      },
      error: (err) => {
        this.savingBranch.set(false);
        this.toast.error('त्रुटि', err.error?.message || 'शाखा जोड़ने में विफल।');
      }
    });
  }

  logout() {
    this.auth.logout();
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
}
