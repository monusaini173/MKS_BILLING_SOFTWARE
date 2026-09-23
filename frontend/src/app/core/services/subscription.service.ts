import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';

export interface PlanDetail {
  key: 'BASIC_MONTHLY' | 'PRO_MONTHLY' | 'ENTERPRISE_YEARLY';
  name: string;
  price: number;
  days: number;
  features: string[];
  hasUnlimitedWhatsApp: boolean;
}

export interface SubscriptionStatus {
  shopId: string;
  shopName: string;
  subscriptionPlan: 'TRIAL' | 'BASIC_MONTHLY' | 'PRO_MONTHLY' | 'ENTERPRISE_YEARLY' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY' | 'FREE';
  subscriptionExpiry: string;
  isExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  planAmount: number;
  isTrial: boolean;
  isBasic: boolean;
  isPro: boolean;
  isYearly: boolean;
  canSendWhatsApp: boolean;
  razorpayKeyId: string;
  plans?: Record<string, PlanDetail>;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  status = signal<SubscriptionStatus | null>(null);
  loading = signal<boolean>(false);
  showUpgradeModal = signal<boolean>(false);

  // Available 3-Tier Plans
  plans = {
    BASIC_MONTHLY: {
      key: 'BASIC_MONTHLY' as const,
      name: 'Starter Stock Plan (इन्वेंट्री व बेसिक बिलिंग)',
      price: 150,
      period: 'माह (30 Days)',
      badge: '📦 स्टार्टर प्लान',
      features: [
        'स्टॉक व बारकोड इन्वेंट्री मैनेजमेंट',
        'उत्पाद कैटलॉग (Product Catalog)',
        'बेसिक इनवॉइस व GST बिलिंग',
        'सिंगल यूज़र एक्सेस'
      ],
      hasUnlimitedWhatsApp: false
    },
    PRO_MONTHLY: {
      key: 'PRO_MONTHLY' as const,
      name: 'Pro WhatsApp Plan (अनलिमिटेड WhatsApp + बिलिंग)',
      price: 500,
      period: 'माह (30 Days)',
      badge: '⚡ सबसे लोकप्रिय (Most Popular)',
      features: [
        'सब कुछ Starter Plan का',
        'अनलिमिटेड WhatsApp बिल व PDF शेयरिंग',
        'WhatsApp उधार तकादा (सामान लिस्ट सहित)',
        'नया स्टॉक WhatsApp फोटो ब्रॉडकास्ट',
        'ग्राहक SMS अलर्ट व खाता लेजर',
        'पूर्ण GST इनवॉइस व रिपोर्ट्स'
      ],
      hasUnlimitedWhatsApp: true
    },
    ENTERPRISE_YEARLY: {
      key: 'ENTERPRISE_YEARLY' as const,
      name: 'Enterprise Yearly Plan (कंप्लीट फीचर्स + 2 माह फ्री)',
      price: 4999,
      period: 'वर्ष (365 Days)',
      badge: '🌟 बेस्ट वैल्यू (₹1,001 की बचत)',
      features: [
        'सभी प्रीमियम फीचर्स अनलिमिटेड (365 दिन)',
        'मल्टी-यूज़र / स्टाफ बिलिंग खाते',
        'प्रॉफिट व लॉस (P&L) और GST सीए रिपोर्ट',
        'एक्सेल डेटा बैकअप व एक्सपोर्ट',
        '2 माह फ्री डिस्काउंट (₹1,001 की बचत)',
        '24x7 प्राथमिकता WhatsApp व कॉल सहायता'
      ],
      hasUnlimitedWhatsApp: true
    }
  };

  isTrial = computed(() => this.status()?.isTrial || this.status()?.subscriptionPlan === 'TRIAL');
  isExpired = computed(() => this.status()?.isExpired ?? false);
  
  isBasic = computed(() => this.status()?.subscriptionPlan === 'BASIC_MONTHLY' && !this.isExpired());
  isPro = computed(() => (this.status()?.subscriptionPlan === 'PRO_MONTHLY' || this.status()?.subscriptionPlan === 'PREMIUM_MONTHLY') && !this.isExpired());
  isYearly = computed(() => (this.status()?.subscriptionPlan === 'ENTERPRISE_YEARLY' || this.status()?.subscriptionPlan === 'PREMIUM_YEARLY') && !this.isExpired());
  
  isPremium = computed(() => (this.isBasic() || this.isPro() || this.isYearly()) && !this.isExpired());
  canSendWhatsApp = computed(() => (this.isPro() || this.isYearly() || this.isTrial()) && !this.isExpired());

  daysRemaining = computed(() => this.status()?.daysRemaining ?? 3);
  hoursRemaining = computed(() => this.status()?.hoursRemaining ?? 72);

  loadStatus() {
    const token = localStorage.getItem('mks_access_token');
    if (!token) return;

    this.loading.set(true);
    this.api.get<any>('/subscription/status').subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.status.set(res.data);
          if (res.data.isExpired) {
            setTimeout(() => this.showUpgradeModal.set(true), 800);
          }
        }
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  /**
   * Helper to ensure Razorpay checkout.js script is loaded dynamically
   */
  private loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
      if (typeof (window as any).Razorpay !== 'undefined') {
        resolve(true);
        return;
      }
      const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        // In case it already finished loading
        if (typeof (window as any).Razorpay !== 'undefined') {
          resolve(true);
        } else {
          setTimeout(() => resolve(typeof (window as any).Razorpay !== 'undefined'), 1000);
        }
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  /**
   * Pay online via Razorpay (UPI, Google Pay, PhonePe, Paytm, Cards, NetBanking)
   */
  async payWithRazorpay(planKey: 'BASIC_MONTHLY' | 'PRO_MONTHLY' | 'ENTERPRISE_YEARLY' = 'PRO_MONTHLY') {
    this.loading.set(true);
    this.toast.info('Initializing Razorpay', 'पेमेंट गेटवे लोड हो रहा है...');

    // 1. Ensure Razorpay SDK script is loaded
    const scriptLoaded = await this.loadRazorpayScript();
    if (!scriptLoaded || typeof (window as any).Razorpay === 'undefined') {
      this.loading.set(false);
      this.toast.error('Razorpay Error', 'Razorpay SDK लोड नहीं हो सका। कृपया इंटरनेट कनेक्शन जांचें।');
      return;
    }

    const planInfo = this.plans[planKey] || this.plans.PRO_MONTHLY;

    // 2. Try creating order on backend
    this.api.post<any>('/subscription/create-order', { plan: planKey }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.openRazorpayModal({
            keyId: res.data.keyId || 'rzp_test_TR7vSW6DHXNObT',
            amount: res.data.amount,
            currency: res.data.currency || 'INR',
            planName: res.data.plan?.name || planInfo.name,
            planPrice: res.data.plan?.price || planInfo.price,
            orderId: res.data.orderId,
            customerName: res.data.customerName,
            customerMobile: res.data.customerMobile,
            customerEmail: res.data.customerEmail
          }, planKey);
        } else {
          // Client-side direct mode fallback
          this.openRazorpayModal({
            keyId: 'rzp_test_TR7vSW6DHXNObT',
            amount: planInfo.price * 100,
            currency: 'INR',
            planName: planInfo.name,
            planPrice: planInfo.price
          }, planKey);
        }
      },
      error: (err) => {
        console.warn('Backend order endpoint fallback, launching direct Razorpay Checkout modal:', err);
        // Direct seamless fallback so payment popup always opens without fail!
        this.openRazorpayModal({
          keyId: 'rzp_test_TR7vSW6DHXNObT',
          amount: planInfo.price * 100,
          currency: 'INR',
          planName: planInfo.name,
          planPrice: planInfo.price
        }, planKey);
      }
    });
  }

  private openRazorpayModal(config: any, planKey: string) {
    const options: any = {
      key: config.keyId || 'rzp_test_TR7vSW6DHXNObT',
      amount: config.amount,
      currency: config.currency || 'INR',
      name: 'MKS Billing Software',
      description: `${config.planName} - ₹${config.planPrice}`,
      image: 'https://cdn-icons-png.flaticon.com/512/9131/9131529.png',
      handler: (response: any) => {
        this.verifyPayment(response, planKey);
      },
      prefill: {
        name: config.customerName || this.status()?.shopName || 'Shop Owner',
        contact: config.customerMobile || '',
        email: config.customerEmail || ''
      },
      notes: {
        shopName: this.status()?.shopName || '',
        planKey: planKey
      },
      theme: {
        color: '#4f46e5'
      },
      modal: {
        ondismiss: () => {
          this.loading.set(false);
          this.toast.info('Payment Cancelled', 'भुगतान प्रक्रिया रद्द कर दी गई।');
        }
      }
    };

    if (config.orderId) {
      options.order_id = config.orderId;
    }

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        this.loading.set(false);
        this.toast.error('Payment Failed', resp.error?.description || 'भुगतान असफल रहा। कृपया पुनः प्रयास करें।');
      });

      this.loading.set(false);
      rzp.open();
    } catch (err: any) {
      this.loading.set(false);
      console.error('Razorpay popup open error:', err);
      this.toast.error('Razorpay Error', 'पॉपअप खोलने में समस्या हुई। कृपया ब्राउज़र पॉपअप ब्लॉकर चेक करें।');
    }
  }

  private verifyPayment(razorpayResponse: any, plan: string) {
    this.loading.set(true);
    this.toast.info('Activating Plan', 'भुगतान प्राप्त हुआ! सब्सक्रिप्शन एक्टिवेट हो रहा है...');

    // If order_id & signature exist, use verify endpoint, else use upgrade
    if (razorpayResponse.razorpay_signature && razorpayResponse.razorpay_order_id) {
      const payload = {
        razorpay_order_id: razorpayResponse.razorpay_order_id,
        razorpay_payment_id: razorpayResponse.razorpay_payment_id,
        razorpay_signature: razorpayResponse.razorpay_signature,
        plan
      };

      this.api.post<any>('/subscription/verify-payment', payload).subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success) {
            this.toast.success('🎉 Subscription Activated', res.message || 'आपका सब्सक्रिप्शन प्लान सफलतापूर्वक एक्टिवेट हो गया है!');
            this.showUpgradeModal.set(false);
            this.loadStatus();
          }
        },
        error: () => {
          // Fallback to direct activation
          this.fallbackActivate(plan, razorpayResponse.razorpay_payment_id);
        }
      });
    } else {
      this.fallbackActivate(plan, razorpayResponse.razorpay_payment_id);
    }
  }

  private fallbackActivate(plan: string, paymentId: string) {
    this.api.post<any>('/subscription/upgrade', {
      plan,
      paymentMethod: 'RAZORPAY',
      transactionId: paymentId
    }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.toast.success('🎉 Subscription Activated', res.message || 'आपका सब्सक्रिप्शन प्लान सफलतापूर्वक एक्टिवेट हो गया है!');
          this.showUpgradeModal.set(false);
          this.loadStatus();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Activation Failed', err.error?.message || 'प्लान एक्टिवेट करने में त्रुटि हुई।');
      }
    });
  }

  /**
   * Manual upgrade fallback
   */
  manualUpgrade(plan: 'BASIC_MONTHLY' | 'PRO_MONTHLY' | 'ENTERPRISE_YEARLY' = 'PRO_MONTHLY', paymentMethod: string = 'UPI') {
    this.loading.set(true);
    this.api.post<any>('/subscription/upgrade', { plan, paymentMethod }).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.toast.success('Subscription Activated', res.message || 'प्लान सक्रिय हो गया है!');
          this.showUpgradeModal.set(false);
          this.loadStatus();
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Upgrade Failed', err.error?.message || 'सब्सक्रिप्शन सक्रिय करने में त्रुटि हुई।');
      }
    });
  }
}
