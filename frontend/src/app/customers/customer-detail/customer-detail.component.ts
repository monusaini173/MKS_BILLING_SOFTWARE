import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './customer-detail.component.html'
})
export class CustomerDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);

  customer = signal<any | null>(null);
  sales = signal<any[]>([]);
  payments = signal<any[]>([]);
  loading = signal(true);

  // WhatsApp Reminder Modal
  showReminderModal = signal<boolean>(false);
  reminderMobile = signal<string>('');
  reminderProducts = signal<string>('');
  reminderInvoiceNo = signal<string>('');
  reminderInvoiceDate = signal<string>('');
  selectedTemplate = signal<'POLITE' | 'DETAILED' | 'URGENT' | 'CUSTOM'>('POLITE');
  customMessageText = signal<string>('');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDetails(id);
    }
  }

  loadDetails(id: string) {
    this.loading.set(true);

    // Get customer profile
    this.api.get<any>(`/customers/${id}`).subscribe({
      next: (res) => {
        if (res.success) this.customer.set(res.data);
      }
    });

    // Get customer history
    this.api.get<any>(`/customers/${id}/history`).subscribe({
      next: (res) => {
        if (res.success) {
          this.sales.set(res.data.sales || []);
          this.payments.set(res.data.payments || []);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openReminderModal() {
    const cust = this.customer();
    if (!cust) return;
    this.reminderMobile.set(cust.mobile || '');
    this.selectedTemplate.set('POLITE');
    this.reminderProducts.set('');
    this.reminderInvoiceNo.set('');
    this.reminderInvoiceDate.set('');

    const sales = this.sales();
    if (sales && sales.length > 0) {
      const pendingSale = sales.find((s: any) => s.balanceDue > 0 || s.paymentMethod === 'CREDIT') || sales[0];
      if (pendingSale && pendingSale.items && pendingSale.items.length > 0) {
        const itemsText = pendingSale.items.map((i: any) => `• ${i.quantity}x ${i.productName} (₹${i.total})`).join('\n');
        this.reminderProducts.set(itemsText);
        this.reminderInvoiceNo.set(pendingSale.invoiceNumber || '');
        if (pendingSale.invoiceDate) {
          const d = new Date(pendingSale.invoiceDate);
          this.reminderInvoiceDate.set(`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`);
        }
      }
    }

    this.customMessageText.set(this.buildMessageText(cust, 'POLITE', this.reminderProducts(), this.reminderInvoiceNo(), this.reminderInvoiceDate()));
    this.showReminderModal.set(true);
  }

  onReminderProductsChange(newProducts: string) {
    this.reminderProducts.set(newProducts);
    const cust = this.customer();
    if (cust && this.selectedTemplate() !== 'CUSTOM') {
      this.customMessageText.set(this.buildMessageText(cust, this.selectedTemplate(), newProducts, this.reminderInvoiceNo(), this.reminderInvoiceDate()));
    }
  }

  onTemplateSelect(template: 'POLITE' | 'DETAILED' | 'URGENT' | 'CUSTOM') {
    this.selectedTemplate.set(template);
    const cust = this.customer();
    if (cust && template !== 'CUSTOM') {
      this.customMessageText.set(this.buildMessageText(cust, template, this.reminderProducts(), this.reminderInvoiceNo(), this.reminderInvoiceDate()));
    }
  }

  buildMessageText(cust: any, templateType: string, productsText: string = '', invNo: string = '', invDate: string = ''): string {
    const shopName = this.auth.currentShop()?.name || 'हमारी दुकान (Our Shop)';
    const shopMobile = this.auth.currentShop()?.mobile || '';
    const customerName = cust?.name || 'ग्राहक';
    const pendingAmount = Number(cust?.pendingAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalPurchased = Number(cust?.totalPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalPaid = Number(cust?.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const productSection = productsText 
      ? `\n🛍️ *बाकी सामान/प्रोडक्ट का विवरण:*\n${productsText}\n` 
      : '';

    const billInfo = invNo 
      ? `\n🧾 *बिल नंबर:* #${invNo}${invDate ? ` (दिनांक: ${invDate})` : ''}` 
      : '';

    const shopUpi = this.auth.currentShop()?.upiId;
    const upiInfo = shopUpi ? `\n💳 *UPI ID पर भुगतान करें:* ${shopUpi}` : '';

    switch (templateType) {
      case 'POLITE':
        return `नमस्ते *${customerName}* जी 🙏,\n\nयह *${shopName}* की तरफ से आपके बकाया उधार का एक विनम्र स्मरण है।\n${productSection}${billInfo}\n💰 *कुल बकाया उधार राशि:* *₹${pendingAmount}*${upiInfo}\n\nकृपया खरीदे गए सामान की बकाया राशि का भुगतान अपनी सुविधानुसार करने का कष्ट करें। आप दुकान पर नकद या UPI द्वारा भुगतान कर सकते हैं।\n\nधन्यवाद!\n*${shopName}*${shopMobile ? `\n📞 ${shopMobile}` : ''}`;
      
      case 'DETAILED':
        return `श्री/श्रीमती *${customerName}*,\n\n*${shopName}* पर आपका खाता विवरण:\n━━━━━━━━━━━━━━━━━━${productSection}${billInfo}\n📦 *कुल खरीदारी:* ₹${totalPurchased}\n✅ *जमा राशि:* ₹${totalPaid}\n⚠️ *शेष बकाया उधार:* *₹${pendingAmount}*${upiInfo}\n━━━━━━━━━━━━━━━━━━\nकृपया बकाया राशि का भुगतान जल्द से जल्द करें।\n\nधन्यवाद!\n*${shopName}*${shopMobile ? `\n📞 ${shopMobile}` : ''}`;

      case 'URGENT':
        return `⚠️ *जरूरी सूचना / Payment Reminder*\n\nप्रिय *${customerName}* जी,\n*${shopName}* पर आपके खरीदे गए सामान का *₹${pendingAmount}* का उधार काफी समय से लंबित है।\n${productSection}${billInfo}\n💰 *बकाया राशि:* *₹${pendingAmount}*${upiInfo}\n\nकृपया आज ही इसका भुगतान करके अपना खाता क्लियर करें। आप Google Pay / PhonePe / Paytm या नकद से भुगतान कर सकते हैं।\n\nसादर,\n*${shopName}*${shopMobile ? ` (📞 ${shopMobile})` : ''}`;

      default:
        return `नमस्ते *${customerName}*, *${shopName}* से आपके सामान का बकाया उधार *₹${pendingAmount}* है।${upiInfo}\nकृपया भुगतान करें। धन्यवाद!`;
    }
  }

  sendWhatsAppReminder() {
    let rawPhone = this.reminderMobile().trim();
    if (!rawPhone) {
      this.toast.warning('Mobile Missing', 'कृपया मोबाइल नंबर दर्ज करें जिस पर आप WhatsApp भेजना चाहते हैं।');
      return;
    }

    let phone = rawPhone.replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    const message = this.customMessageText().trim();
    const encodedMsg = encodeURIComponent(message);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;

    window.open(url, '_blank');
    this.showReminderModal.set(false);
    this.toast.success('Reminder Sent', `WhatsApp संदेश +${phone} पर भेजा जा रहा है।`);
  }
}


