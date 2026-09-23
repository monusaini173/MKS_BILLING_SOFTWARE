import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-supplier-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, FormsModule],
  templateUrl: './supplier-detail.component.html'
})
export class SupplierDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  public lang = inject(LanguageService);

  supplierId = '';
  supplier = signal<any | null>(null);
  purchases = signal<any[]>([]);
  payments = signal<any[]>([]);
  pendingBills = signal<any[]>([]);
  lastPurchaseDate = signal<any>(null);
  loading = signal(true);

  activeTab = signal<'PURCHASES' | 'PAYMENTS' | 'PENDING' | 'PROFILE'>('PURCHASES');

  // Pay Modal
  showPaymentModal = false;
  submittingPayment = false;
  selectedPurchase: any = null;
  paymentForm!: FormGroup;

  // Due Modal
  showDueModal = false;
  submittingDue = false;
  dueForm!: FormGroup;

  // Computed stats
  totalPurchased = computed(() => this.purchases().reduce((sum, p) => sum + (Number(p.grandTotal) || 0), 0));
  totalSettled = computed(() => this.payments().reduce((sum, p) => sum + (Number(p.amount) || 0), 0));

  ngOnInit() {
    this.supplierId = this.route.snapshot.paramMap.get('id') || '';
    this.initPaymentForm();
    this.initDueForm();
    if (this.supplierId) {
      this.loadDetails();
    }
  }

  initDueForm() {
    this.dueForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      invoiceNumber: [''],
      reason: ['पिछला बकाया / Old Due Entry', Validators.required],
      date: [new Date().toISOString().substring(0, 10)]
    });
  }

  initPaymentForm() {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      method: ['CASH', Validators.required],
      transactionId: [''],
      notes: ['']
    });
  }

  loadDetails() {
    this.loading.set(true);

    this.api.get<any>(`/suppliers/${this.supplierId}/history`).subscribe({
      next: (res) => {
        if (res.success) {
          this.supplier.set(res.data.supplier);
          this.purchases.set(res.data.purchases || []);
          this.payments.set(res.data.payments || []);
          this.pendingBills.set(res.data.pendingBills || []);
          this.lastPurchaseDate.set(res.data.lastPurchaseDate);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'सप्लायर लेजर लोड नहीं हो सका।');
        this.loading.set(false);
      }
    });
  }

  openPaymentModal(purchase?: any) {
    this.selectedPurchase = purchase || null;
    this.initPaymentForm();

    const dueAmt = purchase ? purchase.balanceDue : (this.supplier()?.pendingAmount || 0);
    this.paymentForm.patchValue({
      amount: dueAmt,
      notes: purchase ? `Settlement for Invoice #${purchase.purchaseNumber}` : `Supplier ledger settlement`
    });
    this.showPaymentModal = true;
  }

  openDueModal() {
    this.initDueForm();
    this.showDueModal = true;
  }

  submitDue() {
    if (this.dueForm.invalid) {
      this.dueForm.markAllAsTouched();
      this.toast.warning('अधूरा फॉर्म', 'कृपया सही बकाया राशि दर्ज करें।');
      return;
    }

    this.submittingDue = true;
    const body = this.dueForm.value;

    this.api.post<any>(`/suppliers/${this.supplierId}/add-due`, body).subscribe({
      next: () => {
        this.submittingDue = false;
        this.showDueModal = false;
        this.toast.success('बकाया दर्ज', 'सप्लायर के खाते में नया बकाया सफलतापूर्वक जुड़ गया है।');
        this.loadDetails();
      },
      error: (err) => {
        this.submittingDue = false;
        this.toast.error('त्रुटि', err.error?.message || 'बकाया दर्ज नहीं हो सका।');
      }
    });
  }

  submitPayment() {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.toast.warning('अधूरा फॉर्म', 'कृपया सही भुगतान राशि दर्ज करें।');
      return;
    }

    this.submittingPayment = true;
    const body = {
      ...this.paymentForm.value,
      purchaseId: this.selectedPurchase ? this.selectedPurchase._id : undefined
    };

    this.api.post<any>(`/suppliers/${this.supplierId}/pay`, body).subscribe({
      next: () => {
        this.submittingPayment = false;
        this.showPaymentModal = false;
        this.toast.success('भुगतान दर्ज', 'सप्लायर का भुगतान सफलतापूर्वक दर्ज हो गया।');
        this.loadDetails();
      },
      error: (err) => {
        this.submittingPayment = false;
        this.toast.error('त्रुटि', err.error?.message || 'भुगतान दर्ज नहीं हो सका।');
      }
    });
  }

  printLedger() {
    window.print();
  }
}
