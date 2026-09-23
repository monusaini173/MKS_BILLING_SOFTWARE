import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';
import { LanguageService } from '../core/services/language.service';

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './suppliers.component.html'
})
export class SuppliersComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  public lang = inject(LanguageService);

  suppliers = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  // Search & Filter
  searchQuery = signal('');
  typeFilter = signal('ALL');

  // Supplier Types & Terms options
  supplierTypes = ['Wholesaler', 'Distributor', 'Manufacturer', 'Dealer', 'Direct Vendor', 'Importer', 'Other'];
  paymentTermsList = ['Immediate (तुरंत)', 'Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Advance Payment', 'Weekly Settlement'];

  // Modal State
  showModal = false;
  editMode = false;
  activeModalTab: 'BASIC' | 'BUSINESS' | 'ACCOUNT' = 'BASIC';
  selectedSupplier: any = null;
  supplierForm!: FormGroup;

  // Quick Pay Modal State
  showPaymentModal = false;
  paymentForm!: FormGroup;

  // Add Due Modal State
  showDueModal = false;
  dueForm!: FormGroup;

  // Computed KPIs
  totalSuppliersCount = computed(() => this.suppliers().length);
  totalPurchasesAmount = computed(() => this.suppliers().reduce((sum, s) => sum + (Number(s.totalPurchases) || 0), 0));
  totalPaidAmount = computed(() => this.suppliers().reduce((sum, s) => sum + (Number(s.totalPaid) || 0), 0));
  totalPendingAmount = computed(() => this.suppliers().reduce((sum, s) => sum + (Number(s.pendingAmount) || 0), 0));

  filteredSuppliers = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const type = this.typeFilter();

    return this.suppliers().filter(s => {
      const matchType = type === 'ALL' || s.supplierType === type;
      const matchQuery = !q || 
        s.name?.toLowerCase().includes(q) || 
        s.companyName?.toLowerCase().includes(q) || 
        s.mobile?.includes(q) || 
        s.gstin?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  });

  ngOnInit() {
    this.loadSuppliers();
    this.initForm();
    this.initPaymentForm();
    this.initDueForm();
  }

  initDueForm() {
    this.dueForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      invoiceNumber: [''],
      reason: ['पिछला बकाया / Old Due Adjustment', Validators.required],
      date: [new Date().toISOString().substring(0, 10)]
    });
  }

  initForm() {
    this.supplierForm = this.fb.group({
      // 1. Basic Details
      name: ['', [Validators.required, Validators.minLength(2)]],
      companyName: [''],
      mobile: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      altMobile: [''],
      email: ['', [Validators.email]],
      address: [''],
      city: [''],
      state: ['Rajasthan'],
      pincode: [''],

      // 2. Business & Medical Details
      gstin: [''],
      pan: [''],
      drugLicenseNumber: [''],
      dlExpiryDate: [''],
      fssaiNumber: [''],
      contactPerson: [''],
      supplierType: ['Distributor'],
      category: [''],
      paymentTerms: ['Net 30 Days'],

      // 3. Account & Bank Details
      bankName: [''],
      accountNumber: [''],
      ifscCode: [''],
      openingBalance: [0],
      creditLimit: [0],
      notes: ['']
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

  loadSuppliers() {
    this.loading.set(true);
    this.api.get<any>('/suppliers').subscribe({
      next: (res) => {
        if (res.success) this.suppliers.set(res.data || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'सप्लायर्स लोड नहीं हो सके।');
        this.loading.set(false);
      }
    });
  }

  openAddModal() {
    this.editMode = false;
    this.selectedSupplier = null;
    this.activeModalTab = 'BASIC';
    this.initForm();
    this.showModal = true;
  }

  openEditModal(supp: any) {
    this.editMode = true;
    this.selectedSupplier = supp;
    this.activeModalTab = 'BASIC';
    this.initForm();
    this.supplierForm.patchValue({
      name: supp.name || '',
      companyName: supp.companyName || '',
      mobile: supp.mobile || '',
      altMobile: supp.altMobile || '',
      email: supp.email || '',
      address: supp.address || '',
      city: supp.city || '',
      state: supp.state || 'Rajasthan',
      pincode: supp.pincode || '',
      gstin: supp.gstin || '',
      pan: supp.pan || '',
      supplierType: supp.supplierType || 'Wholesaler',
      category: supp.category || '',
      paymentTerms: supp.paymentTerms || 'Net 30 Days',
      openingBalance: supp.openingBalance || 0,
      creditLimit: supp.creditLimit || 0,
      notes: supp.notes || ''
    });
    this.showModal = true;
  }

  openPaymentModal(supp: any) {
    this.selectedSupplier = supp;
    this.initPaymentForm();
    this.paymentForm.patchValue({ 
      amount: supp.pendingAmount || 0,
      notes: `Settlement to ${supp.companyName || supp.name}`
    });
    this.showPaymentModal = true;
  }

  openDueModal(supp: any) {
    this.selectedSupplier = supp;
    this.initDueForm();
    this.showDueModal = true;
  }

  submitDue() {
    if (this.dueForm.invalid) {
      this.dueForm.markAllAsTouched();
      this.toast.warning('अधूरा फॉर्म', 'कृपया सही बकाया राशि दर्ज करें।');
      return;
    }

    this.submitting = true;
    const body = this.dueForm.value;

    this.api.post<any>(`/suppliers/${this.selectedSupplier._id}/add-due`, body).subscribe({
      next: () => {
        this.submitting = false;
        this.showDueModal = false;
        this.toast.success('बकाया दर्ज', 'सप्लायर के खाते में नया बकाया सफलतापूर्वक जुड़ गया है।');
        this.loadSuppliers();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('त्रुटि', err.error?.message || 'बकाया दर्ज नहीं हो सका।');
      }
    });
  }

  onSubmit() {
    if (this.supplierForm.invalid) {
      this.supplierForm.markAllAsTouched();
      this.activeModalTab = 'BASIC';
      this.toast.warning('अधूरा फॉर्म', 'कृपया सप्लायर का नाम और 10-अंकों का मोबाइल नंबर सही भरें।');
      return;
    }

    this.submitting = true;
    const formVal = this.supplierForm.value;
    const body = {
      ...formVal,
      companyName: formVal.companyName?.trim() || formVal.name?.trim(),
      mobile: formVal.mobile?.trim() || '',
      altMobile: formVal.altMobile?.trim() || '',
      gstin: formVal.gstin?.trim()?.toUpperCase() || '',
      pan: formVal.pan?.trim()?.toUpperCase() || '',
      email: formVal.email?.trim() || ''
    };

    if (this.editMode) {
      this.api.put<any>(`/suppliers/${this.selectedSupplier._id}`, body).subscribe({
        next: () => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('सफल', 'सप्लायर विवरण सफलतापूर्वक अपडेट हो गया है।');
          this.loadSuppliers();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('त्रुटि', err.error?.message || 'सप्लायर अपडेट करने में समस्या हुई।');
        }
      });
    } else {
      this.api.post<any>('/suppliers', body).subscribe({
        next: () => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('सफल', 'नया सप्लायर रजिस्ट्री में सफलतापूर्वक जुड़ गया है।');
          this.loadSuppliers();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('त्रुटि', err.error?.message || 'सप्लायर जोड़ने में समस्या हुई।');
        }
      });
    }
  }

  submitPayment() {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.toast.warning('अधूरा फॉर्म', 'कृपया सही भुगतान राशि दर्ज करें।');
      return;
    }

    this.submitting = true;
    const body = this.paymentForm.value;

    this.api.post<any>(`/suppliers/${this.selectedSupplier._id}/pay`, body).subscribe({
      next: () => {
        this.submitting = false;
        this.showPaymentModal = false;
        this.toast.success('भुगतान दर्ज', 'सप्लायर का बकाया भुगतान सफलतापूर्वक दर्ज हो गया।');
        this.loadSuppliers();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('त्रुटि', err.error?.message || 'भुगतान दर्ज नहीं हो सका।');
      }
    });
  }

  deleteSupplier(id: string) {
    if (confirm('क्या आप इस सप्लायर को हटाना चाहते हैं?')) {
      this.api.delete<any>(`/suppliers/${id}`).subscribe({
        next: () => {
          this.toast.success('हटाया गया', 'सप्लायर सफलतापूर्वक हटा दिया गया।');
          this.loadSuppliers();
        },
        error: (err) => {
          this.toast.error('त्रुटि', err.error?.message || 'सप्लायर हटाया नहीं जा सका।');
        }
      });
    }
  }
}

