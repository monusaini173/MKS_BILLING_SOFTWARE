import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-purchase-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './purchase-report.component.html'
})
export class PurchaseReportComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);

  shop = this.auth.currentShop;
  purchases = signal<any[]>([]);
  summary = signal<any>({});
  loading = signal(true);

  filter = 'month';
  startDate = '';
  endDate = '';

  ngOnInit() {
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    const params: any = { filter: this.filter };
    if (this.filter === 'custom') {
      params.startDate = this.startDate;
      params.endDate = this.endDate;
    }

    this.api.get<any>('/reports/purchases', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.purchases.set(res.data.purchases || []);
          this.summary.set(res.data.summary || {});
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  printReport() {
    window.print();
  }
}
