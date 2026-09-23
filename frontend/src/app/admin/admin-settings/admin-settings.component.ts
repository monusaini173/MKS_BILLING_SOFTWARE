import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { FaceAuthService } from '../../core/services/face-auth.service';
import { AdminSecurityService } from '../../core/services/admin-security.service';
import { FaceLockModalComponent } from '../../shared/components/face-lock-modal/face-lock-modal.component';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FaceLockModalComponent],
  templateUrl: './admin-settings.component.html'
})
export class AdminSettingsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public lang = inject(LanguageService);
  public faceService = inject(FaceAuthService);
  public adminSecurity = inject(AdminSecurityService);
  private toast = inject(ToastService);

  loading = signal(true);
  submitting = false;
  showFaceEnrollModal = signal(false);
  showFaceTestModal = signal(false);
  settingsForm!: FormGroup;

  // Master Security PIN Form State
  newMasterPin = '';
  confirmMasterPin = '';
  currentAdminPassword = '';
  isPinUpdating = signal<boolean>(false);
  generatedRecoveryKey = signal<string | null>(null);
  adminSecurityStatus = signal<any>(null);

  ngOnInit() {
    this.initForm();
    this.loadSettings();
    this.loadSecurityStatus();
  }

  loadSecurityStatus() {
    this.adminSecurity.getSecurityStatus().subscribe({
      next: (res) => {
        if (res.success) {
          this.adminSecurityStatus.set(res.data);
        }
      }
    });
  }

  updateMasterPin() {
    if (!/^\d{6}$/.test(this.newMasterPin.trim())) {
      this.toast.warning('Invalid PIN', 'मास्टर सिक्योरिटी पिन 6 अंकों का संख्यात्मक नंबर होना चाहिए।');
      return;
    }
    if (this.newMasterPin !== this.confirmMasterPin) {
      this.toast.error('Mismatch', 'नया पिन और कन्फर्म पिन मेल नहीं खाते।');
      return;
    }

    this.isPinUpdating.set(true);
    this.adminSecurity.setMasterPin(this.newMasterPin.trim(), this.currentAdminPassword).subscribe({
      next: (res) => {
        this.isPinUpdating.set(false);
        if (res.success) {
          this.toast.success('पिन अपडेट सफल', 'नया 6-डिजिट मास्टर सिक्योरिटी पिन सक्रिय हो गया है!');
          this.generatedRecoveryKey.set(res.data?.recoveryKey || null);
          this.newMasterPin = '';
          this.confirmMasterPin = '';
          this.currentAdminPassword = '';
          this.loadSecurityStatus();
        }
      },
      error: (err) => {
        this.isPinUpdating.set(false);
        this.toast.error('Error', err.error?.message || 'मास्टर पिन अपडेट नहीं हो सका।');
      }
    });
  }

  copyRecoveryKey() {
    const key = this.generatedRecoveryKey();
    if (!key) return;
    navigator.clipboard.writeText(key).then(() => {
      this.toast.success('Copied!', 'इमरजेंसी रिकवरी कोड क्लिपबोर्ड पर कॉपी हो गया!');
    });
  }

  initForm() {
    this.settingsForm = this.fb.group({
      appName: ['MKS Billing Software', Validators.required],
      tagline: ['All-in-One Multi-Tenant POS & GST Invoicing System'],
      supportPhone: ['9876543210'],
      supportEmail: ['owner@mksbilling.com'],
      supportWhatsApp: ['9876543210'],
      defaultTrialDays: [3, [Validators.required, Validators.min(1)]],
      
      // Payment Gateway
      razorpayKeyId: ['rzp_test_TR7vSW6DHXNObT'],
      razorpayKeySecret: ['PxMC7eeUtgsD4MviXTuGAoic'],
      upiQrVpa: ['mksbilling@upi'],

      // WhatsApp Gateway
      whatsAppProvider: ['DIRECT_WEB'],
      whatsAppApiKey: [''],
      whatsAppPhoneNumberId: [''],
      enableSmsNotifications: [false],

      // Invoice & GST Platform Defaults
      defaultInvoicePrefix: ['INV'],
      defaultGSTRate: [18],
      enableGstBilling: [true],
      enableDailyBackup: [true],
      termsAndConditions: ['धन्यवाद! फिर पधारें (Thank you for shopping with us!)']
    });
  }

  loadSettings() {
    this.loading.set(true);
    this.api.get<any>('/admin/system-settings').subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.settingsForm.patchValue(res.data);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'सिस्टम सेटिंग्स लोड नहीं हो सकीं।');
        this.loading.set(false);
      }
    });
  }

  onSubmit() {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.api.put<any>('/admin/system-settings', this.settingsForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.toast.success('सफल', 'सिस्टम सेटिंग्स सफलतापूर्वक अपडेट हो गईं।');
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Error', err.error?.message || 'सेटिंग्स अपडेट नहीं हो सकीं।');
      }
    });
  }

  toggleFaceLockSwitch(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked && !this.faceService.faceStatus().hasFaceRegistered) {
      // Must register face first
      (event.target as HTMLInputElement).checked = false;
      this.showFaceEnrollModal.set(true);
      return;
    }

    this.faceService.toggleFaceLock(isChecked).subscribe({
      next: () => {
        this.toast.success('Face Lock', `Face Lock is now ${isChecked ? 'Enabled' : 'Disabled'}.`);
      },
      error: (err) => {
        (event.target as HTMLInputElement).checked = !isChecked;
        this.toast.error('Error', err.error?.message || 'Failed to toggle face lock.');
      }
    });
  }

  onFaceEnrolled(data: any) {
    this.showFaceEnrollModal.set(false);
    this.faceService.refreshFaceStatus();
    this.toast.success('Face Enrolled', 'Face Lock biometrics successfully saved.');
  }

  onFacePhotoUploaded(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const capture = this.faceService.extractBiometricDescriptor(img);
        if (!capture || !capture.hasFace || !capture.descriptor || capture.descriptor.length < 10) {
          this.toast.error('Face Error', capture?.error || 'No clear face detected in this photo. Please upload a clear passport/front photo.');
          return;
        }

        this.faceService.registerFace(capture.descriptor, capture.thumbnail, true).subscribe({
          next: () => {
            this.faceService.refreshFaceStatus();
            this.faceService.playSuccessChime();
            this.toast.success('Face Registered', 'Your master face photo has been registered successfully! Only this person can unlock now.');
          },
          error: (err) => {
            this.toast.error('Registration Failed', err.error?.message || 'Could not register face photo.');
          }
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  onFaceTested(data: any) {
    this.showFaceTestModal.set(false);
    this.toast.success('Face Verified', 'Face ID match test was 100% successful!');
  }
}
