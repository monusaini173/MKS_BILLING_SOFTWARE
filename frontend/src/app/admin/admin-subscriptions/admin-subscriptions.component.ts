import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-subscriptions.component.html'
})
export class AdminSubscriptionsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  subscriptions = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  searchText = '';
  selectedPlan = 'ALL';
  selectedStatus = 'ALL';
  page = 1;
  totalPages = 1;
  totalRecords = 0;

  showModal = false;
  selectedShop: any = null;
  subForm!: FormGroup;

  ngOnInit() {
    this.initForm();
    this.loadSubscriptions();
  }

  initForm() {
    this.subForm = this.fb.group({
      plan: ['PRO_MONTHLY', Validators.required],
      addDays: [30],
      customExpiryDate: [''],
      planAmount: [500],
      isLifetimeFree: [false]
    });
  }

  loadSubscriptions() {
    this.loading.set(true);
    const params: any = {
      page: this.page,
      limit: 25
    };

    if (this.searchText.trim()) params.search = this.searchText.trim();
    if (this.selectedPlan !== 'ALL') params.plan = this.selectedPlan;
    if (this.selectedStatus !== 'ALL') params.status = this.selectedStatus;

    this.api.get<any>('/admin/subscriptions', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.subscriptions.set(res.data || []);
          this.totalPages = res.pagination?.totalPages || 1;
          this.totalRecords = res.pagination?.total || 0;
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'सब्सक्रिप्शन लोड नहीं हो सके।');
        this.loading.set(false);
      }
    });
  }

  onFilter() {
    this.page = 1;
    this.loadSubscriptions();
  }

  openSubModal(shop: any) {
    this.selectedShop = shop;
    this.subForm.patchValue({
      plan: shop.subscriptionPlan || 'PRO_MONTHLY',
      addDays: 30,
      customExpiryDate: '',
      planAmount: shop.planAmount || 500,
      isLifetimeFree: false
    });
    this.showModal = true;
  }

  quickAddDays(days: number) {
    this.subForm.patchValue({ addDays: days });
  }

  onSubmit() {
    this.submitting = true;
    this.api.put<any>(`/admin/shops/${this.selectedShop._id}/subscription`, this.subForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showModal = false;
        this.toast.success('सफल', res.message || 'सब्सक्रिप्शन अपडेट हो गया।');
        this.loadSubscriptions();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Error', err.error?.message || 'सब्सक्रिप्शन अपडेट नहीं हो सका।');
      }
    });
  }
}
