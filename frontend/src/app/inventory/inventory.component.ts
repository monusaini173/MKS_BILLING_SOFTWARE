import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { LanguageService } from '../core/services/language.service';
import { getShopTypeConfig, ShopTypeConfig } from '../core/utils/shop-type-config';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private toast = inject(ToastService);
  public lang = inject(LanguageService);

  shop = this.auth.currentShop;
  shopConfig = computed<ShopTypeConfig>(() => getShopTypeConfig(this.shop()?.shopType));
  todayDateStr = new Date().toISOString().split('T')[0];

  products = signal<any[]>([]);
  loading = signal(true);
  submitting = false;
  bulkRestocking = signal(false);

  // Tabs: LOW_STOCK vs ALL vs EXPIRING
  activeTab = signal<'LOW_STOCK' | 'ALL' | 'EXPIRING'>('LOW_STOCK');

  // Search & Filter
  searchText = signal('');
  categoryFilter = signal('ALL');
  categories = signal<string[]>([]);

  // Adjust Modal
  showAdjustModal = false;
  selectedProduct: any = null;
  adjustForm!: FormGroup;

  // Quick Restock Preset Modal
  showQuickRestockModal = false;
  restockTargetProduct: any = null;
  quickAddQty = 50;

  // Computed low stock items
  lowStockProducts = computed(() => {
    return this.products().filter(p => p.quantity <= (p.minStockLevel || 5));
  });

  outOfStockProducts = computed(() => {
    return this.products().filter(p => p.quantity <= 0);
  });

  expiringProducts = computed(() => {
    const future90Days = new Date();
    future90Days.setDate(future90Days.getDate() + 90);
    return this.products().filter(p => p.expiryDate && new Date(p.expiryDate) <= future90Days);
  });

  isItemExpired(date: any): boolean {
    if (!date) return false;
    return new Date(date).getTime() < new Date().getTime();
  }

  // Filtered view based on tab and search
  displayedProducts = computed(() => {
    let list = this.activeTab() === 'LOW_STOCK' 
      ? this.lowStockProducts() 
      : this.activeTab() === 'EXPIRING' 
        ? this.expiringProducts() 
        : this.products();
    const query = this.searchText().toLowerCase().trim();
    const cat = this.categoryFilter();

    return list.filter(p => {
      const matchCat = cat === 'ALL' || p.category === cat;
      const matchText = !query || 
        p.name?.toLowerCase().includes(query) || 
        p.sku?.toLowerCase().includes(query) || 
        p.barcode?.includes(query) ||
        p.brand?.toLowerCase().includes(query);
      return matchCat && matchText;
    });
  });

  ngOnInit() {
    this.loadProducts();
    this.initForm();
  }

  initForm() {
    this.adjustForm = this.fb.group({
      quantity: [0, [Validators.required]],
      notes: ['Stock adjustment']
    });
  }

  loadProducts() {
    this.loading.set(true);
    this.api.get<any>('/products', { limit: 1000 }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.products.set(res.data);
          const cats = Array.from(new Set(res.data.map((p: any) => p.category).filter(Boolean))) as string[];
          this.categories.set(cats);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'इन्वेंटरी लोड नहीं हो सकी।');
      }
    });
  }

  openAdjustModal(prod: any) {
    this.selectedProduct = prod;
    this.adjustForm.patchValue({
      quantity: 0,
      notes: 'मैन्युअल स्टॉक सुधार'
    });
    this.showAdjustModal = true;
  }

  openQuickRestockModal(prod: any) {
    this.restockTargetProduct = prod;
    this.quickAddQty = Math.max(50, (prod.minStockLevel || 10) * 5);
    this.showQuickRestockModal = true;
  }

  // 1-Click Quick Restock for single item
  quickRestock(prod: any, addQty: number) {
    this.api.post<any>(`/products/${prod._id}/adjust-stock`, {
      quantity: addQty,
      notes: `Quick Restock (+${addQty} ${prod.unit || 'PCS'})`
    }).subscribe({
      next: (res) => {
        this.toast.success(
          'स्टॉक फुल हुआ', 
          `"${prod.name}" में +${addQty} स्टॉक जोड़ दिया गया। कुल नया स्टॉक: ${res.data?.quantity || (prod.quantity + addQty)}`
        );
        this.showQuickRestockModal = false;
        this.loadProducts();
      },
      error: (err) => {
        this.toast.error('Restock Failed', err.error?.message || 'स्टॉक अपडेट नहीं हो सका।');
      }
    });
  }

  // Bulk Full Restock All Low Stock Items
  fullRestockAllLowStock() {
    const lowCount = this.lowStockProducts().length;
    if (lowCount === 0) {
      this.toast.info('कोई कम स्टॉक नहीं', 'सभी प्रोडक्ट्स का स्टॉक पहले से पर्याप्त है!');
      return;
    }

    if (!confirm(`क्या आप सभी ${lowCount} कम स्टॉक वाले प्रोडक्ट्स का स्टॉक फुल (+50) करना चाहते हैं?`)) {
      return;
    }

    this.bulkRestocking.set(true);
    this.api.post<any>('/products/bulk-restock', { defaultAddQty: 50 }).subscribe({
      next: (res) => {
        this.bulkRestocking.set(false);
        this.toast.success('सभी स्टॉक फुल!', res.message || 'सभी कम स्टॉक प्रोडक्ट्स सफलतापूर्वक फुल कर दिए गए हैं।');
        this.loadProducts();
      },
      error: (err) => {
        this.bulkRestocking.set(false);
        this.toast.error('Bulk Restock Failed', err.error?.message || 'स्टॉक फुल नहीं हो सका।');
      }
    });
  }

  submitAdjustment() {
    if (this.adjustForm.invalid) {
      this.adjustForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const body = this.adjustForm.value;

    this.api.post<any>(`/products/${this.selectedProduct._id}/adjust-stock`, body).subscribe({
      next: () => {
        this.submitting = false;
        this.showAdjustModal = false;
        this.toast.success('स्टॉक अपडेट', 'स्टॉक मात्रा सफलतापूर्वक बदल दी गई है।');
        this.loadProducts();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Failed', err.error?.message || 'स्टॉक एडजस्ट नहीं हो सका।');
      }
    });
  }

  // 🏢 Inter-Branch Stock Transfer
  showTransferModal = signal<boolean>(false);
  transferProduct: any = null;
  transferTargetShopId = signal<string>('');
  transferQty = signal<number>(10);
  transferRemarks = signal<string>('');
  transferringStock = signal<boolean>(false);

  otherBranches = computed(() => {
    return this.auth.myShops().filter(s => s._id !== this.shop()?._id);
  });

  openTransferModal(product: any) {
    this.transferProduct = product;
    this.transferQty.set(Math.min(product.quantity || product.stock || 1, 10));
    this.transferRemarks.set(`Stock transfer of ${product.name}`);
    const branches = this.otherBranches();
    if (branches.length > 0) {
      this.transferTargetShopId.set(branches[0]._id);
    }
    this.showTransferModal.set(true);
  }

  submitTransfer() {
    if (!this.transferTargetShopId()) {
      this.toast.error('त्रुटि', 'कृपया प्राप्तकर्ता शाखा (Destination Branch) चुनें।');
      return;
    }

    const qty = Number(this.transferQty());
    const available = Number(this.transferProduct?.quantity || this.transferProduct?.stock || 0);

    if (!qty || qty <= 0) {
      this.toast.error('अमान्य मात्रा', 'कृपया मान्य ट्रांसफर मात्रा दर्ज करें।');
      return;
    }

    if (qty > available) {
      this.toast.error('अपरियाप्त स्टॉक', `वर्तमान में केवल ${available} पीस उपलब्ध हैं।`);
      return;
    }

    this.transferringStock.set(true);
    const payload = {
      toShopId: this.transferTargetShopId(),
      items: [
        {
          productId: this.transferProduct._id,
          quantity: qty
        }
      ],
      remarks: this.transferRemarks()
    };

    this.api.post<any>('/branches/transfer-stock', payload).subscribe({
      next: (res) => {
        this.transferringStock.set(false);
        this.showTransferModal.set(false);
        this.toast.success('स्टॉक ट्रांसफर सफल!', res.message || 'स्टॉक सफलतापूर्वक दूसरी शाखा में भेज दिया गया है।');
        this.loadProducts();
      },
      error: (err) => {
        this.transferringStock.set(false);
        this.toast.error('ट्रांसफर विफल', err.error?.message || 'स्टॉक ट्रांसफर नहीं हो सका।');
      }
    });
  }
}
