import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { LanguageService } from '../core/services/language.service';

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  purchasePrice: number;
  mrp?: number;
  sellingPrice?: number;
  gstPercent: number;
  cgst: number;
  sgst: number;
  igst: number;
  subtotal: number;
  totalGst: number;
  total: number;
}

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './purchases.component.html'
})
export class PurchasesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  public lang = inject(LanguageService);

  shop = this.auth.currentShop;
  purchases = signal<any[]>([]);
  suppliers = signal<any[]>([]);
  products = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  showAddModal = false;
  purchaseForm!: FormGroup;

  // View / Print Purchase Invoice State
  showViewModal = signal<boolean>(false);
  selectedPurchase = signal<any | null>(null);
  printFormat = signal<'A4' | 'THERMAL_80' | 'THERMAL_58'>('A4');
  copyType = signal<'ORIGINAL' | 'DUPLICATE' | 'OFFICE'>('ORIGINAL');

  // Selected supplier & items
  selectedSupplierId = '';
  supplierInvoice = '';
  purchaseItems = signal<PurchaseItem[]>([]);

  // Search product inside modal
  prodSearch = '';
  prodResults = signal<any[]>([]);
  showDropdown = false;

  // Totals
  subtotal = 0;
  totalGst = 0;
  grandTotal = 0;
  amountPaid = 0;
  paymentMethod = 'CASH';

  ngOnInit() {
    this.loadPurchases();
    this.loadSuppliers();
    this.loadProducts();
    this.initForm();
  }

  initForm() {
    this.purchaseForm = this.fb.group({
      supplierId: ['', Validators.required],
      supplierInvoice: [''],
      paymentMethod: ['CASH', Validators.required],
      amountPaid: [0, [Validators.required, Validators.min(0)]],
      notes: ['']
    });
  }

  loadPurchases() {
    this.loading.set(true);
    this.api.get<any>('/purchases').subscribe({
      next: (res) => {
        if (res.success) this.purchases.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadSuppliers() {
    this.api.get<any>('/suppliers').subscribe({
      next: (res) => { if (res.success) this.suppliers.set(res.data); }
    });
  }

  loadProducts() {
    this.api.get<any>('/products').subscribe({
      next: (res) => { if (res.success) this.products.set(res.data); }
    });
  }

  searchProducts(query: string) {
    if (!query.trim()) {
      this.prodResults.set([]);
      this.showDropdown = false;
      return;
    }
    const filtered = this.products().filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    this.prodResults.set(filtered);
    this.showDropdown = filtered.length > 0;
  }

  addItem(prod: any) {
    const newItem: PurchaseItem = {
      productId: prod._id,
      productName: prod.name,
      quantity: 1,
      unit: prod.unit || 'PCS',
      purchasePrice: prod.purchasePrice || 0,
      mrp: prod.mrp || 0,
      sellingPrice: prod.sellingPrice || 0,
      gstPercent: prod.gstPercent || 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      subtotal: 0,
      totalGst: 0,
      total: 0
    };
    this.purchaseItems.update(items => [...items, newItem]);
    this.calculateRow(newItem);
    this.prodSearch = '';
    this.prodResults.set([]);
    this.showDropdown = false;
    this.calculateTotals();
  }

  removeItem(item: PurchaseItem) {
    this.purchaseItems.update(items => items.filter(i => i.productId !== item.productId));
    this.calculateTotals();
  }

  updateQty(item: PurchaseItem, qty: number) {
    if (qty < 1) return;
    item.quantity = qty;
    this.calculateRow(item);
    this.calculateTotals();
  }

  updatePrice(item: PurchaseItem, price: number) {
    item.purchasePrice = price;
    this.calculateRow(item);
    this.calculateTotals();
  }

  calculateRow(item: PurchaseItem) {
    const gross = item.purchasePrice * item.quantity;
    const gst = (gross * item.gstPercent) / 100;
    item.subtotal = gross;
    item.totalGst = gst;
    item.total = gross + gst;
    item.cgst = gst / 2;
    item.sgst = gst / 2;
    item.igst = 0;
  }

  calculateTotals() {
    let sub = 0;
    let gst = 0;
    this.purchaseItems().forEach(item => {
      sub += item.subtotal;
      gst += item.totalGst;
    });
    this.subtotal = parseFloat(sub.toFixed(2));
    this.totalGst = parseFloat(gst.toFixed(2));
    this.grandTotal = Math.round(this.subtotal + this.totalGst);
  }

  openViewPurchase(pur: any) {
    this.selectedPurchase.set(pur);
    this.showViewModal.set(true);
  }

  printPurchaseInvoice() {
    window.print();
  }

  getSupplierDetails(supplierId?: string): any {
    if (!supplierId) return null;
    return this.suppliers().find(s => s._id === supplierId || s.id === supplierId);
  }

  getPaymentMethodDisplay(method?: string): string {
    switch (method) {
      case 'CASH': return 'Cash (नकद)';
      case 'UPI': return 'UPI / QR Payment';
      case 'CARD': return 'Card (Debit / Credit)';
      case 'BANK_TRANSFER': return 'Net Banking / NEFT';
      case 'CREDIT': return 'Wholesale Credit (उधार)';
      default: return method || 'Cash';
    }
  }

  submitPurchase() {
    if (this.purchaseItems().length === 0) {
      this.toast.warning('Empty Invoice', 'Please add products to buy.');
      return;
    }

    if (!this.selectedSupplierId) {
      this.toast.warning('Supplier Required', 'Select a supplier first.');
      return;
    }

    this.submitting = true;
    const supplierObj = this.suppliers().find(s => s._id === this.selectedSupplierId);

    const payload = {
      supplierId: this.selectedSupplierId,
      supplierName: supplierObj?.companyName || supplierObj?.name || 'Unknown Supplier',
      supplierInvoice: this.supplierInvoice,
      items: this.purchaseItems(),
      subtotal: this.subtotal,
      totalGst: this.totalGst,
      grandTotal: this.grandTotal,
      amountPaid: this.amountPaid,
      paymentMethod: this.paymentMethod,
      notes: this.purchaseForm.value.notes
    };

    this.api.post<any>('/purchases', payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showAddModal = false;
        this.toast.success('Procured', 'Purchase invoice logged and stock updated.');
        this.loadPurchases();
        this.purchaseItems.set([]);

        // Automatically open the clean purchase invoice for viewing / printing
        if (res.data) {
          this.openViewPurchase(res.data);
        }
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Failed', err.error?.message || 'Failed to log purchase.');
      }
    });
  }
}
