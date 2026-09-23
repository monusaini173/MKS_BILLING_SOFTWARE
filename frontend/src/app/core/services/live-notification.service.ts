import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

export interface LiveNotification {
  id: string;
  type: 'SALE' | 'LOW_STOCK' | 'EXPIRY' | 'PAYMENT' | 'CUSTOMER_DUE' | 'SUPPLIER_DUE' | 'SYSTEM' | 'WHATSAPP';
  title: string;
  desc: string;
  time: string;
  timestamp: number;
  icon: string;
  iconColor: string;
  iconBg: string;
  read: boolean;
  route?: string;
  actionLabel?: string;
  badge?: string;
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class LiveNotificationService {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  // Core State
  notifications = signal<LiveNotification[]>([]);
  soundEnabled = signal<boolean>(true);
  desktopPermission = signal<NotificationPermission>('default');
  activeFilter = signal<'ALL' | 'SALES' | 'LOW_STOCK' | 'DUES' | 'EXPIRY'>('ALL');
  
  // Floating Live Pop-up Toast Alert (Auto-shows when new live alert triggers)
  latestLiveAlert = signal<LiveNotification | null>(null);
  private liveAlertTimer: any;
  private pollInterval: any;
  private lastFetchedSalesCount = 0;
  private knownSaleIds = new Set<string>();

  // Persistent Cleared & Dismissed State
  private dismissedIds = new Set<string>();
  private readIds = new Set<string>();
  private clearedAtTimestamp = 0;

  // Computed Filtered List
  filteredNotifications = computed(() => {
    const list = this.notifications();
    const filter = this.activeFilter();
    if (filter === 'ALL') return list;
    if (filter === 'SALES') return list.filter(n => n.type === 'SALE' || n.type === 'WHATSAPP');
    if (filter === 'LOW_STOCK') return list.filter(n => n.type === 'LOW_STOCK');
    if (filter === 'DUES') return list.filter(n => n.type === 'CUSTOMER_DUE' || n.type === 'SUPPLIER_DUE' || n.type === 'PAYMENT');
    if (filter === 'EXPIRY') return list.filter(n => n.type === 'EXPIRY');
    return list;
  });

  // Computed Unread Count
  unreadCount = computed(() => {
    return this.notifications().filter(n => !n.read).length;
  });

  constructor() {
    // Load sound preference & cleared states from localStorage
    try {
      const savedSound = localStorage.getItem('mks_notif_sound');
      if (savedSound !== null) {
        this.soundEnabled.set(savedSound === 'true');
      }
      if (typeof window !== 'undefined' && 'Notification' in window) {
        this.desktopPermission.set(Notification.permission);
      }
      this.loadStateFromStorage();
    } catch (e) {}

    // Initialize Polling if user logged in
    this.initNotifications();
  }

  private loadStateFromStorage() {
    try {
      const savedDismissed = localStorage.getItem('mks_dismissed_notifs');
      if (savedDismissed) {
        const arr = JSON.parse(savedDismissed);
        if (Array.isArray(arr)) this.dismissedIds = new Set(arr);
      }
      const savedRead = localStorage.getItem('mks_read_notif_ids');
      if (savedRead) {
        const arr = JSON.parse(savedRead);
        if (Array.isArray(arr)) this.readIds = new Set(arr);
      }
      const savedClearedAt = localStorage.getItem('mks_notifs_cleared_at');
      if (savedClearedAt) {
        this.clearedAtTimestamp = Number(savedClearedAt) || 0;
      }
    } catch (e) {}
  }

  private saveStateToStorage() {
    try {
      localStorage.setItem('mks_dismissed_notifs', JSON.stringify(Array.from(this.dismissedIds)));
      localStorage.setItem('mks_read_notif_ids', JSON.stringify(Array.from(this.readIds)));
      localStorage.setItem('mks_notifs_cleared_at', String(this.clearedAtTimestamp));
    } catch (e) {}
  }

  /**
   * Initialize live alerts and background polling
   */
  initNotifications() {
    if (this.auth.isAuthenticated()) {
      this.fetchLiveAlerts();
    }

    // Background live poll every 25 seconds
    if (typeof window !== 'undefined') {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(() => {
        if (this.auth.isAuthenticated()) {
          this.fetchLiveAlerts(true);
        }
      }, 25000);
    }
  }

  /**
   * Request Desktop Web Push Notification Permission
   */
  async requestDesktopPermission(): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const perm = await Notification.requestPermission();
        this.desktopPermission.set(perm);
        return perm === 'granted';
      }
    } catch (e) {
      console.warn('Desktop notification error:', e);
    }
    return false;
  }

  /**
   * Toggle Notification Sound Chime on / off
   */
  toggleSound(): boolean {
    const newVal = !this.soundEnabled();
    this.soundEnabled.set(newVal);
    try {
      localStorage.setItem('mks_notif_sound', String(newVal));
    } catch (e) {}
    if (newVal) {
      this.playChime();
    }
    return newVal;
  }

  /**
   * Fetch Live Alerts from Backend API
   */
  fetchLiveAlerts(isBackground: boolean = false) {
    this.api.get<any>('/reports/live-alerts').subscribe({
      next: (res) => {
        if (res?.success && res?.data) {
          this.processBackendAlerts(res.data, isBackground);
        }
      },
      error: () => {}
    });
  }

  /**
   * Process and convert backend live feed into UI notification objects
   */
  private processBackendAlerts(data: any, isBackground: boolean) {
    const list: LiveNotification[] = [];
    const now = Date.now();

    // 1. Process Recent Sales
    if (data.recentSales && Array.isArray(data.recentSales)) {
      data.recentSales.forEach((sale: any) => {
        const saleTs = new Date(sale.createdAt || sale.invoiceDate).getTime();
        const notifId = `sale_${sale._id}`;

        // Skip if dismissed or created before clearAll timestamp
        if (this.dismissedIds.has(notifId) || saleTs <= this.clearedAtTimestamp) {
          return;
        }

        const isNewSale = !this.knownSaleIds.has(sale._id) && isBackground;
        this.knownSaleIds.add(sale._id);

        const notif: LiveNotification = {
          id: notifId,
          type: 'SALE',
          title: `💰 नया बिल: #${sale.invoiceNumber}`,
          desc: `${sale.customerName || 'Walk-in ग्राहक'} - ₹${sale.grandTotal?.toLocaleString('en-IN') || 0} (${sale.paymentMethod || 'CASH'})`,
          time: this.formatRelativeTime(saleTs),
          timestamp: saleTs,
          icon: 'fa-solid fa-receipt',
          iconColor: '#059669',
          iconBg: '#ecfdf5',
          read: this.readIds.has(notifId),
          route: `/billing/${sale._id}/invoice`,
          actionLabel: 'बिल देखें',
          badge: 'नया बिल',
          data: sale
        };

        list.push(notif);

        // If a brand new sale was detected via background poll, pop the live toast
        if (isNewSale) {
          this.triggerLiveAlert(notif);
        }
      });
    }

    // 2. Process Low Stock Items
    if (data.lowStockItems && Array.isArray(data.lowStockItems)) {
      data.lowStockItems.slice(0, 5).forEach((p: any) => {
        const notifId = `stock_${p._id}`;
        if (this.dismissedIds.has(notifId) || (now - 3600000) <= this.clearedAtTimestamp) {
          return;
        }

        const isOut = p.quantity <= 0;
        list.push({
          id: notifId,
          type: 'LOW_STOCK',
          title: isOut ? `🚫 आउट ऑफ स्टॉक: ${p.name}` : `⚠️ कम स्टॉक अलर्ट: ${p.name}`,
          desc: `वर्तमान स्टॉक: ${p.quantity} ${p.unit || 'PCS'} (न्यूनतम सीमा: ${p.minStockLevel || 5})`,
          time: 'तत्काल री-ऑर्डर करें',
          timestamp: now - 3600000,
          icon: isOut ? 'fa-solid fa-ban' : 'fa-solid fa-triangle-exclamation',
          iconColor: isOut ? '#dc2626' : '#ea580c',
          iconBg: isOut ? '#fee2e2' : '#ffedd5',
          read: this.readIds.has(notifId),
          route: '/inventory',
          actionLabel: 'स्टॉक मंगाएं',
          badge: isOut ? 'स्टॉक खत्म' : 'कम स्टॉक',
          data: p
        });
      });
    }

    // 3. Process Expiring Items
    if (data.expiringItems && Array.isArray(data.expiringItems)) {
      data.expiringItems.slice(0, 4).forEach((p: any) => {
        const notifId = `exp_${p._id}`;
        if (this.dismissedIds.has(notifId) || (now - 7200000) <= this.clearedAtTimestamp) {
          return;
        }

        const expDate = p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'जल्द';
        list.push({
          id: notifId,
          type: 'EXPIRY',
          title: `💊 एक्सपायरी अलर्ट: ${p.name}`,
          desc: `बैच #${p.batchNumber || 'N/A'} - एक्सपायरी तिथि: ${expDate} (${p.quantity} ${p.unit || 'PCS'})`,
          time: 'अगले 30 दिन में',
          timestamp: now - 7200000,
          icon: 'fa-solid fa-clock-rotate-left',
          iconColor: '#e11d48',
          iconBg: '#ffe4e6',
          read: this.readIds.has(notifId),
          route: '/inventory',
          actionLabel: 'चेक करें',
          badge: 'एक्सपायरी',
          data: p
        });
      });
    }

    // 4. Process Pending Customer Dues
    if (data.pendingCustomers && Array.isArray(data.pendingCustomers)) {
      data.pendingCustomers.slice(0, 3).forEach((c: any) => {
        const notifId = `cust_${c._id}`;
        if (this.dismissedIds.has(notifId) || (now - 10800000) <= this.clearedAtTimestamp) {
          return;
        }

        list.push({
          id: notifId,
          type: 'CUSTOMER_DUE',
          title: `👥 उधारी बकाया: ${c.name}`,
          desc: `ग्राहक पर ₹${c.pendingAmount?.toLocaleString('en-IN')} का बकाया है। WhatsApp तकादा भेजें।`,
          time: 'रिमाइंडर',
          timestamp: now - 10800000,
          icon: 'fa-solid fa-user-clock',
          iconColor: '#7c3aed',
          iconBg: '#f3e8ff',
          read: this.readIds.has(notifId),
          route: '/customers',
          actionLabel: 'खाता देखें',
          badge: 'उधारी',
          data: c
        });
      });
    }

    // 5. System General Notifications
    const sysId = 'sys_backup';
    if (!this.dismissedIds.has(sysId) && (now - 14400000) > this.clearedAtTimestamp) {
      list.push({
        id: sysId,
        type: 'SYSTEM',
        title: '💾 दैनिक डेटा बैकअप',
        desc: 'अपना व्यापार डेटा सुरक्षित रखने हेतु आज का ऑफलाइन बैकअप डाउनलोड करें।',
        time: 'नियमित सुझाव',
        timestamp: now - 14400000,
        icon: 'fa-solid fa-shield-halved',
        iconColor: '#0284c7',
        iconBg: '#e0f2fe',
        read: this.readIds.has(sysId),
        route: '/settings',
        actionLabel: 'बैकअप लें',
        badge: 'बैकअप'
      });
    }

    // Sort by timestamp descending
    list.sort((a, b) => b.timestamp - a.timestamp);
    this.notifications.set(list);
  }

  /**
   * Instantly trigger a live notification when a new sale is completed in the POS
   */
  pushSaleNotification(sale: any) {
    if (!sale) return;
    this.knownSaleIds.add(sale._id || String(Date.now()));

    const notif: LiveNotification = {
      id: `sale_${sale._id || Date.now()}`,
      type: 'SALE',
      title: `🎉 नया बिल बना: #${sale.invoiceNumber || 'INV'}`,
      desc: `${sale.customerName || 'Walk-in ग्राहक'} • ₹${(sale.grandTotal || 0).toLocaleString('en-IN')} (${sale.paymentMethod || 'CASH'})`,
      time: 'अभी (Just now)',
      timestamp: Date.now(),
      icon: 'fa-solid fa-bolt',
      iconColor: '#10b981',
      iconBg: '#d1fae5',
      read: false,
      route: sale._id ? `/billing/${sale._id}/invoice` : '/billing',
      actionLabel: 'प्रिंट / देखें',
      badge: 'लाइव बिल',
      data: sale
    };

    this.notifications.update(list => [notif, ...list.filter(n => n.id !== notif.id)]);
    this.triggerLiveAlert(notif);
  }

  /**
   * Instantly trigger a live notification for WhatsApp sent
   */
  pushWhatsAppNotification(recipient: string, billNo?: string) {
    const notif: LiveNotification = {
      id: `wa_${Date.now()}`,
      type: 'WHATSAPP',
      title: `📱 WhatsApp बिल भेजा गया`,
      desc: `${recipient} को इनवॉइस ${billNo ? '#' + billNo : ''} सफलतापूर्वक भेज दिया गया।`,
      time: 'अभी',
      timestamp: Date.now(),
      icon: 'fa-brands fa-whatsapp',
      iconColor: '#16a34a',
      iconBg: '#dcfce7',
      read: false,
      route: '/reports/sales',
      actionLabel: 'रिपोर्ट्स',
      badge: 'WhatsApp'
    };

    this.notifications.update(list => [notif, ...list]);
    this.triggerLiveAlert(notif);
  }

  /**
   * Trigger popup card + sound chime + desktop alert
   */
  private triggerLiveAlert(notif: LiveNotification) {
    // 1. Play Modern Web Audio Chime
    if (this.soundEnabled()) {
      this.playChime();
    }

    // 2. Show floating on-screen live banner
    this.latestLiveAlert.set(notif);
    if (this.liveAlertTimer) clearTimeout(this.liveAlertTimer);
    this.liveAlertTimer = setTimeout(() => {
      this.latestLiveAlert.set(null);
    }, 6500);

    // 3. Desktop Native Notification if permitted
    this.showDesktopNotification(notif.title, notif.desc);
  }

  /**
   * Show native desktop browser push notification
   */
  private showDesktopNotification(title: string, body: string) {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/assets/images/mks_billing_logo.png'
        });
      }
    } catch (e) {}
  }

  /**
   * Crystal Clear Web Audio chime for live alerts
   */
  playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Dual-tone chime: High gentle bell chord (880Hz -> 1320Hz)
      const playBell = (freq: number, start: number, duration: number, gainVal: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playBell(784, 0, 0.25, 0.15);      // G5
      playBell(1046.5, 0.08, 0.35, 0.2); // C6
      playBell(1318.5, 0.16, 0.45, 0.18);// E6
    } catch (e) {
      console.warn('Audio chime unavailable:', e);
    }
  }

  /**
   * Mark single notification as read
   */
  markAsRead(id: string) {
    this.readIds.add(id);
    this.saveStateToStorage();
    this.notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }

  /**
   * Mark all notifications as read
   */
  markAllAsRead() {
    this.notifications().forEach(n => this.readIds.add(n.id));
    this.saveStateToStorage();
    this.notifications.update(list =>
      list.map(n => ({ ...n, read: true }))
    );
    this.api.put('/notifications/mark-read', {}).subscribe({ error: () => {} });
  }

  /**
   * Dismiss/Remove a single notification
   */
  dismiss(id: string) {
    this.dismissedIds.add(id);
    this.saveStateToStorage();
    this.notifications.update(list => list.filter(n => n.id !== id));
    if (this.latestLiveAlert()?.id === id) {
      this.latestLiveAlert.set(null);
    }
  }

  /**
   * Clear all notifications persistently
   */
  clearAll() {
    this.clearedAtTimestamp = Date.now();
    this.notifications().forEach(n => this.dismissedIds.add(n.id));
    this.saveStateToStorage();
    this.notifications.set([]);
    this.latestLiveAlert.set(null);
    this.api.put('/notifications/mark-read', {}).subscribe({ error: () => {} });
  }

  /**
   * Dismiss floating live alert banner
   */
  dismissLiveAlert() {
    this.latestLiveAlert.set(null);
    if (this.liveAlertTimer) clearTimeout(this.liveAlertTimer);
  }

  /**
   * Format relative timestamp in Hindi / English
   */
  private formatRelativeTime(ts: number): string {
    const diffMs = Date.now() - ts;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'अभी-अभी (Just now)';
    if (mins < 60) return `${mins} मिनट पहले`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} घंटे पहले`;
    const days = Math.floor(hrs / 24);
    return `${days} दिन पहले`;
  }
}
