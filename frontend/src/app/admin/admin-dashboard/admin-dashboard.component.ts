import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.component.html'
})
export class AdminDashboardComponent implements OnInit {
  private api = inject(ApiService);
  public auth = inject(AuthService);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  loading = signal(true);
  stats = signal<any>(null);

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loading.set(true);
    this.api.get<any>('/admin/stats').subscribe({
      next: (res) => {
        if (res.success) {
          this.stats.set(res.data);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'डैशबोर्ड डेटा लोड नहीं हो सका।');
        this.loading.set(false);
      }
    });
  }

  // Quick Extend Subscription by 30 days
  extendSubscription(shopId: string, shopName: string) {
    if (!confirm(`क्या आप "${shopName}" का सब्सक्रिप्शन 30 दिन बढ़ाना चाहते हैं?`)) return;

    this.api.put<any>(`/admin/shops/${shopId}/subscription`, { addDays: 30 }).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('सब्सक्रिप्शन बढ़ा दिया गया', `${shopName} को 30 अतिरिक्त दिन दिए गए।`);
          this.loadStats();
        }
      },
      error: (err) => {
        this.toast.error('त्रुटि', err.error?.message || 'सब्सक्रिप्शन बढ़ाने में समस्या हुई।');
      }
    });
  }

  // 1-Click Shop Impersonation
  impersonate(shopId: string) {
    this.auth.impersonateShop(shopId);
  }
}
