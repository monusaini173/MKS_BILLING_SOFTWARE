import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-product-public-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './product-public-view.component.html',
  styleUrls: ['./product-public-view.component.css']
})
export class ProductPublicViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);

  product = signal<any | null>(null);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);
  qrDataUrl = signal<string>('');
  upiPayQrUrl = signal<string>('');
  copied = signal<boolean>(false);
  activeTab = signal<'SPECS' | 'PAY_UPI'>('SPECS');

  ngOnInit() {
    this.route.params.subscribe(params => {
      const code = params['code'] || params['id'];
      if (code) {
        this.fetchProduct(code);
      } else {
        this.error.set('कोई बारकोड या प्रोडक्ट आईडी नहीं मिली।');
        this.loading.set(false);
      }
    });
  }

  fetchProduct(code: string) {
    this.loading.set(true);
    this.error.set(null);

    // Call public product endpoint through ApiService
    this.api.get<any>(`/products/public/${encodeURIComponent(code)}`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.product.set(res.data);
          this.generateQR();
          this.generateUpiPaymentQr(res.data);
        } else {
          this.error.set(res.message || 'प्रोडक्ट की जानकारी नहीं मिली।');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'प्रोडक्ट लोड करने में असमर्थ। कृपया दोबारा स्कैन करें।');
        this.loading.set(false);
      }
    });
  }

  generateUpiPaymentQr(prod: any) {
    try {
      const shop = prod.shopId || {};
      const upiId = shop.upiId || (shop.mobile ? `${shop.mobile}@ibl` : '');
      const payeeName = shop.upiName || shop.ownerName || shop.name || 'Store Pay';
      const amount = prod.sellingPrice || 0;
      const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Buy ' + prod.name)}`;
      
      QRCode.toDataURL(upiUrl, {
        width: 240,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      }).then(url => {
        this.upiPayQrUrl.set(url);
      });
    } catch (e) {
      console.error('UPI QR error:', e);
    }
  }

  generateQR() {
    try {
      const currentUrl = window.location.href;
      QRCode.toDataURL(currentUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }).then(url => {
        this.qrDataUrl.set(url);
      });
    } catch (e) {
      console.error('QR code generation error:', e);
    }
  }

  getDiscountPercent(mrp?: number, price?: number): number {
    if (!mrp || !price || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  }

  getSavings(mrp?: number, price?: number): number {
    if (!mrp || !price || mrp <= price) return 0;
    return Math.round(mrp - price);
  }

  openWhatsAppInquiry() {
    const prod = this.product();
    if (!prod) return;

    const shop = prod.shopId || {};
    let mobile = (shop.mobile || '').toString().replace(/\D/g, '');
    if (!mobile) return;
    if (mobile.length === 10) mobile = '91' + mobile;

    const mrpStr = prod.mrp ? ` (MRP: ₹${prod.mrp})` : '';
    const priceStr = `₹${prod.sellingPrice}`;
    const text = `नमस्ते *${shop.name || 'दुकानदार'}*, मुझे आपके इस प्रोडक्ट के बारे में जानकारी / ऑर्डर चाहिए:\n\n🛍️ *प्रोडक्ट:* ${prod.name}\n💰 *रेट:* ${priceStr}${mrpStr}\n🏷️ *बारकोड:* ${prod.barcode || 'N/A'}\n\nक्या यह आइटम अभी उपलब्ध है?`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?phone=${mobile}&text=${encoded}`, '_blank');
  }

  callShop() {
    const prod = this.product();
    const phone = prod?.shopId?.mobile;
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }

  shareProduct() {
    const prod = this.product();
    if (navigator.share && prod) {
      navigator.share({
        title: prod.name,
        text: `Check out ${prod.name} for ₹${prod.sellingPrice} at ${prod.shopId?.name || 'our shop'}!`,
        url: window.location.href
      }).catch(() => {});
    } else {
      this.copyLink();
    }
  }

  copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }
}
