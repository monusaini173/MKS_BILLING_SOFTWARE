import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.component.html'
})
export class AdminReportsComponent implements OnInit {
  private api = inject(ApiService);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  loading = signal(true);
  selectedRange = 'MONTH';
  reportData = signal<any>(null);

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    this.loading.set(true);
    this.api.get<any>('/admin/reports', { range: this.selectedRange }).subscribe({
      next: (res) => {
        if (res.success) {
          this.reportData.set(res.data);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'रिपोर्ट्स लोड नहीं हो सकीं।');
        this.loading.set(false);
      }
    });
  }
}
