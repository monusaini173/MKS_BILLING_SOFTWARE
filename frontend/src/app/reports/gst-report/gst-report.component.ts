import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-gst-report',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gst-report.component.html'
})
export class GstReportComponent implements OnInit {
  private api = inject(ApiService);

  gstSummary = signal<any>({});
  sales = signal<any[]>([]);
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

    this.api.get<any>('/reports/gst', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.gstSummary.set(res.data.gstSummary || {});
          this.sales.set(res.data.sales || []);
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
