import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { getShopTypeConfig, ShopTypeConfig } from '../../core/utils/shop-type-config';

@Component({
  selector: 'app-invoice',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.css']
})
export class InvoiceComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  shop = computed<any>(() => this.auth.currentShop());
  invoice = signal<any | null>(null);
  loading = signal(true);

  // 🏥🛒 Industry Adaptive Shop Configuration
  shopConfig = computed<ShopTypeConfig>(() => getShopTypeConfig(this.shop()?.shopType));

  // Print Format: 'A4' | 'THERMAL_80' | 'THERMAL_58'
  printFormat = signal<'A4' | 'THERMAL_80' | 'THERMAL_58'>('A4');

  // Dynamic UPI Payment QR
  upiPaymentUrl = computed(() => {
    const s = this.shop();
    const inv = this.invoice();
    const upiId = s?.upiId || '';
    if (!inv || !upiId) return '';
    const payeeName = encodeURIComponent(s?.upiName || s?.ownerName || s?.name || 'MKS Store');
    const amount = Number(inv.grandTotal || inv.totalAmount || 0).toFixed(2);
    const invoiceNo = encodeURIComponent(inv.invoiceNumber || 'BILL');
    return `upi://pay?pa=${upiId}&pn=${payeeName}&am=${amount}&cu=INR&tn=${invoiceNo}`;
  });

  upiQrImageUrl = computed(() => {
    const upiUrl = this.upiPaymentUrl();
    if (!upiUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`;
  });

  // Custom WhatsApp mobile & loading states
  showWhatsAppModal = signal(false);
  whatsAppMobile = signal('');
  isSharingWhatsApp = signal(false);
  isDownloadingPDF = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadInvoice(id);
    }
  }

  loadInvoice(id: string) {
    this.loading.set(true);
    this.api.get<any>(`/sales/${id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.invoice.set(res.data);
          if (res.data.customerMobile) {
            this.whatsAppMobile.set(res.data.customerMobile);
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Failed', 'Failed to load invoice details.');
      }
    });
  }

  printInvoice() {
    window.print();
  }

  getPaymentMethodDisplay(method: string): string {
    switch (method) {
      case 'CREDIT': return 'CREDIT (उधार)';
      case 'CASH': return 'CASH (नकद)';
      case 'UPI': return 'UPI (ऑनलाइन)';
      case 'CARD': return 'CARD (कार्ड)';
      case 'BANK_TRANSFER': return 'BANK TRANSFER (बैंक)';
      case 'PARTIAL': return 'PARTIAL (आंशिक भुगतान)';
      default: return method ? `${method} (उधार/नकद)` : 'CASH (नकद)';
    }
  }

  getHtml2PdfOptions() {
    const fmt = this.printFormat();
    let formatParam: any = 'a4';
    let marginParam = [8, 8, 8, 8];
    const element = document.querySelector('.invoice-paper') as HTMLElement;
    const elementHeightPx = element ? element.offsetHeight : 600;
    const heightMm = Math.max(100, Math.ceil(elementHeightPx * 0.264583) + 10);

    if (fmt === 'THERMAL_80') {
      formatParam = [80, heightMm];
      marginParam = [2, 2, 2, 2];
    } else if (fmt === 'THERMAL_58') {
      formatParam = [58, heightMm];
      marginParam = [1, 1, 1, 1];
    } else {
      formatParam = 'a4';
      marginParam = [8, 8, 8, 8];
    }

    return {
      margin:       marginParam,
      filename:     `Invoice_${this.invoice()?.invoiceNumber || 'Bill'}_${fmt}.pdf`,
      image:        { type: 'jpeg', quality: 0.95 },
      html2canvas:  { scale: 1.5, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: formatParam, orientation: 'portrait' }
    };
  }

  downloadPDF() {
    const inv = this.invoice();
    if (!inv) return;

    const fmtQuery = this.printFormat() === 'THERMAL_80' ? '80MM' : (this.printFormat() === 'THERMAL_58' ? '58MM' : 'A4');
    const fileName = `Invoice_${inv.invoiceNumber}_${fmtQuery}.pdf`;

    this.isDownloadingPDF.set(true);
    this.toast.info('Downloading PDF', `Generating ${this.printFormat()} PDF bill...`);

    // ⚡ High-Speed Server-Side Vector PDF Download (< 20ms)
    this.api.getBlob(`/sales/${inv._id}/pdf`, { format: fmtQuery }).subscribe({
      next: (blob) => {
        this.isDownloadingPDF.set(false);
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
        this.toast.success('Downloaded', 'PDF Bill downloaded successfully!');
      },
      error: () => {
        // Fallback to client html2pdf if offline
        const element = document.querySelector('.invoice-paper') as HTMLElement;
        if (element && typeof (window as any).html2pdf !== 'undefined') {
          const opt = this.getHtml2PdfOptions();
          (window as any).html2pdf().set(opt).from(element).save().then(() => {
            this.isDownloadingPDF.set(false);
          }).catch(() => {
            this.isDownloadingPDF.set(false);
          });
        } else {
          this.isDownloadingPDF.set(false);
          window.print();
        }
      }
    });
  }

  openWhatsAppModal() {
    const inv = this.invoice();
    if (inv && inv.customerMobile) {
      this.whatsAppMobile.set(inv.customerMobile);
    }
    this.showWhatsAppModal.set(true);
  }

  async getPdfBlob(): Promise<Blob | null> {
    const element = document.querySelector('.invoice-paper') as HTMLElement;
    if (!element || typeof (window as any).html2pdf === 'undefined') return null;

    const opt = this.getHtml2PdfOptions();
    return await (window as any).html2pdf().set(opt).from(element).output('blob');
  }

  async sendWhatsAppBill() {
    const inv = this.invoice();
    if (!inv) return;

    let phone = this.whatsAppMobile().trim();
    if (!phone) {
      this.toast.warning('Required', 'Please enter a valid mobile number.');
      return;
    }

    // Clean phone number: remove non-digits
    phone = phone.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    const fmtQuery = this.printFormat() === 'THERMAL_80' ? '80MM' : (this.printFormat() === 'THERMAL_58' ? '58MM' : 'A4');
    const formatLabel = this.printFormat() === 'THERMAL_80' ? '80mm Thermal Receipt' : (this.printFormat() === 'THERMAL_58' ? '58mm Thermal Receipt' : 'A4 Tax Invoice');
    const fileName = `Invoice_${inv.invoiceNumber}_${fmtQuery}.pdf`;
    const pdfViewUrl = `http://localhost:5000/api/sales/${inv._id}/pdf?format=${fmtQuery}`;

    // 🔒 Lock button & show loading: DO NOT open WhatsApp until PDF is fully generated!
    this.isSharingWhatsApp.set(true);
    this.toast.info('Preparing PDF', `Generating ${formatLabel} for WhatsApp...`);

    // ⚡ Ultra-fast server-side PDF blob fetch (< 20ms)
    this.api.getBlob(`/sales/${inv._id}/pdf`, { format: fmtQuery }).subscribe({
      next: async (pdfBlob) => {
        let sharedDirectly = false;
        if (pdfBlob && navigator.share && (navigator as any).canShare) {
          const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
          if ((navigator as any).canShare({ files: [pdfFile] })) {
            try {
              await navigator.share({
                files: [pdfFile],
                title: `Invoice ${inv.invoiceNumber}`,
                text: `Hello ${inv.customerName || 'Customer'}, here is your tax invoice from ${this.shop()?.name || 'MKS Billing'}. Total: ₹${inv.grandTotal}`
              });
              sharedDirectly = true;
            } catch (err) {
              console.log('User cancelled or native share fallback', err);
            }
          }
        }

        if (!sharedDirectly) {
          const message = `नमस्ते *${inv.customerName || 'Customer'}* जी! 🙏\n\n📄 *${this.shop()?.name || 'MKS Store'} - Invoice Bill*\n🧾 *इनवॉइस नंबर:* ${inv.invoiceNumber}\n📐 *बिल फॉर्मेट:* ${formatLabel}\n💰 *कुल राशि:* ₹${Number(inv.grandTotal || 0).toLocaleString('en-IN')}\n✅ *जमा राशि:* ₹${Number(inv.amountPaid || 0).toLocaleString('en-IN')}${inv.balanceDue > 0 ? `\n⏳ *बकाया (Due):* ₹${Number(inv.balanceDue || 0).toLocaleString('en-IN')}` : ''}\n\n📥 *अपना (${formatLabel}) ओरिजिनल बिल देखें / डाउनलोड करें:* \n${pdfViewUrl}\n\nधन्यवाद! 🙏`;
          const encodedMsg = encodeURIComponent(message);
          const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
          window.open(url, '_blank');
        }

        this.isSharingWhatsApp.set(false);
        this.showWhatsAppModal.set(false);
        this.toast.success('Shared', 'WhatsApp bill prepared & shared!');
      },
      error: async () => {
        // Fallback to client HTML2PDF if server offline
        let pdfBlob: Blob | null = null;
        try {
          pdfBlob = await this.getPdfBlob();
        } catch (e) {}

        const message = `नमस्ते *${inv.customerName || 'Customer'}* जी! 🙏\n\n📄 *${this.shop()?.name || 'MKS Store'} - Invoice Bill*\n🧾 *इनवॉइस नंबर:* ${inv.invoiceNumber}\n📐 *बिल फॉर्मेट:* ${formatLabel}\n💰 *कुल राशि:* ₹${Number(inv.grandTotal || 0).toLocaleString('en-IN')}\n✅ *जमा राशि:* ₹${Number(inv.amountPaid || 0).toLocaleString('en-IN')}${inv.balanceDue > 0 ? `\n⏳ *बकाया (Due):* ₹${Number(inv.balanceDue || 0).toLocaleString('en-IN')}` : ''}\n\n📥 *अपना (${formatLabel}) ओरिजिनल बिल देखें / डाउनलोड करें:* \n${pdfViewUrl}\n\nधन्यवाद! 🙏`;
        const encodedMsg = encodeURIComponent(message);
        const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;
        window.open(url, '_blank');

        this.isSharingWhatsApp.set(false);
        this.showWhatsAppModal.set(false);
      }
    });
  }
  copyType = signal<'ORIGINAL' | 'DUPLICATE' | 'TRIPLICATE'>('ORIGINAL');

  getTotalQty(): number {
    const inv = this.invoice();
    if (!inv || !inv.items) return 0;
    return inv.items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
  }

  getTotalTaxable(): number {
    const inv = this.invoice();
    if (!inv || !inv.items) return 0;
    return inv.items.reduce((sum: number, item: any) => sum + (Number(item.subtotal) || 0), 0);
  }

  getGstBreakup(): Array<{ rate: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }> {
    const inv = this.invoice();
    if (!inv || !inv.items) return [];

    const map = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number; igst: number; totalTax: number }>();

    for (const item of inv.items) {
      const rate = Number(item.gstPercent) || 0;
      const taxable = Number(item.subtotal) || 0;
      const cgst = Number(item.cgst) || 0;
      const sgst = Number(item.sgst) || 0;
      const igst = Number(item.igst) || 0;
      const totalTax = Number(item.totalGst) || (cgst + sgst + igst);

      if (map.has(rate)) {
        const existing = map.get(rate)!;
        existing.taxable += taxable;
        existing.cgst += cgst;
        existing.sgst += sgst;
        existing.igst += igst;
        existing.totalTax += totalTax;
      } else {
        map.set(rate, {
          rate,
          taxable,
          cgst,
          sgst,
          igst,
          totalTax
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => a.rate - b.rate);
  }

  getTotalGstAmount(): number {
    const inv = this.invoice();
    if (!inv) return 0;
    return Number(inv.totalGst || (Number(inv.totalCgst || 0) + Number(inv.totalSgst || 0) + Number(inv.totalIgst || 0)) || 0);
  }

  getPanNumber(): string {
    const gstin = this.shop()?.gstin || '';
    if (gstin && gstin.length >= 12) {
      return gstin.substring(2, 12);
    }
    return this.shop()?.panNumber || 'AZXS125452';
  }

  getInclusiveRate(item: any): number {
    const rate = Number(item.rate || 0);
    const gst = Number(item.gstPercent || 0);
    return +(rate * (1 + gst / 100)).toFixed(2);
  }

  amountInWords(num: number | undefined | null): string {
    if (num === undefined || num === null || isNaN(num)) return 'Zero Rupees Only';
    const rounded = Math.round(Number(num));
    if (rounded === 0) return 'Zero Rupees Only';

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const convertLessThanOneThousand = (n: number): string => {
      let str = '';
      if (n >= 100) {
        str += a[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      if (n >= 20) {
        str += b[Math.floor(n / 10)] + ' ' + a[n % 10] + ' ';
      } else if (n > 0) {
        str += a[n] + ' ';
      }
      return str.trim();
    };

    let n = Math.abs(rounded);
    let str = '';

    const crores = Math.floor(n / 10000000);
    n %= 10000000;
    const lakhs = Math.floor(n / 100000);
    n %= 100000;
    const thousands = Math.floor(n / 1000);
    n %= 1000;
    const remainder = n;

    if (crores > 0) {
      str += convertLessThanOneThousand(crores) + ' Crore ';
    }
    if (lakhs > 0) {
      str += convertLessThanOneThousand(lakhs) + ' Lakh ';
    }
    if (thousands > 0) {
      str += convertLessThanOneThousand(thousands) + ' Thousand ';
    }
    if (remainder > 0) {
      str += convertLessThanOneThousand(remainder);
    }

    return `Rupees ${str.trim()} Only`;
  }
}
