import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../core/services/api.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin.component.html'
})
export class AdminComponent implements OnInit {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  stats = signal<any>({
    totalShops: 0,
    activeShops: 0,
    inactiveShops: 0,
    totalUsers: 0,
    shopTypeStats: []
  });

  shops = signal<any[]>([]);
  loading = signal(true);

  ngOnInit() {
    this.loadStats();
    this.loadShops();
  }

  loadStats() {
    this.api.get<any>('/admin/stats').subscribe({
      next: (res) => {
        if (res.success) this.stats.set(res.data);
      }
    });
  }

  loadShops() {
    this.loading.set(true);
    this.api.get<any>('/admin/shops').subscribe({
      next: (res) => {
        if (res.success) this.shops.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  toggleShopActive(shop: any) {
    this.api.put<any>(`/admin/shops/${shop._id}/toggle`, {}).subscribe({
      next: () => {
        this.toast.success('Shop Updated', `Shop active status toggled successfully.`);
        this.loadShops();
        this.loadStats();
      }
    });
  }

  extendShopSubscription(shop: any, days: number, plan: string) {
    this.api.put<any>(`/admin/shops/${shop._id}/subscription`, { addDays: days, plan }).subscribe({
      next: (res) => {
        this.toast.success('Subscription Updated', `${shop.name} को +${days} दिन का प्लान (${plan}) सक्रिय किया गया।`);
        this.loadShops();
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'सब्सक्रिप्शन अपडेट करने में त्रुटि हुई।');
      }
    });
  }
}

