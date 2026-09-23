import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-shops',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './admin-shops.component.html'
})
export class AdminShopsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public auth = inject(AuthService);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  shops = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  // Search & Filter state
  searchText = '';
  selectedShopType = 'ALL';
  selectedStatus = 'ALL';
  selectedPlan = 'ALL';
  page = 1;
  totalPages = 1;
  totalShops = 0;

  // Add Shop Modal
  showAddModal = false;
  addShopForm!: FormGroup;

  // Edit Shop Modal
  showEditModal = false;
  selectedShopForEdit: any = null;
  editShopForm!: FormGroup;

  // Quick Subscription Modal
  showSubModal = false;
  selectedShopForSub: any = null;
  subForm!: FormGroup;

  shopTypes = ['KIRANA', 'GARMENTS', 'SHOES', 'MOBILE', 'MEDICAL', 'COSMETICS', 'STATIONERY', 'HARDWARE', 'RESTAURANT', 'ELECTRONICS', 'JEWELLERY', 'GENERAL'];

  ngOnInit() {
    this.initForms();
    this.loadShops();
  }

  initForms() {
    this.addShopForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      shopType: ['KIRANA', Validators.required],
      ownerName: ['', Validators.required],
      mobile: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['123456', [Validators.required, Validators.minLength(4)]],
      gstin: [''],
      address: [''],
      city: [''],
      state: ['Rajasthan'],
      plan: ['TRIAL'],
      trialDays: [3]
    });

    this.editShopForm = this.fb.group({
      name: ['', Validators.required],
      shopType: ['', Validators.required],
      ownerName: ['', Validators.required],
      mobile: [''],
      email: ['', Validators.email],
      gstin: [''],
      address: [''],
      city: [''],
      state: ['']
    });

    this.subForm = this.fb.group({
      plan: ['PRO_MONTHLY'],
      addDays: [30],
      customExpiryDate: [''],
      isLifetimeFree: [false]
    });
  }

  loadShops() {
    this.loading.set(true);
    const params: any = {
      page: this.page,
      limit: 20
    };

    if (this.searchText.trim()) params.search = this.searchText.trim();
    if (this.selectedShopType !== 'ALL') params.shopType = this.selectedShopType;
    if (this.selectedStatus !== 'ALL') params.status = this.selectedStatus;
    if (this.selectedPlan !== 'ALL') params.plan = this.selectedPlan;

    this.api.get<any>('/admin/shops', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.shops.set(res.data || []);
          this.totalPages = res.pagination?.totalPages || 1;
          this.totalShops = res.pagination?.total || 0;
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'दुकानें लोड नहीं हो सकीं।');
        this.loading.set(false);
      }
    });
  }

  onSearch() {
    this.page = 1;
    this.loadShops();
  }

  resetFilters() {
    this.searchText = '';
    this.selectedShopType = 'ALL';
    this.selectedStatus = 'ALL';
    this.selectedPlan = 'ALL';
    this.page = 1;
    this.loadShops();
  }

  // Toggle Block / Unblock Shop
  toggleShop(shop: any) {
    const action = shop.isActive ? 'Block / Deactivate' : 'Unblock / Activate';
    if (!confirm(`Are you sure you want to ${action} "${shop.name}"?`)) return;

    this.api.put<any>(`/admin/shops/${shop._id}/toggle`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('Updated', res.message);
          this.loadShops();
        }
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'Status change failed.');
      }
    });
  }

  // 🔥 1-Click Impersonate Shop
  impersonate(shopId: string) {
    this.auth.impersonateShop(shopId);
  }

  // Open Edit Modal
  openEditModal(shop: any) {
    this.selectedShopForEdit = shop;
    this.editShopForm.patchValue({
      name: shop.name || '',
      shopType: shop.shopType || 'KIRANA',
      ownerName: shop.ownerName || '',
      mobile: shop.mobile || '',
      email: shop.email || '',
      gstin: shop.gstin || '',
      address: shop.address || '',
      city: shop.city || '',
      state: shop.state || 'Rajasthan'
    });
    this.showEditModal = true;
  }

  submitEditShop() {
    if (this.editShopForm.invalid) {
      this.editShopForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.api.put<any>(`/admin/shops/${this.selectedShopForEdit._id}`, this.editShopForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showEditModal = false;
        this.toast.success('Updated', 'दुकान का विवरण सफलतापूर्वक अपडेट हो गया।');
        this.loadShops();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Error', err.error?.message || 'अपडेट नहीं हो सका।');
      }
    });
  }

  // Add New Shop
  submitAddShop() {
    if (this.addShopForm.invalid) {
      this.addShopForm.markAllAsTouched();
      this.toast.warning('अधूरा फॉर्म', 'कृपया सभी अनिवार्य फ़ील्ड्स भरें।');
      return;
    }

    this.submitting = true;
    this.api.post<any>('/admin/shops', this.addShopForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showAddModal = false;
        this.toast.success('दुकान पंजीकृत', res.message || 'नई दुकान सफलतापूर्वक जुड़ गई।');
        this.addShopForm.reset({ shopType: 'KIRANA', plan: 'TRIAL', trialDays: 3, state: 'Rajasthan', password: 'admin123' });
        this.loadShops();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('पंजीकरण असफल', err.error?.message || 'दुकान नहीं जोड़ी जा सकी।');
      }
    });
  }

  // Open Quick Subscription Modal
  openSubModal(shop: any) {
    this.selectedShopForSub = shop;
    this.subForm.patchValue({
      plan: shop.subscriptionPlan || 'PRO_MONTHLY',
      addDays: 30,
      customExpiryDate: '',
      isLifetimeFree: false
    });
    this.showSubModal = true;
  }

  submitSubUpdate() {
    this.submitting = true;
    this.api.put<any>(`/admin/shops/${this.selectedShopForSub._id}/subscription`, this.subForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showSubModal = false;
        this.toast.success('सब्सक्रिप्शन अपडेट', res.message);
        this.loadShops();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Error', err.error?.message || 'सब्सक्रिप्शन अपडेट नहीं हो सका।');
      }
    });
  }
}
