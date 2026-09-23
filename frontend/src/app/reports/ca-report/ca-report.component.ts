import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-ca-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ca-report.component.html',
  styleUrls: ['./ca-report.component.css']
})
export class CaReportComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  public lang = inject(LanguageService);

  shop = this.auth.currentShop;
  liveDate = new Date();
  Math = Math;

  // Selected Month & Year
  months = [
    { value: 1, name: 'January (जनवरी)' },
    { value: 2, name: 'February (फरवरी)' },
    { value: 3, name: 'March (मार्च)' },
    { value: 4, name: 'April (अप्रैल)' },
    { value: 5, name: 'May (मई)' },
    { value: 6, name: 'June (जून)' },
    { value: 7, name: 'July (जुलाई)' },
    { value: 8, name: 'August (अगस्त)' },
    { value: 9, name: 'September (सितंबर)' },
    { value: 10, name: 'October (अक्टूबर)' },
    { value: 11, name: 'November (नवंबर)' },
    { value: 12, name: 'December (दिसंबर)' }
  ];

  years = [2024, 2025, 2026, 2027];

  selectedMonth = new Date().getMonth() + 1;
  selectedYear = new Date().getFullYear();
  filterMode: 'MONTHLY' | 'CUSTOM' = 'MONTHLY';
  startDate = '';
  endDate = '';

  // Active Tab: SALES | PURCHASES | RECONCILIATION
  activeTab = signal<'SALES' | 'PURCHASES' | 'RECONCILIATION'>('SALES');

  // Filters inside tabs
  salesFilter = signal<'ALL' | 'B2B' | 'B2C'>('ALL');
  purchaseFilter = signal<'ALL' | 'GST' | 'NON_GST'>('ALL');

  // Data Signals
  loading = signal<boolean>(false);
  reportData = signal<any>(null);

  // Print Mode State (FULL_BILLS = Each actual invoice printed back-to-back, SUMMARY_TABLE = Register summary table)
  printSection = signal<'SALES' | 'PURCHASES' | 'ALL'>('ALL');
  printFormatMode = signal<'FULL_BILLS' | 'SUMMARY_TABLE'>('FULL_BILLS');

  // CA Contact Information (Persisted)
  caName = signal<string>('');
  caMobile = signal<string>('');
  caEmail = signal<string>('');
  showCaModal = signal<boolean>(false);

  // Filtered Sales Computed
  filteredSales = computed(() => {
    const data = this.reportData();
    if (!data || !data.sales) return [];
    const filter = this.salesFilter();
    if (filter === 'B2B') return data.sales.filter((s: any) => s.isB2B);
    if (filter === 'B2C') return data.sales.filter((s: any) => !s.isB2B);
    return data.sales;
  });

  // Filtered Purchases Computed
  filteredPurchases = computed(() => {
    const data = this.reportData();
    if (!data || !data.purchases) return [];
    const filter = this.purchaseFilter();
    if (filter === 'GST') return data.purchases.filter((p: any) => !!(p.supplierGstin && p.supplierGstin.trim().length >= 10));
    if (filter === 'NON_GST') return data.purchases.filter((p: any) => !(p.supplierGstin && p.supplierGstin.trim().length >= 10));
    return data.purchases;
  });

  ngOnInit() {
    this.loadCADetails();
    this.initDefaultDates();
    this.loadReport();
  }

  initDefaultDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.startDate = firstDay.toISOString().split('T')[0];
    this.endDate = lastDay.toISOString().split('T')[0];
  }

  loadCADetails() {
    try {
      const saved = localStorage.getItem('mks_ca_details');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.caName.set(parsed.caName || '');
        this.caMobile.set(parsed.caMobile || '');
        this.caEmail.set(parsed.caEmail || '');
      }
    } catch (e) {
      // ignore
    }
  }

  saveCADetails() {
    const details = {
      caName: this.caName(),
      caMobile: this.caMobile(),
      caEmail: this.caEmail()
    };
    localStorage.setItem('mks_ca_details', JSON.stringify(details));
    this.showCaModal.set(false);
    this.toast.success('CA Contact Saved', 'Chartered Accountant details saved successfully!');
  }

  setPreviousMonth() {
    const now = new Date();
    let m = now.getMonth(); // previous month (0-indexed = last month in 1-indexed)
    let y = now.getFullYear();
    if (m === 0) {
      m = 12;
      y = y - 1;
    }
    this.selectedMonth = m;
    this.selectedYear = y;
    this.filterMode = 'MONTHLY';
    this.loadReport();
  }

  setCurrentMonth() {
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.filterMode = 'MONTHLY';
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    let params: any = {};
    if (this.filterMode === 'MONTHLY') {
      params = {
        month: this.selectedMonth,
        year: this.selectedYear
      };
    } else {
      params = {
        filter: 'custom',
        startDate: this.startDate,
        endDate: this.endDate
      };
    }

    this.api.get<any>('/reports/ca-monthly', params).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) {
          this.reportData.set(res.data);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error('त्रुटि', err.error?.message || 'रिपोर्ट लोड नहीं हो सकी।');
      }
    });
  }

  getMonthName(): string {
    const found = this.months.find(m => m.value === Number(this.selectedMonth));
    return found ? found.name : `Month ${this.selectedMonth}`;
  }

  // --- Print / PDF Generation ---
  printSalesPDF() {
    this.printSection.set('SALES');
    setTimeout(() => {
      window.print();
    }, 150);
  }

  printPurchasesPDF() {
    this.printSection.set('PURCHASES');
    setTimeout(() => {
      window.print();
    }, 150);
  }

  printAllMasterPDF() {
    this.printSection.set('ALL');
    setTimeout(() => {
      window.print();
    }, 150);
  }

  // --- CSV / Excel Export for CA ---
  exportSalesCSV() {
    const sales = this.reportData()?.sales || [];
    if (sales.length === 0) {
      this.toast.warning('No Data', 'डाउनलोड करने के लिए बिक्री बिल डेटा उपलब्ध नहीं है।');
      return;
    }

    const headers = ['Invoice No', 'Invoice Date', 'Customer Name', 'Customer Mobile', 'Customer GSTIN', 'Bill Type (B2B/B2C)', 'Taxable Amount (Rs)', 'CGST (Rs)', 'SGST (Rs)', 'IGST (Rs)', 'Total GST (Rs)', 'Grand Total (Rs)', 'Payment Method'];
    const rows = sales.map((s: any) => [
      `"${s.invoiceNumber}"`,
      `"${new Date(s.invoiceDate).toLocaleDateString('en-IN')}"`,
      `"${(s.customerName || '').replace(/"/g, '""')}"`,
      `"${s.customerMobile || ''}"`,
      `"${s.customerGstin || ''}"`,
      `"${s.isB2B ? 'B2B' : 'B2C'}"`,
      s.subtotal,
      s.totalCgst,
      s.totalSgst,
      s.totalIgst,
      s.totalGst,
      s.grandTotal,
      `"${s.paymentMethod || 'CASH'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    this.downloadFile(csvContent, `Sales_Report_${this.getMonthName()}_${this.selectedYear}.csv`, 'text/csv;charset=utf-8;');
    this.toast.success('Downloaded', 'बिक्री बिल Excel/CSV फाइल डाउनलोड हो गई है।');
  }

  exportPurchasesCSV() {
    const purchases = this.reportData()?.purchases || [];
    if (purchases.length === 0) {
      this.toast.warning('No Data', 'डाउनलोड करने के लिए खरीद बिल डेटा उपलब्ध नहीं है।');
      return;
    }

    const headers = ['Supplier Bill No', 'Purchase Date', 'Supplier Name', 'Supplier Mobile', 'Supplier GSTIN', 'Taxable Amount (Rs)', 'Input CGST (Rs)', 'Input SGST (Rs)', 'Input IGST (Rs)', 'Total Input GST / ITC (Rs)', 'Grand Total (Rs)', 'Payment Status'];
    const rows = purchases.map((p: any) => [
      `"${p.billNumber}"`,
      `"${new Date(p.purchaseDate).toLocaleDateString('en-IN')}"`,
      `"${(p.supplierName || '').replace(/"/g, '""')}"`,
      `"${p.supplierMobile || ''}"`,
      `"${p.supplierGstin || ''}"`,
      p.subtotal,
      p.totalCgst,
      p.totalSgst,
      p.totalIgst,
      p.totalGst,
      p.grandTotal,
      `"${p.paymentStatus || 'PAID'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    this.downloadFile(csvContent, `Purchases_Report_${this.getMonthName()}_${this.selectedYear}.csv`, 'text/csv;charset=utf-8;');
    this.toast.success('Downloaded', 'खरीद बिल Excel/CSV फाइल डाउनलोड हो गई है।');
  }

  private downloadFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob(['\ufeff' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- WhatsApp Sharing to CA ---
  shareViaWhatsApp(section: 'SALES' | 'PURCHASES' | 'ALL') {
    const shopName = this.shop()?.name || 'MKS Business Store';
    const shopGstin = this.shop()?.gstin || 'N/A';
    const period = `${this.getMonthName()} ${this.selectedYear}`;
    const data = this.reportData();

    if (!data) {
      this.toast.warning('No Data', 'कृपया पहले रिपोर्ट लोड करें।');
      return;
    }

    let text = `*🏢 ${shopName}*\n`;
    text += `*📌 GSTIN:* ${shopGstin}\n`;
    text += `*📅 CA Monthly Tax Report - ${period}*\n`;
    text += `----------------------------------\n`;

    if (section === 'SALES' || section === 'ALL') {
      text += `*🟢 SALES / GSTR-1 SUMMARY (बिक्री)*\n`;
      text += `• Total Sale Bills: ${data.salesSummary?.count || 0}\n`;
      text += `• Taxable Value: ₹${(data.salesSummary?.totalTaxableSales || 0).toLocaleString('en-IN')}\n`;
      text += `• Output CGST: ₹${(data.salesSummary?.totalSalesCgst || 0).toLocaleString('en-IN')}\n`;
      text += `• Output SGST: ₹${(data.salesSummary?.totalSalesSgst || 0).toLocaleString('en-IN')}\n`;
      text += `• Output IGST: ₹${(data.salesSummary?.totalSalesIgst || 0).toLocaleString('en-IN')}\n`;
      text += `• *Total Sales (Turnover):* ₹${(data.salesSummary?.totalSalesAmount || 0).toLocaleString('en-IN')}\n`;
      text += `• B2B Bills: ${data.salesSummary?.b2bSalesCount || 0} | B2C Bills: ${data.salesSummary?.b2cSalesCount || 0}\n\n`;
    }

    if (section === 'PURCHASES' || section === 'ALL') {
      text += `*🔵 PURCHASES / GSTR-2 SUMMARY (खरीद - ITC)*\n`;
      text += `• Total Purchase Bills: ${data.purchasesSummary?.count || 0}\n`;
      text += `• Taxable Value: ₹${(data.purchasesSummary?.totalTaxablePurchases || 0).toLocaleString('en-IN')}\n`;
      text += `• Input CGST: ₹${(data.purchasesSummary?.totalPurchasesCgst || 0).toLocaleString('en-IN')}\n`;
      text += `• Input SGST: ₹${(data.purchasesSummary?.totalPurchasesSgst || 0).toLocaleString('en-IN')}\n`;
      text += `• Input IGST: ₹${(data.purchasesSummary?.totalPurchasesIgst || 0).toLocaleString('en-IN')}\n`;
      text += `• *Total ITC Claimable:* ₹${(data.purchasesSummary?.totalPurchasesGst || 0).toLocaleString('en-IN')}\n`;
      text += `• *Total Purchases:* ₹${(data.purchasesSummary?.totalPurchasesAmount || 0).toLocaleString('en-IN')}\n\n`;
    }

    if (section === 'ALL') {
      text += `*⚖️ GST TAX RECONCILIATION*\n`;
      text += `• Output GST (Sales): ₹${(data.taxReconciliation?.totalOutputGst || 0).toLocaleString('en-IN')}\n`;
      text += `• Input ITC (Purchases): ₹${(data.taxReconciliation?.totalInputItc || 0).toLocaleString('en-IN')}\n`;
      if ((data.taxReconciliation?.netGstPayable || 0) > 0) {
        text += `• *Net GST Tax Payable:* ₹${(data.taxReconciliation?.netGstPayable || 0).toLocaleString('en-IN')}\n`;
      } else {
        text += `• *ITC Balance (Carry Forward):* ₹${(data.taxReconciliation?.itcCarryForward || 0).toLocaleString('en-IN')}\n`;
      }
    }

    text += `\n_Generated automatically from MKS Billing System._`;

    const phone = this.caMobile().replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? '91' + phone : phone;
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;

    window.open(url, '_blank');
  }

  // --- Email Sharing to CA ---
  shareViaEmail(section: 'SALES' | 'PURCHASES' | 'ALL') {
    const shopName = this.shop()?.name || 'MKS Business';
    const period = `${this.getMonthName()} ${this.selectedYear}`;
    const data = this.reportData();

    const subject = `Monthly GST & Billing Report - ${period} - ${shopName}`;
    let body = `Dear CA,\n\nPlease find the Monthly GST & Tax Billing Report for ${shopName} for ${period}.\n\n`;

    if (data) {
      body += `Sales Total: Rs. ${data.salesSummary?.totalSalesAmount || 0}\n`;
      body += `Output GST: Rs. ${data.salesSummary?.totalSalesGst || 0}\n`;
      body += `Purchases Total: Rs. ${data.purchasesSummary?.totalPurchasesAmount || 0}\n`;
      body += `Input ITC: Rs. ${data.purchasesSummary?.totalPurchasesGst || 0}\n`;
      body += `Net GST Payable: Rs. ${data.taxReconciliation?.netGstPayable || 0}\n\n`;
    }

    body += `Detailed PDF and Excel files can be downloaded directly from our MKS Billing Portal.\n\nThank you,\n${shopName}`;

    const email = this.caEmail() || '';
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}
