import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { SubscriptionService } from '../core/services/subscription.service';
import { LanguageService } from '../core/services/language.service';
import { AiAssistantService } from '../core/services/ai-assistant.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './settings.component.html'
})
export class SettingsComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  public subService = inject(SubscriptionService);
  public langService = inject(LanguageService);
  public ai = inject(AiAssistantService);

  shop = this.auth.currentShop;
  currentUser = this.auth.currentUser;
  employees = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  // 🖼️ Shop Logo Signals
  shopLogo = signal<string>('');
  
  // 📲 Mobile Number Change OTP Verification Signals
  showMobileOtpModal = signal<boolean>(false);
  otpInput = signal<string>('');
  pendingNewMobile = signal<string>('');
  maskedMobile = signal<string>('');
  otpTimer = signal<number>(60);
  verifyingOtp = signal<boolean>(false);
  private otpInterval: any = null;

  settingsForm!: FormGroup;
  shopProfileForm!: FormGroup;
  employeeForm!: FormGroup;
  showEmployeeModal = false;

  shopTypes = computed(() => {
    if (this.langService.isHindi()) {
      return [
        { label: '👟 जूते व चप्पल स्टोर', value: 'SHOES' },
        { label: '👕 कपड़े व गारमेंट्स स्टोर', value: 'GARMENTS' },
        { label: '🛒 किराना व जनरल स्टोर', value: 'KIRANA' },
        { label: '📱 मोबाइल व इलेक्ट्रॉनिक्स स्टोर', value: 'MOBILE' },
        { label: '💊 मेडिकल व फार्मेसी स्टोर', value: 'MEDICAL' },
        { label: '💄 कॉस्मेटिक्स व ब्यूटी स्टोर', value: 'COSMETICS' },
        { label: '📚 स्टेशनरी व बुक स्टोर', value: 'STATIONERY' },
        { label: '🛠️ हार्डवेयर व इलेक्ट्रिकल्स स्टोर', value: 'HARDWARE' }
      ];
    }
    return [
      { label: '👟 Shoes / Footwear Store', value: 'SHOES' },
      { label: '👕 Garments & Clothing Store', value: 'GARMENTS' },
      { label: '🛒 Kirana / Grocery Store', value: 'KIRANA' },
      { label: '📱 Mobile & Electronics Store', value: 'MOBILE' },
      { label: '💊 Medical & Pharmacy Store', value: 'MEDICAL' },
      { label: '💄 Cosmetics & Beauty Store', value: 'COSMETICS' },
      { label: '📚 Stationery & Book Store', value: 'STATIONERY' },
      { label: '🛠️ Hardware & Electricals', value: 'HARDWARE' }
    ];
  });

  states = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
    'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
    'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
    'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
  ];

  ngOnInit() {
    this.initShopProfileForm();
    this.initSettingsForm();
    this.initEmployeeForm();
    this.loadSettings();
    this.loadEmployees();
  }

  ngOnDestroy() {
    this.clearOtpTimer();
  }

  initShopProfileForm() {
    const s = this.shop();
    const u = this.currentUser();
    this.shopLogo.set(s?.logo || '');

    this.shopProfileForm = this.fb.group({
      name: [s?.name || '', [Validators.required, Validators.minLength(2)]],
      shopType: [s?.shopType || 'KIRANA', Validators.required],
      ownerName: [s?.ownerName || u?.name || '', [Validators.required, Validators.minLength(2)]],
      mobile: [s?.mobile || u?.mobile || '', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      address: [s?.address || ''],
      city: [s?.city || ''],
      state: [s?.state || ''],
      pincode: [s?.pincode || ''],
      gstin: [s?.gstin || ''],
      drugLicenseNumber: [s?.drugLicenseNumber || ''],
      pharmacistName: [s?.pharmacistName || ''],
      invoiceFooter: [s?.invoiceFooter || ''],
      upiId: [s?.upiId || ''],
      upiName: [s?.upiName || s?.ownerName || s?.name || ''],
      enableUpiQrOnInvoice: [s?.enableUpiQrOnInvoice !== false]
    });
  }

  // 🖼️ Logo Upload & Removal Handlers
  onLogoSelected(event: any) {
    const file: File = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.error('Invalid File', 'कृपया केवल इमेज फाइल (PNG, JPG, JPEG, WEBP) चुनें।');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      this.toast.warning('File Too Large', 'लोगो का साइज 3 MB से कम होना चाहिए।');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.shopLogo.set(e.target.result);
      this.toast.info('Logo Selected', 'लोगो प्रीव्यू तैयार है। "Save Shop Profile" पर क्लिक करें।');
    };
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.shopLogo.set('');
    this.toast.info('Logo Removed', 'लोगो हटा दिया गया है। "Save Shop Profile" पर क्लिक करें।');
  }

  // 💾 Save Shop Profile (Detects if mobile number changed)
  saveShopProfile() {
    if (this.shopProfileForm.invalid) {
      this.shopProfileForm.markAllAsTouched();
      this.toast.warning('Form Incomplete', 'कृपया दुकान का नाम, मालिक का नाम और 10-अंकों का मोबाइल नंबर सही भरें।');
      return;
    }

    const formValues = this.shopProfileForm.value;
    const payload = {
      ...formValues,
      logo: this.shopLogo()
    };

    this.submitting = true;
    this.api.put<any>('/settings/profile', payload).subscribe({
      next: (res) => {
        this.submitting = false;
        if (res.requiresOtp) {
          // 📲 New mobile requires OTP Verification!
          this.pendingNewMobile.set(res.pendingMobile || formValues.mobile);
          this.maskedMobile.set(res.maskedMobile || formValues.mobile);
          this.otpInput.set('');
          this.showMobileOtpModal.set(true);
          this.startOtpTimer();
          this.toast.info('📲 OTP Sent', res.message || 'नये मोबाइल नंबर पर 6-अंकों का OTP भेजा गया है।');
        } else if (res.success) {
          this.applyUpdatedShopData(res.data);
          this.toast.success('Profile Saved 🎉', res.message || 'दुकान की प्रोफाइल सफलतापूर्वक अपडेट हो गई!');
        }
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Update Failed', err.error?.message || 'प्रोफाइल अपडेट नहीं हो सकी।');
      }
    });
  }

  // 🔢 Verify Mobile OTP & Finalize Number Update
  verifyAndSaveMobileOtp() {
    const otp = this.otpInput().trim();
    if (!otp || otp.length < 6) {
      this.toast.warning('OTP Required', 'कृपया 6-अंकों का OTP दर्ज करें।');
      return;
    }

    this.verifyingOtp.set(true);
    const formValues = this.shopProfileForm.value;
    const payload = {
      ...formValues,
      logo: this.shopLogo(),
      otp
    };

    this.api.put<any>('/settings/profile', payload).subscribe({
      next: (res) => {
        this.verifyingOtp.set(false);
        if (res.success) {
          this.showMobileOtpModal.set(false);
          this.clearOtpTimer();
          this.applyUpdatedShopData(res.data);
          this.toast.success('🎉 मोबाइल नंबर अपडेट सफल!', res.message || 'दुकान का नया मोबाइल नंबर सफलतापूर्वक अपडेट हो गया है!');
        }
      },
      error: (err) => {
        this.verifyingOtp.set(false);
        this.toast.error('OTP Verification Failed', err.error?.message || 'गलत या एक्सपायर OTP! कृपया सही OTP दर्ज करें।');
      }
    });
  }

  // 🔄 Resend OTP to the new mobile number
  resendMobileOtp() {
    const newMobile = this.pendingNewMobile();
    if (!newMobile) return;

    this.api.post<any>('/settings/send-mobile-otp', { newMobile }).subscribe({
      next: (res) => {
        this.startOtpTimer();
        this.toast.success('OTP Resent 📲', res.message || 'नये मोबाइल नंबर पर दोबारा OTP भेज दिया गया है।');
      },
      error: (err) => {
        this.toast.error('Resend Failed', err.error?.message || 'OTP भेजने में समस्या आई।');
      }
    });
  }

  startOtpTimer() {
    this.clearOtpTimer();
    this.otpTimer.set(60);
    this.otpInterval = setInterval(() => {
      if (this.otpTimer() > 0) {
        this.otpTimer.update(t => t - 1);
      } else {
        this.clearOtpTimer();
      }
    }, 1000);
  }

  clearOtpTimer() {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
  }

  cancelMobileOtp() {
    this.showMobileOtpModal.set(false);
    this.clearOtpTimer();
    // Revert form mobile to original shop mobile
    this.shopProfileForm.patchValue({
      mobile: this.shop()?.mobile || this.currentUser()?.mobile || ''
    });
    this.toast.info('Cancelled', 'मोबाइल नंबर बदलाव रद्द कर दिया गया।');
  }

  private applyUpdatedShopData(data: any) {
    if (data.shop) {
      this.auth.currentShop.set(data.shop);
      localStorage.setItem('mks_shop', JSON.stringify(data.shop));
    } else if (data._id) {
      this.auth.currentShop.set(data);
      localStorage.setItem('mks_shop', JSON.stringify(data));
    }
    if (data.user) {
      this.auth.currentUser.set(data.user);
      localStorage.setItem('mks_user', JSON.stringify(data.user));
    }
  }

  initSettingsForm() {
    this.settingsForm = this.fb.group({
      invoicePrefix: ['INV', Validators.required],
      termsConditions: ['Goods once sold will not be returned.', Validators.required],
      invoiceFooter: ['Thank you for your business!', Validators.required],
      isGSTRegistered: [false],
      gstin: [''],
      gstState: [''],
      printFormat: ['A4', Validators.required],
      enableCreditLimitBlock: [true],
      defaultCreditLimit: [10000, [Validators.required, Validators.min(0)]],
      blockMessage: ['इस ग्राहक का पिछला उधार सीमा से अधिक हो गया है। कृपया पहले पुराना बकाया जमा करवाएं, फिर नया बिल बनाएं।']
    });
  }

  initEmployeeForm() {
    this.employeeForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      mobile: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  loadSettings() {
    this.loading.set(true);
    this.api.get<any>('/settings').subscribe({
      next: (res) => {
        if (res.success) {
          this.settingsForm.patchValue(res.data);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadEmployees() {
    this.api.get<any>('/employees').subscribe({
      next: (res) => {
        if (res.success) this.employees.set(res.data);
      }
    });
  }

  saveSettings() {
    if (this.settingsForm.invalid) return;
    this.submitting = true;
    this.api.put<any>('/settings', this.settingsForm.value).subscribe({
      next: () => {
        this.submitting = false;
        this.toast.success('Saved', 'Shop configurations saved successfully.');
      },
      error: () => this.submitting = false
    });
  }

  saveEmployee() {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.api.post<any>('/employees', this.employeeForm.value).subscribe({
      next: () => {
        this.submitting = false;
        this.showEmployeeModal = false;
        this.toast.success('Registered', 'Employee user created successfully.');
        this.loadEmployees();
        this.employeeForm.reset();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Failed', err.error?.message || 'Failed to register employee.');
      }
    });
  }

  toggleEmployeeStatus(emp: any) {
    this.api.put<any>(`/employees/${emp._id}/toggle`, {}).subscribe({
      next: () => {
        this.toast.success('Toggled', `Employee status changed.`);
        this.loadEmployees();
      }
    });
  }

  selectLanguage(lang: 'hi' | 'en') {
    this.langService.setLanguage(lang);
    if (lang === 'hi') {
      this.toast.success('भाषा बदली (Language Changed)', '🇮🇳 हिन्दी भाषा सक्रिय है (Hindi Active).');
    } else {
      this.toast.success('Language Switched', '🇬🇧 English language is now active.');
    }
  }

  openAiAssistant(prompt?: string) {
    this.ai.openChat(prompt);
  }

  // 🏢 Multi-Branch Management in Settings
  showAddBranchModal = signal<boolean>(false);
  savingBranch = signal<boolean>(false);
  newBranchData = {
    name: '',
    shopType: 'GARMENTS',
    branchName: '',
    branchCode: '',
    address: '',
    mobile: ''
  };

  openAddBranchModal() {
    const count = (this.auth.myShops()?.length || 0) + 1;
    const current = this.shop();
    this.newBranchData = {
      name: current?.name || 'MKS Store',
      shopType: current?.shopType || 'GARMENTS',
      branchName: `शाखा ${count} (Branch ${count})`,
      branchCode: `BR-${count}`,
      address: current?.address || '',
      mobile: current?.mobile || ''
    };
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

  switchShop(shopId: string) {
    this.auth.switchShop(shopId);
  }
}
