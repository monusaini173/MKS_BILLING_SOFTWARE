import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import * as QRCode from 'qrcode';

export interface BarcodeItem {
  product: any;
  quantity: number;
}

@Component({
  selector: 'app-barcode-printer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './barcode-printer.component.html',
  styleUrls: ['./barcode-printer.component.css']
})
export class BarcodePrinterComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  shop = this.auth.currentShop;
  products = signal<any[]>([]);
  loading = signal<boolean>(true);
  searchTerm = signal<string>('');

  // Selected items to print
  selectedItems = signal<BarcodeItem[]>([]);

  // Label configuration
  stickerMode = signal<'HYBRID' | 'LENS_QR' | 'BARCODE_1D'>('HYBRID'); // Hybrid = Barcode + Google Lens QR
  labelSize = signal<'50x25' | '38x25' | 'a4_24'>('50x25');
  showShopName = signal<boolean>(true);
  showProductName = signal<boolean>(true);
  showMrp = signal<boolean>(true);
  showOurPrice = signal<boolean>(true);
  showVariant = signal<boolean>(true);
  customShopName = signal<string>('');
  
  // Cache of QR codes for fast printing
  qrCodeMap = signal<{ [key: string]: string }>({});

  filteredProducts = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.products();
    return this.products().filter(p => 
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.barcode && p.barcode.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  totalStickersCount = computed(() => {
    return this.selectedItems().reduce((sum, item) => sum + (item.quantity || 0), 0);
  });

  // Flattened stickers list for preview & printing
  flattenedStickers = computed(() => {
    const stickers: any[] = [];
    for (const item of this.selectedItems()) {
      for (let i = 0; i < (item.quantity || 1); i++) {
        stickers.push(item.product);
      }
    }
    return stickers;
  });

  ngOnInit() {
    this.customShopName.set(this.shop()?.name || 'MKS STORE');
    this.loadProducts();
  }

  loadProducts() {
    this.loading.set(true);
    this.api.get<any>('/products?limit=1000').subscribe({
      next: (res) => {
        if (res.success) {
          const list = res.data || [];
          this.products.set(list);
          // Pre-generate QR for top products
          list.slice(0, 30).forEach((p: any) => this.generateQrForProduct(p));
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'प्रोडक्ट्स लोड नहीं हो सके।');
      }
    });
  }

  getProductLensUrl(product: any): string {
    const code = product.barcode || product._id;
    return `${window.location.origin}/p/${code}`;
  }

  generateQrForProduct(product: any) {
    const id = product._id;
    if (this.qrCodeMap()[id]) return;

    const url = this.getProductLensUrl(product);
    QRCode.toDataURL(url, {
      width: 180,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    }).then(qrData => {
      this.qrCodeMap.update(map => ({ ...map, [id]: qrData }));
    }).catch(err => {
      console.error('QR Gen error:', err);
    });
  }

  getQrCode(product: any): string {
    const id = product?._id;
    if (!id) return '';
    if (!this.qrCodeMap()[id]) {
      this.generateQrForProduct(product);
    }
    return this.qrCodeMap()[id] || '';
  }

  testGoogleLens(product: any, event?: MouseEvent) {
    if (event) event.stopPropagation();
    const url = this.getProductLensUrl(product);
    window.open(url, '_blank');
  }

  addToPrint(product: any) {
    this.generateQrForProduct(product);
    const current = [...this.selectedItems()];
    const index = current.findIndex(i => i.product._id === product._id);
    if (index > -1) {
      current[index].quantity += 1;
    } else {
      current.push({ product, quantity: 10 }); // Default 10 stickers
    }
    this.selectedItems.set(current);
    this.toast.info('Added', `${product.name} (10 स्टिकर) प्रिंट लिस्ट में जोड़ा गया।`);
  }

  addAllProducts() {
    this.products().forEach(p => this.generateQrForProduct(p));
    const all = this.products().map(p => ({ product: p, quantity: 5 }));
    this.selectedItems.set(all);
    this.toast.success('All Added', `सभी ${all.length} प्रोडक्ट्स प्रिंट लिस्ट में जोड़े गए।`);
  }

  removeItem(index: number) {
    const current = [...this.selectedItems()];
    current.splice(index, 1);
    this.selectedItems.set(current);
  }

  clearAll() {
    this.selectedItems.set([]);
  }

  printLabels() {
    if (this.flattenedStickers().length === 0) {
      this.toast.warning('No items', 'कृपया प्रिंट करने के लिए कम से कम एक प्रोडक्ट चुनें।');
      return;
    }
    window.print();
  }

  getBarcodeUrl(barcode: string): string {
    const code = barcode || '100000001';
    return `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(code)}&scale=2&height=10&includetext=true&textsize=10`;
  }
}
