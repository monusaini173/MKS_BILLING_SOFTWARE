import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { LanguageService } from '../core/services/language.service';

export interface DocItem {
  productId?: string;
  productName: string;
  quantity: number;
  unit: string;
  rate: number;
  mrp?: number;
  discount: number;
  gstPercent: number;
  subtotal: number;
  totalGst: number;
  total: number;
}

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './documents.component.html'
})
export class DocumentsComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  protected auth = inject(AuthService);
  public lang = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  shop = this.auth.currentShop;
  documents = signal<any[]>([]);
  customers = signal<any[]>([]);
  suppliers = signal<any[]>([]);
  products = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  // Tabs & Filtering
  activeType = signal<string>('ALL');
  searchTerm = '';
  statusFilter = '';

  // New Document Modal State
  showCreateModal = false;
  docType = 'PURCHASE_ORDER';
  partyType: 'CUSTOMER' | 'SUPPLIER' = 'SUPPLIER';
  selectedPartyId = '';
  partyName = '';
  partyMobile = '';
  partyGstin = '';
  partyAddress = '';
  validUntilDate = '';
  docNotes = '';
  termsConditions = '';

  // Document Items
  docItems = signal<DocItem[]>([]);

  // Item Search
  prodSearch = '';
  prodResults = signal<any[]>([]);
  showProdDropdown = false;

  // View / Print Modal
  showViewModal = signal<boolean>(false);
  selectedDoc = signal<any | null>(null);
  printFormat = signal<'A4' | 'THERMAL_80' | 'THERMAL_58'>('A4');

  // Totals
  subtotal = 0;
  totalDiscount = 0;
  totalGst = 0;
  grandTotal = 0;
  amountPaid = 0;
  paymentMethod = 'CASH';

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['type']) {
        this.activeType.set(params['type']);
      }
      this.loadDocuments();
    });

    this.loadParties();
    this.loadProducts();
  }

  loadDocuments() {
    this.loading.set(true);
    let url = '/documents';
    const params: any = {};
    if (this.activeType() !== 'ALL') {
      params.documentType = this.activeType();
    }
    if (this.searchTerm) {
      params.search = this.searchTerm;
    }
    if (this.statusFilter) {
      params.status = this.statusFilter;
    }

    this.api.get<any>(url, params).subscribe({
      next: (res) => {
        if (res.success) this.documents.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadParties() {
    this.api.get<any>('/customers').subscribe({
      next: (res) => { if (res.success) this.customers.set(res.data); }
    });
    this.api.get<any>('/suppliers').subscribe({
      next: (res) => { if (res.success) this.suppliers.set(res.data); }
    });
  }

  loadProducts() {
    this.api.get<any>('/products').subscribe({
      next: (res) => { if (res.success) this.products.set(res.data); }
    });
  }

  switchTab(type: string) {
    this.activeType.set(type);
    this.router.navigate([], { relativeTo: this.route, queryParams: { type: type === 'ALL' ? null : type }, queryParamsHandling: 'merge' });
    this.loadDocuments();
  }

  openCreateModal(type: string = 'PURCHASE_ORDER') {
    this.docType = type;
    this.updatePartyTypeByDocType();
    this.resetFormFields();
    this.showCreateModal = true;
  }

  updatePartyTypeByDocType() {
    if (['PURCHASE_ORDER', 'PURCHASE_RETURN', 'PURCHASE_INVOICE'].includes(this.docType)) {
      this.partyType = 'SUPPLIER';
    } else {
      this.partyType = 'CUSTOMER';
    }
    this.selectedPartyId = '';
    this.partyName = '';
    this.partyMobile = '';
    this.partyGstin = '';
    this.partyAddress = '';
  }

  onPartySelect(partyId: string) {
    if (!partyId) return;
    this.selectedPartyId = partyId;
    if (this.partyType === 'CUSTOMER') {
      const c = this.customers().find(item => item._id === partyId || item.id === partyId);
      if (c) {
        this.partyName = c.name;
        this.partyMobile = c.mobile || '';
        this.partyGstin = c.gstin || '';
        this.partyAddress = c.address || '';
      }
    } else {
      const s = this.suppliers().find(item => item._id === partyId || item.id === partyId);
      if (s) {
        this.partyName = s.companyName || s.name;
        this.partyMobile = s.mobile || s.phone || '';
        this.partyGstin = s.gstin || '';
        this.partyAddress = s.address || '';
      }
    }
  }

  resetFormFields() {
    this.selectedPartyId = '';
    this.partyName = '';
    this.partyMobile = '';
    this.partyGstin = '';
    this.partyAddress = '';
    this.validUntilDate = '';
    this.docNotes = '';
    this.termsConditions = '1. Goods once sold will not be taken back without original invoice.\n2. Subject to local jurisdiction.';
    this.docItems.set([]);
    this.subtotal = 0;
    this.totalDiscount = 0;
    this.totalGst = 0;
    this.grandTotal = 0;
    this.amountPaid = 0;
    this.paymentMethod = 'CASH';
  }

  searchProducts(query: string) {
    if (!query.trim()) {
      this.prodResults.set([]);
      this.showProdDropdown = false;
      return;
    }
    const filtered = this.products().filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || (p.barcode && p.barcode.includes(query)));
    this.prodResults.set(filtered);
    this.showProdDropdown = filtered.length > 0;
  }

  addItem(prod: any) {
    const isPurchase = ['PURCHASE_ORDER', 'PURCHASE_RETURN', 'PURCHASE_INVOICE'].includes(this.docType);
    const rate = isPurchase ? (prod.purchasePrice || 0) : (prod.sellingPrice || prod.price || 0);

    const newItem: DocItem = {
      productId: prod._id,
      productName: prod.name,
      quantity: 1,
      unit: prod.unit || 'PCS',
      rate: rate,
      mrp: prod.mrp || rate,
      discount: 0,
      gstPercent: prod.gstPercent || 0,
      subtotal: rate,
      totalGst: (rate * (prod.gstPercent || 0)) / 100,
      total: rate + ((rate * (prod.gstPercent || 0)) / 100)
    };

    this.docItems.update(items => [...items, newItem]);
    this.prodSearch = '';
    this.prodResults.set([]);
    this.showProdDropdown = false;
    this.calculateTotals();
  }

  addCustomItem() {
    const newItem: DocItem = {
      productName: 'Item ' + (this.docItems().length + 1),
      quantity: 1,
      unit: 'PCS',
      rate: 0,
      discount: 0,
      gstPercent: 0,
      subtotal: 0,
      totalGst: 0,
      total: 0
    };
    this.docItems.update(items => [...items, newItem]);
    this.calculateTotals();
  }

  removeItem(index: number) {
    this.docItems.update(items => items.filter((_, i) => i !== index));
    this.calculateTotals();
  }

  updateItemRow(item: DocItem) {
    const gross = (item.rate || 0) * (item.quantity || 1);
    const afterDiscount = Math.max(0, gross - (item.discount || 0));
    const gst = (afterDiscount * (item.gstPercent || 0)) / 100;
    item.subtotal = parseFloat(afterDiscount.toFixed(2));
    item.totalGst = parseFloat(gst.toFixed(2));
    item.total = Math.round(afterDiscount + gst);
    this.calculateTotals();
  }

  calculateTotals() {
    let sub = 0;
    let gst = 0;
    let disc = 0;
    this.docItems().forEach(item => {
      sub += item.subtotal;
      gst += item.totalGst;
      disc += item.discount || 0;
    });
    this.subtotal = parseFloat(sub.toFixed(2));
    this.totalGst = parseFloat(gst.toFixed(2));
    this.totalDiscount = parseFloat(disc.toFixed(2));
    this.grandTotal = Math.round(this.subtotal + this.totalGst);
  }

  createDocument() {
    if (!this.partyName.trim()) {
      this.toast.warning('Party Name Required', 'Please select or enter party name.');
      return;
    }
    if (this.docItems().length === 0) {
      this.toast.warning('Empty Document', 'Please add at least 1 item.');
      return;
    }

    this.submitting = true;
    const payload = {
      documentType: this.docType,
      partyType: this.partyType,
      partyId: this.selectedPartyId || undefined,
      partyName: this.partyName,
      partyMobile: this.partyMobile,
      partyGstin: this.partyGstin,
      partyAddress: this.partyAddress,
      validUntil: this.validUntilDate || undefined,
      items: this.docItems(),
      subtotal: this.subtotal,
      totalDiscount: this.totalDiscount,
      totalGst: this.totalGst,
      grandTotal: this.grandTotal,
      amountPaid: this.amountPaid,
      paymentMethod: this.paymentMethod,
      notes: this.docNotes,
      termsConditions: this.termsConditions
    };

    this.api.post<any>('/documents', payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showCreateModal = false;
        this.toast.success('Saved', `${this.getDocTitle(this.docType)} saved successfully!`);
        this.loadDocuments();
        if (res.data) {
          this.openViewModal(res.data);
        }
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Failed', err.error?.message || 'Failed to save document.');
      }
    });
  }

  openViewModal(doc: any) {
    this.selectedDoc.set(doc);
    this.showViewModal.set(true);
  }

  printDocument() {
    window.print();
  }

  convertDoc(doc: any) {
    const target = doc.documentType === 'PURCHASE_ORDER' ? 'Purchase Invoice' : 'Sale Invoice';
    if (!confirm(`Are you sure you want to convert ${doc.documentNumber} to a ${target}? This will update product stock automatically.`)) {
      return;
    }

    this.api.post<any>(`/documents/${doc._id}/convert`, {}).subscribe({
      next: (res) => {
        this.toast.success('Converted', res.message);
        this.loadDocuments();
        if (this.showViewModal()) {
          this.showViewModal.set(false);
        }
      },
      error: (err) => {
        this.toast.error('Conversion Error', err.error?.message || 'Failed to convert document.');
      }
    });
  }

  deleteDoc(doc: any) {
    if (!confirm(`Delete ${doc.documentNumber}? This action cannot be undone.`)) return;
    this.api.delete<any>(`/documents/${doc._id}`).subscribe({
      next: () => {
        this.toast.success('Deleted', 'Document deleted.');
        this.loadDocuments();
      },
      error: (err) => this.toast.error('Error', err.error?.message || 'Failed to delete.')
    });
  }

  getDocTitle(type: string): string {
    switch (type) {
      case 'PURCHASE_ORDER': return 'Purchase Order (खरीद आर्डर)';
      case 'QUOTATION': return 'Quotation / Estimate (कोटेशन व कच्चा बिल)';
      case 'DELIVERY_CHALLAN': return 'Delivery Challan (डिलीवरी चालान)';
      case 'SALES_RETURN': return 'Sales Return / Credit Note (सेल रिटर्न)';
      case 'PURCHASE_RETURN': return 'Purchase Return / Debit Note (परचेज रिटर्न)';
      case 'SALE_INVOICE': return 'Sale Invoice (बिक्री बिल)';
      case 'PURCHASE_INVOICE': return 'Purchase Invoice (खरीद बिल)';
      default: return type;
    }
  }

  getDocBadgeClass(type: string): string {
    switch (type) {
      case 'PURCHASE_ORDER': return 'badge-info';
      case 'QUOTATION': return 'badge-warning';
      case 'DELIVERY_CHALLAN': return 'badge-secondary';
      case 'SALES_RETURN': return 'badge-danger';
      case 'PURCHASE_RETURN': return 'badge-purple';
      case 'SALE_INVOICE': return 'badge-success';
      case 'PURCHASE_INVOICE': return 'badge-primary';
      default: return 'badge-neutral';
    }
  }
}
