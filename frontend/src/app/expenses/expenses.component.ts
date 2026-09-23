import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';
import { AuthService } from '../core/services/auth.service';

export interface ExpenseCategory {
  value: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  bg: string;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './expenses.component.html'
})
export class ExpensesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  expenses = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  // Filter & Search states
  activeFilter = signal<string>('today');
  selectedCategory = signal<string>('ALL');
  searchQuery = signal<string>('');
  startDate = signal<string>('');
  endDate = signal<string>('');

  // Summary statistics
  summary = signal<{
    todayTotal: number;
    todayCount: number;
    yesterdayTotal: number;
    yesterdayCount: number;
    monthTotal: number;
    monthCount: number;
    filteredTotal: number;
    filteredCount: number;
    byCategory: any[];
  }>({
    todayTotal: 0,
    todayCount: 0,
    yesterdayTotal: 0,
    yesterdayCount: 0,
    monthTotal: 0,
    monthCount: 0,
    filteredTotal: 0,
    filteredCount: 0,
    byCategory: []
  });

  showModal = false;
  isEditing = false;
  editingId: string | null = null;
  expenseForm!: FormGroup;

  categories: ExpenseCategory[] = [
    { value: 'TEA_SNACKS', label: 'चाय, नाश्ता व पानी', sub: 'Tea, Snacks & Refreshment', icon: 'fa-mug-hot', color: '#D97706', bg: '#FEF3C7' },
    { value: 'STAFF_WAGES', label: 'स्टाफ वेतन / मजदूरी / दिहाड़ी', sub: 'Staff Wages & Daily Labour', icon: 'fa-users', color: '#2563EB', bg: '#DBEAFE' },
    { value: 'TRANSPORT', label: 'टेम्पो / ऑटो / भाड़ा / डिलीवरी', sub: 'Transport, Freight & Delivery', icon: 'fa-truck', color: '#7C3AED', bg: '#EDE9FE' },
    { value: 'SHOP_MAINTENANCE', label: 'दुकान मरम्मत व सफाई', sub: 'Shop Maintenance & Cleaning', icon: 'fa-broom', color: '#059669', bg: '#D1FAE5' },
    { value: 'ELECTRICITY', label: 'बिजली बिल व जनरेटर डीजल', sub: 'Electricity & Generator Fuel', icon: 'fa-bolt', color: '#DC2626', bg: '#FEE2E2' },
    { value: 'PACKING_MATERIAL', label: 'पैकिंग थैली, बिल बुक व स्टेशनरी', sub: 'Bags, Bill Book & Stationery', icon: 'fa-box-open', color: '#EA580C', bg: '#FFEDD5' },
    { value: 'RENT', label: 'दुकान का किराया', sub: 'Shop / Godown Rent', icon: 'fa-building', color: '#0891B2', bg: '#CFFAFE' },
    { value: 'INTERNET_PHONE', label: 'इंटरनेट व फोन रिचार्ज', sub: 'Internet, Wifi & Mobile', icon: 'fa-wifi', color: '#4F46E5', bg: '#EEF2FF' },
    { value: 'OWNER_DRAWING', label: 'मालिक का निजी खर्च (ड्राइंग)', sub: 'Owner Personal Drawing', icon: 'fa-user-tie', color: '#6B7280', bg: '#F3F4F6' },
    { value: 'OTHER', label: 'अन्य विविध खर्च', sub: 'Other Miscellaneous Expenses', icon: 'fa-wallet', color: '#475569', bg: '#E2E8F0' }
  ];

  quickPresets = [
    { label: '☕ ₹50 चाय-नाश्ता', amount: 50, category: 'TEA_SNACKS', desc: 'दुकान चाय-नाश्ता' },
    { label: '☕ ₹100 चाय-नाश्ता', amount: 100, category: 'TEA_SNACKS', desc: 'ग्राहक व स्टाफ चाय-नाश्ता' },
    { label: '🛺 ₹100 टेम्पो भाड़ा', amount: 100, category: 'TRANSPORT', desc: 'माल ढुलाई व टेम्पो भाड़ा' },
    { label: '🧹 ₹150 दुकान सफाई', amount: 150, category: 'SHOP_MAINTENANCE', desc: 'दुकान झाड़ू व सफाई' },
    { label: '📦 ₹200 पैकिंग थैली', amount: 200, category: 'PACKING_MATERIAL', desc: 'सामान पैकिंग व थैली' },
    { label: '👷 ₹500 दिहाड़ी', amount: 500, category: 'STAFF_WAGES', desc: 'दैनिक मजदूर दिहाड़ी' }
  ];

  quickAmounts = [10, 20, 50, 100, 200, 500, 1000, 2000];

  ngOnInit() {
    this.initForm();
    
    // Check if routed with query parameters (e.g. ?filter=today or ?filter=month)
    this.route.queryParams.subscribe(params => {
      if (params['filter']) {
        this.activeFilter.set(params['filter']);
      }
      this.loadExpenses();
    });
  }

  getNowDateTimeLocal(): string {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
  }

  initForm(data?: any) {
    this.expenseForm = this.fb.group({
      category: [data?.category || 'TEA_SNACKS', Validators.required],
      amount: [data?.amount !== undefined ? data.amount : '', [Validators.required, Validators.min(1)]],
      description: [data?.description || ''],
      paidTo: [data?.paidTo || ''],
      date: [data?.date ? new Date(data.date).toISOString().slice(0, 16) : this.getNowDateTimeLocal(), Validators.required],
      paymentMethod: [data?.paymentMethod || 'CASH', Validators.required],
      reference: [data?.reference || '']
    });
  }

  setFilter(filter: string) {
    this.activeFilter.set(filter);
    this.loadExpenses();
  }

  onCategoryChange(cat: string) {
    this.selectedCategory.set(cat);
    this.loadExpenses();
  }

  onSearchChange(val: string) {
    this.searchQuery.set(val);
    this.loadExpenses();
  }

  loadExpenses() {
    this.loading.set(true);
    const params: any = {
      filter: this.activeFilter(),
      category: this.selectedCategory(),
      search: this.searchQuery()
    };

    if (this.activeFilter() === 'custom') {
      if (this.startDate()) params.startDate = this.startDate();
      if (this.endDate()) params.endDate = this.endDate();
    }

    this.api.get<any>('/expenses', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.expenses.set(res.data || []);
          if (res.summary) {
            this.summary.set(res.summary);
          }
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
      }
    });
  }

  openAddModal(preset?: any) {
    this.isEditing = false;
    this.editingId = null;
    this.initForm(preset ? {
      category: preset.category,
      amount: preset.amount,
      description: preset.desc,
      paymentMethod: 'CASH'
    } : null);
    this.showModal = true;
  }

  openEditModal(exp: any) {
    this.isEditing = true;
    this.editingId = exp._id;
    this.initForm(exp);
    this.showModal = true;
  }

  addAmount(extra: number) {
    const current = Number(this.expenseForm.get('amount')?.value || 0);
    this.expenseForm.patchValue({ amount: current + extra });
  }

  setAmount(amount: number) {
    this.expenseForm.patchValue({ amount });
  }

  onSubmit() {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      this.toast.error('Required', 'कृपया खर्च की सही रकम (Amount) दर्ज करें।');
      return;
    }

    this.submitting = true;
    const formVal = { ...this.expenseForm.value };

    // If description is empty, auto fill with category label
    if (!formVal.description || !formVal.description.trim()) {
      const catInfo = this.getCategoryInfo(formVal.category);
      formVal.description = catInfo.label || 'दुकान खर्च';
    }

    if (this.isEditing && this.editingId) {
      this.api.put<any>(`/expenses/${this.editingId}`, formVal).subscribe({
        next: (res) => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('Updated', res.message || 'खर्च अपडेट हो गया (Expense updated)');
          this.loadExpenses();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('Error', err.error?.message || 'खर्च अपडेट नहीं हो सका।');
        }
      });
    } else {
      this.api.post<any>('/expenses', formVal).subscribe({
        next: (res) => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('Recorded', res.message || 'दुकान खर्च दर्ज हो गया (Expense saved)');
          this.loadExpenses();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('Error', err.error?.message || 'खर्च सेव नहीं हो सका। कृपया दोबारा कोशिश करें।');
        }
      });
    }
  }


  deleteExpense(id: string) {
    if (confirm('क्या आप इस खर्च के रिकॉर्ड को डिलीट करना चाहते हैं? (Delete this expense?)')) {
      this.api.delete<any>(`/expenses/${id}`).subscribe({
        next: (res) => {
          this.toast.success('Deleted', res.message || 'Expense record deleted.');
          this.loadExpenses();
        }
      });
    }
  }

  getCategoryInfo(catValue: string): ExpenseCategory {
    const found = this.categories.find(c => c.value === catValue);
    if (found) return found;
    // Map older categories
    if (catValue === 'SALARY') return this.categories.find(c => c.value === 'STAFF_WAGES')!;
    if (catValue === 'MAINTENANCE') return this.categories.find(c => c.value === 'SHOP_MAINTENANCE')!;
    if (catValue === 'INTERNET') return this.categories.find(c => c.value === 'INTERNET_PHONE')!;
    return {
      value: catValue,
      label: catValue,
      sub: 'General Expense',
      icon: 'fa-wallet',
      color: '#475569',
      bg: '#E2E8F0'
    };
  }

  printDailySheet() {
    window.print();
  }
}

