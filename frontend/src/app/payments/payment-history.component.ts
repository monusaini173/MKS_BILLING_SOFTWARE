import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';

export interface PaymentItem {
  _id: string;
  type: 'RECEIVED' | 'PAID';
  partyType: 'CUSTOMER' | 'SUPPLIER';
  partyName: string;
  payerName?: string;
  customerMobile?: string;
  customerId?: any;
  amount: number;
  method: 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'CREDIT' | 'PARTIAL';
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  referenceId?: string;
  referenceType?: string;
  referenceNumber?: string;
  transactionId?: string;
  items?: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unit?: string;
    rate?: number;
    subtotal?: number;
    total?: number;
  }>;
  subtotal?: number;
  grandTotal?: number;
  date: string;
  notes?: string;
  createdBy?: { name: string };
}

@Component({
  selector: 'app-payment-history',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './payment-history.component.html'
})
export class PaymentHistoryComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  shop = this.auth.currentShop;
  payments = signal<PaymentItem[]>([]);
  loading = signal<boolean>(true);

  // Summary State
  summary = signal({
    totalAmount: 0,
    count: 0,
    upiAmount: 0,
    cashAmount: 0,
    cardAmount: 0,
    otherAmount: 0
  });

  todaySummary = signal({
    total: 0,
    upiTotal: 0,
    cashTotal: 0,
    count: 0
  });

  // Filter & Search Controls
  filter = 'today'; // today, yesterday, week, month, year, custom, all
  startDate = '';
  endDate = '';
  searchQuery = '';
  selectedMethod = 'ALL';
  selectedType = 'RECEIVED'; // RECEIVED, PAID, ALL
  selectedStatus = 'SUCCESS';

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  pageSize = 30;

  // Modals
  selectedPaymentForModal = signal<PaymentItem | null>(null);
  showDetailModal = signal<boolean>(false);
  showDirectPaymentModal = signal<boolean>(false);

  // Direct Payment Form
  directPaymentForm!: FormGroup;
  submittingDirect = signal<boolean>(false);

  ngOnInit() {
    this.initDirectPaymentForm();
    this.loadPayments();
  }

  initDirectPaymentForm() {
    this.directPaymentForm = this.fb.group({
      partyName: ['', [Validators.required, Validators.minLength(2)]],
      payerName: [''],
      customerMobile: ['', [Validators.pattern(/^[6-9]\d{9}$/)]],
      amount: [null, [Validators.required, Validators.min(1)]],
      method: ['UPI', Validators.required],
      transactionId: [''],
      productName: [''],
      notes: ['']
    });
  }

  loadPayments(page = 1) {
    this.loading.set(true);
    this.currentPage = page;

    const params: any = {
      page: this.currentPage,
      limit: this.pageSize,
      filter: this.filter,
      type: this.selectedType,
      status: this.selectedStatus,
      method: this.selectedMethod
    };

    if (this.searchQuery.trim()) {
      params.search = this.searchQuery.trim();
    }

    if (this.filter === 'custom' && this.startDate && this.endDate) {
      params.startDate = this.startDate;
      params.endDate = this.endDate;
    }

    this.api.get<any>('/payments', params).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.payments.set(res.data || []);
          if (res.summary) this.summary.set(res.summary);
          if (res.todaySummary) this.todaySummary.set(res.todaySummary);
          if (res.pagination) {
            this.totalPages = res.pagination.pages || 1;
            this.totalRecords = res.pagination.total || 0;
          }
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('Error', err.error?.message || 'भुगतान इतिहास लोड नहीं हो सका।');
      }
    });
  }

  onFilterChange() {
    this.currentPage = 1;
    this.loadPayments(1);
  }

  onSearchChange() {
    this.currentPage = 1;
    this.loadPayments(1);
  }

  clearFilters() {
    this.filter = 'today';
    this.startDate = '';
    this.endDate = '';
    this.searchQuery = '';
    this.selectedMethod = 'ALL';
    this.selectedType = 'RECEIVED';
    this.selectedStatus = 'SUCCESS';
    this.loadPayments(1);
  }

  viewPaymentDetails(pay: PaymentItem) {
    this.selectedPaymentForModal.set(pay);
    this.showDetailModal.set(true);
  }

  openDirectPaymentModal() {
    this.directPaymentForm.reset({
      partyName: '',
      payerName: '',
      customerMobile: '',
      amount: null,
      method: 'UPI',
      transactionId: '',
      productName: '',
      notes: ''
    });
    this.showDirectPaymentModal.set(true);
  }

  saveDirectPayment() {
    if (this.directPaymentForm.invalid) {
      this.directPaymentForm.markAllAsTouched();
      return;
    }

    this.submittingDirect.set(true);
    const formVal = this.directPaymentForm.value;

    const items = formVal.productName ? [{
      productName: formVal.productName,
      quantity: 1,
      rate: formVal.amount,
      total: formVal.amount
    }] : [];

    const payload = {
      type: 'RECEIVED',
      partyType: 'CUSTOMER',
      partyName: formVal.partyName,
      payerName: formVal.payerName || formVal.partyName,
      customerMobile: formVal.customerMobile,
      amount: formVal.amount,
      method: formVal.method,
      transactionId: formVal.transactionId || 'DIRECT_UPI_' + Date.now().toString().slice(-6),
      items,
      notes: formVal.notes
    };

    this.api.post<any>('/payments', payload).subscribe({
      next: (res) => {
        this.submittingDirect.set(false);
        if (res.success) {
          this.toast.success('Payment Logged', 'नया सफल भुगतान रिकॉर्ड जोड़ दिया गया है!');
          this.showDirectPaymentModal.set(false);
          this.loadPayments(1);
        }
      },
      error: (err) => {
        this.submittingDirect.set(false);
        this.toast.error('Failed', err.error?.message || 'भुगतान रिकॉर्ड नहीं हो सका।');
      }
    });
  }

  shareWhatsAppReceipt(pay: PaymentItem, event?: Event) {
    if (event) event.stopPropagation();

    const shopName = this.shop()?.name || 'MKS Store';
    const mobile = pay.customerMobile ? pay.customerMobile.replace(/\D/g, '') : '';
    const dateFormatted = new Date(pay.date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    let itemsText = '';
    if (pay.items && pay.items.length > 0) {
      itemsText = pay.items.map(it => `• ${it.productName} (x${it.quantity}) - ₹${it.total || (it.rate ? it.rate * it.quantity : 0)}`).join('\n');
    } else {
      itemsText = '• General Bill Payment / Balance Settle';
    }

    const message = `✅ *भुगतान प्राप्त रसीद (Payment Receipt)*\n*${shopName}*\n\n` +
      `👤 *ग्राहक / पेयर:* ${pay.payerName || pay.partyName || 'Customer'}\n` +
      `📅 *दिनांक व समय:* ${dateFormatted}\n` +
      `🧾 *बिल / इनवॉइस नं:* ${pay.referenceNumber || 'N/A'}\n` +
      `💳 *भुगतान माध्यम:* ${pay.method} (Success)\n` +
      `🆔 *ट्रांजेक्शन ID:* ${pay.transactionId || 'N/A'}\n\n` +
      `📦 *खरीदे गए प्रोडक्ट्स:* \n${itemsText}\n\n` +
      `💰 *कुल प्राप्त राशि: ₹${pay.amount.toFixed(2)}*\n\n` +
      `🙏 हमारे साथ व्यापार करने के लिए धन्यवाद!`;

    const encoded = encodeURIComponent(message);
    const targetUrl = mobile && mobile.length === 10 ? 
      `https://wa.me/91${mobile}?text=${encoded}` : 
      `https://wa.me/?text=${encoded}`;

    window.open(targetUrl, '_blank');
  }

  printHistory() {
    window.print();
  }

  getProductNamesSummary(pay: PaymentItem): string {
    if (!pay.items || pay.items.length === 0) {
      return 'Bill Payment (No items attached)';
    }
    return pay.items.map(i => `${i.productName} (x${i.quantity})`).join(', ');
  }
}
