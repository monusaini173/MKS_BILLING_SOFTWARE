import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { Observable, tap, catchError, throwError, of } from 'rxjs';

export interface User {
  _id: string;
  name: string;
  email: string;
  mobile: string;
  role: 'SUPER_ADMIN' | 'SHOP_OWNER' | 'EMPLOYEE';
  shopId: string | null;
  isActive: boolean;
  permissions?: string[];
}

export interface Shop {
  _id: string;
  name: string;
  shopType: 'GARMENTS' | 'SHOES' | 'KIRANA' | 'MOBILE' | 'MEDICAL' | 'COSMETICS' | 'STATIONERY' | 'HARDWARE';
  ownerName: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  logo?: string;
  isGSTRegistered: boolean;
  invoicePrefix: string;
  currency: string;
  branchName?: string;
  branchCode?: string;
  isMainBranch?: boolean;
  drugLicenseNumber?: string;
  pharmacistName?: string;
  pharmacistRegNumber?: string;
  invoiceFooter?: string;
  licenseType?: string;
  upiId?: string;
  upiName?: string;
  enableUpiQrOnInvoice?: boolean;
  stateCode?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  bankIfsc?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<User | null>(null);
  currentShop = signal<Shop | null>(null);
  myShops = signal<Shop[]>([]);
  isAuthenticated = computed(() => this.currentUser() !== null);
  isSuperAdmin = computed(() => this.currentUser()?.role === 'SUPER_ADMIN');
  isShopOwner = computed(() => this.currentUser()?.role === 'SHOP_OWNER');
  isEmployee = computed(() => this.currentUser()?.role === 'EMPLOYEE');

  // Impersonation state
  isImpersonating = signal<boolean>(false);
  originalAdminUser = signal<any>(null);

  constructor(
    private api: ApiService,
    private router: Router,
    private toast: ToastService
  ) {
    this.loadStorage();
    if (this.getAccessToken()) {
      this.loadMe().subscribe({
        error: () => {}
      });
    }
  }

  private loadStorage() {
    try {
      const userJson = sessionStorage.getItem('mks_user') || localStorage.getItem('mks_user');
      const shopJson = sessionStorage.getItem('mks_shop') || localStorage.getItem('mks_shop');
      const myShopsJson = sessionStorage.getItem('mks_my_shops') || localStorage.getItem('mks_my_shops');
      const impersonationJson = sessionStorage.getItem('mks_admin_backup') || localStorage.getItem('mks_admin_backup');
      const accessToken = sessionStorage.getItem('mks_access_token') || localStorage.getItem('mks_access_token');
      const refreshToken = sessionStorage.getItem('mks_refresh_token') || localStorage.getItem('mks_refresh_token');
      
      if (accessToken && !sessionStorage.getItem('mks_access_token')) {
        sessionStorage.setItem('mks_access_token', accessToken);
      }
      if (refreshToken && !sessionStorage.getItem('mks_refresh_token')) {
        sessionStorage.setItem('mks_refresh_token', refreshToken);
      }

      if (userJson && userJson !== 'undefined' && userJson !== 'null') {
        try { 
          const u = JSON.parse(userJson);
          this.currentUser.set(u);
          if (!sessionStorage.getItem('mks_user')) sessionStorage.setItem('mks_user', userJson);
        } catch (e) {}
      }
      if (shopJson && shopJson !== 'undefined' && shopJson !== 'null') {
        try { 
          const s = JSON.parse(shopJson);
          this.currentShop.set(s);
          if (!sessionStorage.getItem('mks_shop')) sessionStorage.setItem('mks_shop', shopJson);
        } catch (e) {}
      }
      if (myShopsJson && myShopsJson !== 'undefined' && myShopsJson !== 'null') {
        try {
          const ms = JSON.parse(myShopsJson);
          if (Array.isArray(ms)) this.myShops.set(ms);
        } catch (e) {}
      }
      if (impersonationJson && impersonationJson !== 'undefined' && impersonationJson !== 'null') {
        try {
          const parsed = JSON.parse(impersonationJson);
          if (parsed && parsed.user) {
            this.isImpersonating.set(true);
            this.originalAdminUser.set(parsed.user);
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error('Failed to parse auth user/shop from storage', e);
      this.clearTokens();
    }
  }

  getAccessToken(): string | null {
    return sessionStorage.getItem('mks_access_token') || localStorage.getItem('mks_access_token');
  }

  getRefreshToken(): string | null {
    return sessionStorage.getItem('mks_refresh_token') || localStorage.getItem('mks_refresh_token');
  }

  setTokens(access: string, refresh: string) {
    sessionStorage.setItem('mks_access_token', access);
    sessionStorage.setItem('mks_refresh_token', refresh);
    localStorage.setItem('mks_access_token', access);
    localStorage.setItem('mks_refresh_token', refresh);
  }

  clearTokens() {
    sessionStorage.removeItem('mks_access_token');
    sessionStorage.removeItem('mks_refresh_token');
    sessionStorage.removeItem('mks_user');
    sessionStorage.removeItem('mks_shop');
    sessionStorage.removeItem('mks_my_shops');
    sessionStorage.removeItem('mks_admin_pin_session');
    sessionStorage.removeItem('mks_admin_backup');
    localStorage.removeItem('mks_access_token');
    localStorage.removeItem('mks_refresh_token');
    localStorage.removeItem('mks_user');
    localStorage.removeItem('mks_shop');
    localStorage.removeItem('mks_my_shops');
    localStorage.removeItem('mks_admin_backup');
    this.currentUser.set(null);
    this.currentShop.set(null);
    this.myShops.set([]);
  }

  // 🏢 Multi-Branch & Multi-Shop Methods
  loadMyShops(): Observable<any> {
    return this.api.get<any>('/auth/my-shops').pipe(
      tap(res => {
        if (res.success && Array.isArray(res.data)) {
          this.myShops.set(res.data);
          sessionStorage.setItem('mks_my_shops', JSON.stringify(res.data));
          localStorage.setItem('mks_my_shops', JSON.stringify(res.data));
        }
      })
    );
  }

  createBranch(data: any): Observable<any> {
    return this.api.post<any>('/auth/create-branch', data).pipe(
      tap(res => {
        if (res.success && res.data) {
          const updated = [...this.myShops(), res.data];
          this.myShops.set(updated);
          sessionStorage.setItem('mks_my_shops', JSON.stringify(updated));
          localStorage.setItem('mks_my_shops', JSON.stringify(updated));
          this.toast.success('शाखा जोड़ी गई (Branch Added)', res.message || `नई शाखा ${res.data.name} जोड़ी गई।`);
        }
      })
    );
  }

  switchShop(shopId: string): void {
    if (!shopId) return;
    const target = this.myShops().find(s => s._id === shopId);
    if (!target) return;

    this.api.post<any>(`/auth/switch-shop/${shopId}`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.currentShop.set(res.data.shop);
          sessionStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
          localStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
          
          if (res.data.user) {
            this.currentUser.set(res.data.user);
            sessionStorage.setItem('mks_user', JSON.stringify(res.data.user));
            localStorage.setItem('mks_user', JSON.stringify(res.data.user));
          }

          this.toast.success('दुकान स्विच (Branch Switched)', `अब आप "${res.data.shop.name} (${res.data.shop.branchName || 'Branch'})" में कार्य कर रहे हैं।`);
          
          // Trigger a lightweight soft reload or navigate to refresh components
          const currentUrl = this.router.url;
          this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
            this.router.navigate([currentUrl]);
          });
        }
      },
      error: (err) => {
        this.toast.error('Switch Failed', err.error?.message || 'शाखा बदलने में त्रुटि हुई।');
      }
    });
  }

  register(data: any): Observable<any> {
    return this.api.post<any>('/auth/register', data).pipe(
      tap(res => {
        if (res.success) {
          sessionStorage.removeItem('mks_admin_pin_session');
          this.setTokens(res.data.accessToken, res.data.refreshToken);
          this.currentUser.set(res.data.user);
          this.currentShop.set(res.data.shop);
          if (res.data.shop) {
            this.myShops.set([res.data.shop]);
            sessionStorage.setItem('mks_my_shops', JSON.stringify([res.data.shop]));
          }
          sessionStorage.setItem('mks_user', JSON.stringify(res.data.user));
          sessionStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
          localStorage.setItem('mks_user', JSON.stringify(res.data.user));
          localStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
          const shopTypeName = res.data.shop?.shopType || 'Shop';
          this.toast.success('Welcome!', `${res.data.shop?.name} (${shopTypeName}) Dashboard ready.`);
        }
      })
    );
  }

  // 🔐 3-TIER MULTI-FACTOR AUTHENTICATION METHODS
  loginStep1(credentials: any): Observable<any> {
    return this.api.post<any>('/auth/login-step1', credentials);
  }

  loginStep2Pin(stepToken: string, pin: string): Observable<any> {
    return this.api.post<any>('/auth/login-step2-pin', { stepToken, pin }).pipe(
      tap(res => {
        if (res.success && res.data?.accessToken) {
          sessionStorage.removeItem('mks_admin_pin_session');
          this.setTokens(res.data.accessToken, res.data.refreshToken);
          this.currentUser.set(res.data.user);
          sessionStorage.setItem('mks_user', JSON.stringify(res.data.user));
          localStorage.setItem('mks_user', JSON.stringify(res.data.user));

          if (res.data.user?.role === 'SUPER_ADMIN') {
            this.currentShop.set(null);
            sessionStorage.removeItem('mks_shop');
            localStorage.removeItem('mks_shop');
            this.toast.success('👑 Super Admin Console', 'Platform Owner Console successfully loaded.');
          } else {
            this.currentShop.set(res.data.shop);
            if (res.data.shop) {
              sessionStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
              localStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
            }
            const shopName = res.data.shop?.name || 'Shop';
            const shopTypeName = res.data.shop?.shopType || 'Retail';
            this.toast.success('Welcome Back!', `${shopName} (${shopTypeName}) Dashboard ready.`);
          }
        }
      })
    );
  }

  loginStep3SendOtp(stepToken: string, customMobile?: string): Observable<any> {
    return this.api.post<any>('/auth/login-step3-send-otp', { stepToken, customMobile });
  }

  loginStep3VerifyOtp(stepToken: string, otp: string): Observable<any> {
    return this.api.post<any>('/auth/login-step3-verify-otp', { stepToken, otp }).pipe(
      tap(res => {
        if (res.success && res.data) {
          sessionStorage.removeItem('mks_admin_pin_session');
          this.setTokens(res.data.accessToken, res.data.refreshToken);
          this.currentUser.set(res.data.user);
          sessionStorage.setItem('mks_user', JSON.stringify(res.data.user));
          localStorage.setItem('mks_user', JSON.stringify(res.data.user));

          if (res.data.user?.role === 'SUPER_ADMIN') {
            this.currentShop.set(null);
            sessionStorage.removeItem('mks_shop');
            localStorage.removeItem('mks_shop');
            this.toast.success('👑 Super Admin Console', 'Platform Owner Console successfully loaded.');
          } else {
            this.currentShop.set(res.data.shop);
            if (res.data.shop) {
              sessionStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
              localStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
            } else {
              sessionStorage.removeItem('mks_shop');
              localStorage.removeItem('mks_shop');
            }
            const shopName = res.data.shop?.name || 'Shop';
            const shopTypeName = res.data.shop?.shopType || 'Retail';
            this.toast.success('Welcome Back!', `${shopName} (${shopTypeName}) Dashboard ready.`);
          }
        }
      })
    );
  }

  // Fallback legacy methods
  login(credentials: any): Observable<any> {
    return this.api.post<any>('/auth/login', credentials);
  }

  verifyLoginOtp(tempToken: string, otp: string): Observable<any> {
    return this.loginStep3VerifyOtp(tempToken, otp);
  }

  resendLoginOtp(tempToken: string): Observable<any> {
    return this.loginStep3SendOtp(tempToken);
  }

  refreshToken(): Observable<any> {
    const refresh = this.getRefreshToken();
    if (!refresh) return throwError(() => new Error('No refresh token'));

    return this.api.post<any>('/auth/refresh', { refreshToken: refresh }).pipe(
      tap(res => {
        if (res.success) {
          this.setTokens(res.data.accessToken, res.data.refreshToken);
        }
      }),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout() {
    const token = this.getAccessToken();
    if (token) {
      this.api.post('/auth/logout').subscribe({
        next: () => {},
        error: () => {}
      });
    }
    this.clearTokens();
    this.router.navigate(['/auth/login']);
    this.toast.info('Logged Out', 'You have been logged out.');
  }

  changePassword(data: any): Observable<any> {
    return this.api.put<any>('/auth/change-password', data);
  }

  masterResetPassword(data: { identifier: string; masterCode: string; newPassword: string }): Observable<any> {
    return this.api.post<any>('/auth/master-reset-password', data);
  }

  // 🔥 1-Click Shop Impersonation by Super Admin
  impersonateShop(shopId: string) {
    // 1. Backup super admin session
    const adminBackup = {
      accessToken: this.getAccessToken(),
      refreshToken: this.getRefreshToken(),
      user: this.currentUser(),
      shop: this.currentShop()
    };
    sessionStorage.setItem('mks_admin_backup', JSON.stringify(adminBackup));

    // 2. Call backend impersonation endpoint
    this.api.post<any>(`/admin/shops/${shopId}/impersonate`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.setTokens(res.data.token, res.data.token);
          this.currentUser.set(res.data.user);
          this.currentShop.set(res.data.shop);
          this.isImpersonating.set(true);
          this.originalAdminUser.set(adminBackup.user);

          sessionStorage.setItem('mks_user', JSON.stringify(res.data.user));
          sessionStorage.setItem('mks_shop', JSON.stringify(res.data.shop));

          this.toast.info('दुकान व्यू मोड सक्रिय (Viewing Shop)', `अब आप "${res.data.shop.name}" की दुकान में प्रवेश कर चुके हैं।`);
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.toast.error('Impersonation Failed', err.error?.message || 'Could not log into target shop.');
      }
    });
  }

  // 🚀 Exit Impersonation and return to Super Admin Console
  stopImpersonation() {
    try {
      const backupJson = sessionStorage.getItem('mks_admin_backup');
      if (backupJson) {
        const backup = JSON.parse(backupJson);
        this.setTokens(backup.accessToken, backup.refreshToken);
        this.currentUser.set(backup.user);
        this.currentShop.set(backup.shop);

        sessionStorage.setItem('mks_user', JSON.stringify(backup.user));
        sessionStorage.setItem('mks_shop', JSON.stringify(backup.shop));
        sessionStorage.removeItem('mks_admin_backup');
      }
    } catch (e) {
      console.error('Failed to restore admin backup', e);
    }

    this.isImpersonating.set(false);
    this.originalAdminUser.set(null);
    this.toast.success('Super Admin Restored', 'Returned to Master Owner Console.');
    this.router.navigate(['/admin/shops']);
  }

  loadMe(): Observable<any> {
    return this.api.get<any>('/auth/me').pipe(
      tap(res => {
        if (res.success) {
          this.currentUser.set(res.data.user);
          this.currentShop.set(res.data.shop);
          if (res.data.myShops && Array.isArray(res.data.myShops)) {
            this.myShops.set(res.data.myShops);
            sessionStorage.setItem('mks_my_shops', JSON.stringify(res.data.myShops));
            localStorage.setItem('mks_my_shops', JSON.stringify(res.data.myShops));
          }
          sessionStorage.setItem('mks_user', JSON.stringify(res.data.user));
          sessionStorage.setItem('mks_shop', JSON.stringify(res.data.shop));
        }
      }),
      catchError(err => {
        this.clearTokens();
        return throwError(() => err);
      })
    );
  }
}

