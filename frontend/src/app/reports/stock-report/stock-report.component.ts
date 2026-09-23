import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-stock-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-report.component.html'
})
export class StockReportComponent implements OnInit {
  private api = inject(ApiService);

  products = signal<any[]>([]);
  stockValue = signal(0);
  loading = signal(true);

  lowStockOnly = false;

  ngOnInit() {
    this.loadReport();
  }

  loadReport() {
    this.loading.set(true);
    const params: any = {};
    if (this.lowStockOnly) {
      params.lowStock = 'true';
    }

    this.api.get<any>('/reports/stock', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.products.set(res.data.products || []);
          this.stockValue.set(res.data.stockValue || 0);
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
