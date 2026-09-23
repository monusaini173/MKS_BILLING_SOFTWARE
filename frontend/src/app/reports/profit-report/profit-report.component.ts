import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-profit-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profit-report.component.html'
})
export class ProfitReportComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(true);
  profitData = signal<any>({
    totalSales: 0,
    totalPurchases: 0,
    totalExpenses: 0,
    grossProfit: 0,
    netProfit: 0
  });

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

    this.api.get<any>('/reports/profit', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.profitData.set(res.data);
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
