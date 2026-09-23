import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-expense-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './expense-report.component.html'
})
export class ExpenseReportComponent implements OnInit {
  private api = inject(ApiService);

  expenses = signal<any[]>([]);
  byCategory = signal<any[]>([]);
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

    this.api.get<any>('/reports/expenses', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.expenses.set(res.data.expenses || []);
          this.byCategory.set(res.data.byCategory || []);
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
