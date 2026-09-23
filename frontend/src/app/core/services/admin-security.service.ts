import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AdminSecurityService {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private auth = inject(AuthService);

  // Security Verification State
  isPinVerified = signal<boolean>(false);
  isPinModalOpen = signal<boolean>(false);
  isLockedOut = signal<boolean>(false);
  lockoutRemainingSecs = signal<number>(0);
  failedAttempts = signal<number>(0);

  // Auto-Lock Inactivity Timer (1 Minute)
  private readonly IDLE_TIMEOUT_MS = 60 * 1000;
  private idleTimer: any = null;
  private lastActivityTime = Date.now();
  private successCallback: (() => void) | null = null;
  private lockoutTimer: any = null;

  constructor() {
    this.restoreSessionVerification();
    this.initActivityTracker();
  }

  // Restore verification if authenticated within past 2 hours
  private restoreSessionVerification() {
    try {
      const saved = sessionStorage.getItem('mks_admin_pin_session');
      if (saved) {
        const data = JSON.parse(saved);
        if (data && data.timestamp && (Date.now() - data.timestamp < 2 * 60 * 60 * 1000)) {
          this.isPinVerified.set(true);
        } else {
          sessionStorage.removeItem('mks_admin_pin_session');
        }
      }
    } catch (e) {
      this.isPinVerified.set(false);
    }
  }

  private saveSessionVerification() {
    sessionStorage.setItem('mks_admin_pin_session', JSON.stringify({
      verified: true,
      timestamp: Date.now()
    }));
    this.isPinVerified.set(true);
  }

  resetSession() {
    this.isPinVerified.set(false);
    sessionStorage.removeItem('mks_admin_pin_session');
  }

  // Global Inactivity Listener: 1 Minute of Inactivity Locks the System
  private initActivityTracker() {
    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => {
      window.addEventListener(evt, () => {
        this.lastActivityTime = Date.now();
      }, { passive: true });
    });

    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      if (this.auth.isAuthenticated() && !this.isPinModalOpen()) {
        const currentUrl = this.router.url;
        if (currentUrl.includes('/auth/login') || currentUrl.includes('/auth/register') || currentUrl.includes('/auth/master-reset')) {
          return;
        }

        const idleTime = Date.now() - this.lastActivityTime;
        if (idleTime >= this.IDLE_TIMEOUT_MS) {
          this.triggerInactivityLock();
        }
      }
    }, 1000);
  }

  triggerInactivityLock() {
    if (this.isPinModalOpen()) return;
    this.isPinVerified.set(false);
    sessionStorage.removeItem('mks_admin_pin_session');
    this.openPinChallenge();
  }

  resetActivityTimer() {
    this.lastActivityTime = Date.now();
  }

  openPinChallenge(onSuccess?: () => void) {
    this.successCallback = onSuccess || null;
    this.isPinModalOpen.set(true);
  }

  closePinChallenge() {
    this.isPinModalOpen.set(false);
    this.successCallback = null;
    this.lastActivityTime = Date.now();
  }

  // Generates randomized numbers 0-9 for the Anti-Peep Scrambled Keypad
  generateScrambledKeypad(): number[] {
    const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = digits.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [digits[i], digits[j]] = [digits[j], digits[i]];
    }
    return digits;
  }

  verifyPin(pin: string, callback?: (success: boolean, message?: string) => void) {
    this.api.post<any>('/auth/admin-pin/verify', { pin }).subscribe({
      next: (res) => {
        if (res.success) {
          this.saveSessionVerification();
          this.isLockedOut.set(false);
          this.lockoutRemainingSecs.set(0);
          this.failedAttempts.set(0);
          this.isPinModalOpen.set(false);
          this.lastActivityTime = Date.now();
          this.toast.success('अनलॉक सफल! 🔓', 'सुरक्षा पिन सत्यापित हो गया है।');
          if (this.successCallback) {
            this.successCallback();
            this.successCallback = null;
          }
          if (callback) callback(true);
        }
      },
      error: (err) => {
        const errorData = err.error || {};
        if (errorData.code === 'PIN_LOCKED' || errorData.remainingSecs > 0) {
          this.startLockoutTimer(errorData.remainingSecs || 180);
        } else if (errorData.failedAttempts) {
          this.failedAttempts.set(errorData.failedAttempts);
        }
        this.toast.error('पिन अमान्य', errorData.message || 'गलत मास्टर सिक्योरिटी पिन!');
        if (callback) callback(false, errorData.message);
      }
    });
  }

  private startLockoutTimer(secs: number) {
    this.isLockedOut.set(true);
    this.lockoutRemainingSecs.set(secs);
    if (this.lockoutTimer) clearInterval(this.lockoutTimer);
    
    this.lockoutTimer = setInterval(() => {
      const current = this.lockoutRemainingSecs();
      if (current <= 1) {
        clearInterval(this.lockoutTimer);
        this.isLockedOut.set(false);
        this.lockoutRemainingSecs.set(0);
      } else {
        this.lockoutRemainingSecs.set(current - 1);
      }
    }, 1000);
  }

  setMasterPin(newPin: string, currentPassword?: string) {
    return this.api.post<any>('/auth/admin-pin/set', { newPin, currentPassword });
  }

  recoverMasterPin(recoveryKey: string, newPin: string) {
    return this.api.post<any>('/auth/admin-pin/recover', { recoveryKey, newPin });
  }

  getSecurityStatus() {
    return this.api.get<any>('/auth/admin-pin/status');
  }

  lockSession() {
    this.isPinVerified.set(false);
    sessionStorage.removeItem('mks_admin_pin_session');
    this.toast.info('Locked', 'एडमिन कंसोल लॉक कर दिया गया है।');
    this.openPinChallenge();
  }
}
