import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);

  // 3-Tier Multi-Factor Flow: 'CREDENTIALS' -> 'PIN' -> 'OTP'
  currentStep = signal<'CREDENTIALS' | 'PIN' | 'OTP'>('CREDENTIALS');

  // Step Tokens & Context
  stepToken = signal<string>('');
  userName = signal<string>('');
  maskedMobile = signal<string>('');

  // Inputs
  pinCode = signal<string>('');
  otpCode = signal<string>('');
  showPin = signal<boolean>(false);

  // Timers & Lockouts
  resendCountdown = signal<number>(30);
  private resendTimer: any = null;

  isLockedOut = signal<boolean>(false);
  lockoutRemainingSecs = signal<number>(0);
  private lockoutTimer: any = null;

  // 🔑 Master Code Reset State
  showMasterResetModal = signal<boolean>(false);
  resetIdentifier = signal<string>('');
  resetMasterCode = signal<string>('');
  resetNewPassword = signal<string>('');
  resetConfirmPassword = signal<string>('');
  resetLoading = signal<boolean>(false);
  showResetPassword = signal<boolean>(false);

  // Form Step 1
  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = false;
  pinLoading = false;
  otpLoading = false;
  resendLoading = false;
  showPassword = false;

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  togglePinVisibility() {
    this.showPin.set(!this.showPin());
  }

  // =========================================================================
  // STEP 1: VERIFY EMAIL / MOBILE & PASSWORD -> MOVE TO STEP 2 (PIN)
  // =========================================================================
  onSubmitStep1() {
    if (this.isLockedOut()) return;
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.auth.loginStep1(this.loginForm.value).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data?.stepToken) {
          this.stepToken.set(res.data.stepToken);
          this.userName.set(res.data.userName || 'User');
          this.maskedMobile.set(res.data.maskedMobile || 'Registered Number');
          this.pinCode.set('');
          this.currentStep.set('PIN');
          this.toast.info('पासवर्ड सत्यापित', 'कृपया अपना सुरक्षा पिन (Security PIN) दर्ज करें।');
        }
      },
      error: (err) => {
        this.loading = false;
        const errData = err.error || {};
        if (errData.code === 'LOGIN_LOCKED' || errData.remainingSecs > 0) {
          this.startLockoutTimer(errData.remainingSecs || 180);
          this.toast.error('खाता लॉक!', errData.message || 'गलत पासवर्ड के कारण खाता लॉक हो गया है।');
        } else {
          this.toast.error('लॉगिन विफल (Login Failed)', errData.message || 'अमान्य ईमेल या पासवर्ड।');
        }
      }
    });
  }

  // =========================================================================
  // STEP 2: VERIFY SECURITY PIN -> AUTO-DISPATCH SMS OTP TO REGISTERED MOBILE
  // =========================================================================
  onSubmitStep2Pin() {
    const pin = this.pinCode().trim();
    if (!pin || pin.length < 4) {
      this.toast.warning('PIN Required', 'कृपया अपना सुरक्षा पिन दर्ज करें।');
      return;
    }

    this.pinLoading = true;
    this.auth.loginStep2Pin(this.stepToken(), pin).subscribe({
      next: (res) => {
        this.pinLoading = false;
        if (res.success && res.data?.stepToken) {
          this.stepToken.set(res.data.stepToken);
          if (res.data.maskedMobile) {
            this.maskedMobile.set(res.data.maskedMobile);
          }
          this.currentStep.set('OTP');
          this.otpCode.set('');
          this.startResendTimer();
          this.toast.success('पिन सत्यापित! 📲', res.message || 'OTP आपके पंजीकृत मोबाइल पर भेज दिया गया है।');
        } else if (res.success && res.data?.user) {
          this.toast.success('लॉगिन सफल! 🔑', 'सुरक्षा पिन सत्यापित हो गया है। स्वागत है!');
          this.redirectAfterLogin(res.data.user);
        }
      },
      error: (err) => {
        this.pinLoading = false;
        this.toast.error('पिन गलत है', err.error?.message || 'गलत सुरक्षा पिन दर्ज किया गया है।');
      }
    });
  }

  // =========================================================================
  // STEP 3A: SEND SMS OTP TO REGISTERED MOBILE NUMBER
  // =========================================================================
  onSendOtp() {
    this.resendLoading = true;
    this.auth.loginStep3SendOtp(this.stepToken()).subscribe({
      next: (res) => {
        this.resendLoading = false;
        if (res.success && res.data?.stepToken) {
          this.stepToken.set(res.data.stepToken);
          if (res.data.maskedMobile) {
            this.maskedMobile.set(res.data.maskedMobile);
          }
          this.startResendTimer();
          this.toast.info('📱 SMS भेजा गया', res.message || 'पंजीकृत मोबाइल नंबर पर OTP भेज दिया गया है।');
        }
      },
      error: (err) => {
        this.resendLoading = false;
        this.toast.error('SMS Error', err.error?.message || 'OTP भेजने में त्रुटि हुई।');
      }
    });
  }

  // =========================================================================
  // STEP 3B: VERIFY SMS OTP & COMPLETE LOGIN DIRECTLY
  // =========================================================================
  onVerifyStep3Otp() {
    const otp = this.otpCode().trim();
    if (!otp || otp.length < 6) {
      this.toast.warning('OTP Required', 'कृपया पूरा 6-अंकों का OTP दर्ज करें।');
      return;
    }

    this.otpLoading = true;
    this.auth.loginStep3VerifyOtp(this.stepToken(), otp).subscribe({
      next: (res) => {
        this.otpLoading = false;
        if (res.success && res.data?.user) {
          this.redirectAfterLogin(res.data.user);
        }
      },
      error: (err) => {
        this.otpLoading = false;
        this.toast.error('सत्यापन विफल (OTP Error)', err.error?.message || 'गलत OTP दर्ज किया गया है।');
      }
    });
  }

  backToStep(step: 'CREDENTIALS' | 'PIN') {
    this.currentStep.set(step);
    if (step === 'CREDENTIALS') {
      this.pinCode.set('');
      this.otpCode.set('');
      this.stepToken.set('');
      if (this.resendTimer) clearInterval(this.resendTimer);
    }
  }

  private startResendTimer() {
    this.resendCountdown.set(30);
    if (this.resendTimer) clearInterval(this.resendTimer);

    this.resendTimer = setInterval(() => {
      const cur = this.resendCountdown();
      if (cur <= 1) {
        clearInterval(this.resendTimer);
        this.resendCountdown.set(0);
      } else {
        this.resendCountdown.set(cur - 1);
      }
    }, 1000);
  }

  private redirectAfterLogin(user: any) {
    if (user?.role === 'SUPER_ADMIN' || user?.email === 'owner@mksbilling.com' || user?.email === 'admin@mksbilling.com') {
      this.router.navigate(['/admin/dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
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

  // =========================================================================
  // 🔑 MASTER CODE PASSWORD RESET ACTIONS
  // =========================================================================
  openMasterResetModal(identifier?: string) {
    const defaultId = identifier || this.loginForm.get('email')?.value || '';
    this.resetIdentifier.set(defaultId);
    this.resetMasterCode.set('');
    this.resetNewPassword.set('');
    this.resetConfirmPassword.set('');
    this.showMasterResetModal.set(true);
  }

  closeMasterResetModal() {
    this.showMasterResetModal.set(false);
  }

  toggleResetPasswordVisibility() {
    this.showResetPassword.set(!this.showResetPassword());
  }

  onSubmitMasterReset() {
    const identifier = this.resetIdentifier().trim();
    const masterCode = this.resetMasterCode().trim();
    const newPassword = this.resetNewPassword().trim();
    const confirmPassword = this.resetConfirmPassword().trim();

    if (!identifier) {
      this.toast.warning('आवश्यक', 'कृपया ईमेल या मोबाइल नंबर दर्ज करें।');
      return;
    }

    if (!masterCode) {
      this.toast.warning('आवश्यक', 'कृपया मास्टर कोड दर्ज करें।');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      this.toast.warning('पासवर्ड छोटा है', 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।');
      return;
    }

    if (newPassword !== confirmPassword) {
      this.toast.warning('पासवर्ड मेल नहीं खाता', 'नया पासवर्ड और कन्फर्म पासवर्ड एक समान होने चाहिए।');
      return;
    }

    this.resetLoading.set(true);
    this.auth.masterResetPassword({ identifier, masterCode, newPassword }).subscribe({
      next: (res) => {
        this.resetLoading.set(false);
        if (res.success) {
          this.toast.success('पासवर्ड बदला गया!', res.message || 'आपका पासवर्ड सफलतापूर्वक बदल दिया गया है।');
          this.isLockedOut.set(false);
          this.lockoutRemainingSecs.set(0);
          if (this.lockoutTimer) clearInterval(this.lockoutTimer);

          this.loginForm.patchValue({
            email: identifier,
            password: newPassword
          });

          this.showMasterResetModal.set(false);
        }
      },
      error: (err) => {
        this.resetLoading.set(false);
        this.toast.error('रीसेट विफल', err.error?.message || 'गलत मास्टर कोड या अमान्य विवरण।');
      }
    });
  }
}
