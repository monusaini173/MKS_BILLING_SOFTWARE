import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './customers.component.html'
})
export class CustomersComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);

  customers = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  // Filter state
  activeTab = signal<'ALL' | 'PENDING' | 'CLEARED'>('ALL');
  searchQuery = signal<string>('');

  // Modals
  showModal = false;
  editMode = false;
  selectedCustomer: any = null;
  customerForm!: FormGroup;

  showPaymentModal = false;
  paymentForm!: FormGroup;

  // WhatsApp Reminder Modal
  showReminderModal = signal<boolean>(false);
  reminderCustomer = signal<any>(null);
  reminderMobile = signal<string>('');
  reminderProducts = signal<string>('');
  reminderInvoiceNo = signal<string>('');
  reminderInvoiceDate = signal<string>('');
  selectedTemplate = signal<'POLITE' | 'DETAILED' | 'URGENT' | 'CUSTOM'>('POLITE');
  customMessageText = signal<string>('');

  // Computed metrics
  totalPendingAmount = computed(() => {
    return this.customers().reduce((sum, c) => sum + (c.pendingAmount || 0), 0);
  });

  pendingCustomersCount = computed(() => {
    return this.customers().filter(c => (c.pendingAmount || 0) > 0).length;
  });

  filteredCustomers = computed(() => {
    let list = this.customers();
    const query = this.searchQuery().trim().toLowerCase();

    if (query) {
      list = list.filter(c => 
        (c.name && c.name.toLowerCase().includes(query)) ||
        (c.mobile && c.mobile.includes(query)) ||
        (c.email && c.email.toLowerCase().includes(query))
      );
    }

    if (this.activeTab() === 'PENDING') {
      list = list.filter(c => (c.pendingAmount || 0) > 0);
    } else if (this.activeTab() === 'CLEARED') {
      list = list.filter(c => (c.pendingAmount || 0) <= 0);
    }

    return list;
  });

  ngOnInit() {
    this.loadCustomers();
    this.initForm();
    this.initPaymentForm();
  }

  initForm() {
    this.customerForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      email: [''],
      gstin: [''],
      address: ['']
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

  loadCustomers() {
    this.loading.set(true);
    this.api.get<any>('/customers').subscribe({
      next: (res) => {
        if (res.success) this.customers.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  openAddModal() {
    this.editMode = false;
    this.selectedCustomer = null;
    this.initForm();
    this.showModal = true;
  }

  openEditModal(cust: any) {
    this.editMode = true;
    this.selectedCustomer = cust;
    this.initForm();
    this.customerForm.patchValue(cust);
    this.showModal = true;
  }

  openPaymentModal(cust: any) {
    this.selectedCustomer = cust;
    this.initPaymentForm();
    this.paymentForm.patchValue({ amount: cust.pendingAmount });
    this.showPaymentModal = true;
  }

  // --- WhatsApp Payment Reminder Methods ---
  openReminderModal(cust: any) {
    this.reminderCustomer.set(cust);
    this.reminderMobile.set(cust?.mobile || '');
    this.selectedTemplate.set('POLITE');
    this.reminderProducts.set('');
    this.reminderInvoiceNo.set('');
    this.reminderInvoiceDate.set('');

    // Fetch customer history to extract exact purchased products from latest bill
    this.api.get<any>(`/customers/${cust._id}/history`).subscribe({
      next: (res) => {
        if (res.success && res.data.sales && res.data.sales.length > 0) {
          const sales = res.data.sales;
          // Find latest pending or credit sale, or first sale
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
      },
      error: () => {
        this.customMessageText.set(this.buildMessageText(cust, 'POLITE'));
      }
    });

    this.customMessageText.set(this.buildMessageText(cust, 'POLITE'));
    this.showReminderModal.set(true);
  }

  onReminderProductsChange(newProducts: string) {
    this.reminderProducts.set(newProducts);
    const cust = this.reminderCustomer();
    if (cust && this.selectedTemplate() !== 'CUSTOM') {
      this.customMessageText.set(this.buildMessageText(cust, this.selectedTemplate(), newProducts, this.reminderInvoiceNo(), this.reminderInvoiceDate()));
    }
  }

  onTemplateSelect(template: 'POLITE' | 'DETAILED' | 'URGENT' | 'CUSTOM') {
    this.selectedTemplate.set(template);
    const cust = this.reminderCustomer();
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


  quickSendReminder(cust: any) {
    if (!cust.mobile) {
      this.toast.warning('Mobile Missing', 'ग्राहक का मोबाइल नंबर दर्ज नहीं है।');
      return;
    }

    let phone = cust.mobile.toString().trim().replace(/\D/g, '');
    if (phone.length === 10) {
      phone = '91' + phone;
    }

    const msg = this.buildMessageText(cust, 'POLITE');
    const encodedMsg = encodeURIComponent(msg);
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMsg}`;

    window.open(url, '_blank');
    this.toast.success('WhatsApp Opened', `${cust.name} के लिए WhatsApp तकादा खुल गया।`);
  }

  onSubmit() {
    const rawMobile = (this.customerForm.get('mobile')?.value || '').toString().replace(/\D/g, '');
    const cleanMobile = rawMobile.length >= 10 ? rawMobile.slice(-10) : rawMobile;
    this.customerForm.patchValue({ mobile: cleanMobile });

    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      this.toast.warning('विवरण अधूरा है', 'कृपया ग्राहक का नाम और 10 अंकों का सही मोबाइल नंबर दर्ज करें।');
      return;
    }

    this.submitting = true;
    const formVal = this.customerForm.value;
    const body = {
      name: formVal.name?.trim(),
      mobile: cleanMobile,
      email: formVal.email?.trim() || undefined,
      gstin: formVal.gstin?.trim()?.toUpperCase() || undefined,
      address: formVal.address?.trim() || undefined
    };

    if (this.editMode) {
      this.api.put<any>(`/customers/${this.selectedCustomer._id}`, body).subscribe({
        next: (res) => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('Updated', res?.message || 'Customer updated successfully.');
          this.loadCustomers();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('त्रुटि (Error)', err.error?.message || 'ग्राहक विवरण अपडेट नहीं हो सका।');
        }
      });
    } else {
      this.api.post<any>('/customers', body).subscribe({
        next: (res) => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('सफल (Saved)', res?.message || 'नया ग्राहक सफलतापूर्वक जोड़ दिया गया।');
          this.loadCustomers();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('त्रुटि (Error)', err.error?.message || 'ग्राहक जोड़ने में समस्या आई।');
        }
      });
    }
  }

  submitPayment() {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const body = this.paymentForm.value;

    this.api.post<any>(`/customers/${this.selectedCustomer._id}/receive-payment`, body).subscribe({
      next: () => {
        this.submitting = false;
        this.showPaymentModal = false;
        this.toast.success('Payment Received', 'Udhaar payment received and logged.');
        this.loadCustomers();
      },
      error: () => this.submitting = false
    });
  }

  deleteCustomer(id: string) {
    if (confirm('Delete customer?')) {
      this.api.delete<any>(`/customers/${id}`).subscribe({
        next: () => {
          this.toast.success('Deleted', 'Customer record deleted.');
          this.loadCustomers();
        }
      });
    }
  }
}

