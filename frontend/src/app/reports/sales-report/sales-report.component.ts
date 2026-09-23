import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';

import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sales-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sales-report.component.html'
})
export class SalesReportComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  sales = signal<any[]>([]);
  summary = signal<any>({});
  loading = signal(true);

  searchQuery = '';
  filter = 'all'; // Default to 'all' so all invoices show up and are searchable!
  statusFilter = 'ALL';
  branchFilter = 'ALL'; // Default to ALL so all bills are visible across all branches!
  startDate = '';
  endDate = '';
  private searchTimeout: any;

  ngOnInit() {
    this.loadReport();
  }

  onSearchChange() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadReport();
    }, 250);
  }

  clearSearch() {
    this.searchQuery = '';
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    const params: any = { 
      filter: this.filter,
      search: this.searchQuery.trim(),
      status: this.statusFilter,
      branch: this.branchFilter,
      allBranches: this.branchFilter === 'ALL' ? 'true' : 'false'
    };

    if (this.filter === 'custom') {
      params.startDate = this.startDate;
      params.endDate = this.endDate;
    }

    this.api.get<any>('/reports/sales', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.sales.set(res.data.sales || []);
          this.summary.set(res.data.summary || {});
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  shareOnWhatsApp(sale: any) {
    const mobile = (sale.customerMobile || '').replace(/\D/g, '');
    const custName = sale.customerName || 'ग्राहक';
    const invNo = sale.invoiceNumber;
    const total = (sale.grandTotal || 0).toLocaleString('en-IN');
    const paid = (sale.amountPaid || 0).toLocaleString('en-IN');
    const due = (sale.balanceDue || 0).toLocaleString('en-IN');

    let msg = `नमस्ते ${custName} जी! 🙏\nआपकी खरीदारी का बिल विवरण:\n🧾 *इनवॉइस नं:* ${invNo}\n💰 *कुल राशि:* ₹${total}\n✅ *जमा राशि:* ₹${paid}`;
    if (sale.balanceDue > 0) {
      msg += `\n⏳ *बकाया (Due):* ₹${due}`;
    }
    msg += `\n\nधन्यवाद! 🙏`;

    const encoded = encodeURIComponent(msg);
    const url = mobile 
      ? `https://api.whatsapp.com/send?phone=91${mobile.slice(-10)}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    
    window.open(url, '_blank');
  }

  printReport() {
    window.print();
  }
}
