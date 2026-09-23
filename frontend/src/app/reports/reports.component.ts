import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './reports.component.html'
})
export class ReportsComponent implements OnInit {
  private api = inject(ApiService);
  protected auth = inject(AuthService);
  private toast = inject(ToastService);

  downloading = signal<string>('');
  customStart = '';
  customEnd = '';

  // 👥 Customers Directory for Reports
  customers = signal<any[]>([]);
  customerSearch = signal<string>('');
  loadingCustomers = signal<boolean>(false);

  ngOnInit() {
    // Set default custom dates
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    this.customStart = monthStart;
    this.customEnd = today;

    this.loadCustomers();
  }

  loadCustomers() {
    this.loadingCustomers.set(true);
    this.api.get<any>('/customers', { limit: 1000 }).subscribe({
      next: (res) => {
        this.loadingCustomers.set(false);
        if (res.success) {
          this.customers.set(res.data || []);
        }
      },
      error: () => {
        this.loadingCustomers.set(false);
      }
    });
  }

  getAllCustomersWithRewards() {
    const list = [...this.customers()];
    // Sort descending by total purchases (or alphabetical if equal)
    list.sort((a, b) => (b.totalPurchases || 0) - (a.totalPurchases || 0));
    const q = this.customerSearch().toLowerCase().trim();
    if (!q) return list; // ALL customers without any limit
    return list.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.includes(q))
    );
  }

  getRewardBadge(c: any, index: number) {
    const total = c.totalPurchases || 0;
    if (index === 0 && total > 0) {
      return { rank: '🥇 #1 विजेता', label: 'प्रथम पुरस्कार (1st Prize)', badgeBg: '#fef3c7', badgeColor: '#92400e', icon: '🏆', gift: '₹500 बम्पर गिफ्ट वाउचर' };
    }
    if (index === 1 && total > 0) {
      return { rank: '🥈 #2 उपविजेता', label: 'द्वितीय पुरस्कार (2nd Prize)', badgeBg: '#f1f5f9', badgeColor: '#334155', icon: '🥈', gift: '₹250 स्पेशल डिस्काउंट' };
    }
    if (index === 2 && total > 0) {
      return { rank: '🥉 #3 स्थान', label: 'तृतीय पुरस्कार (3rd Prize)', badgeBg: '#ffedd5', badgeColor: '#9a3412', icon: '🥉', gift: '₹100 स्पेशल गिफ्ट' };
    }
    if (total >= 5000) {
      return { rank: `#${index + 1} गोल्ड ग्राहक`, label: 'गोल्ड रिवॉर्ड', badgeBg: '#fef9c3', badgeColor: '#854d0e', icon: '⭐', gift: '₹200 गोल्ड डिस्काउंट कूपन' };
    }
    if (total >= 2000) {
      return { rank: `#${index + 1} सिल्वर ग्राहक`, label: 'सिल्वर रिवॉर्ड', badgeBg: '#ede9fe', badgeColor: '#6b21a8', icon: '🎁', gift: '₹100 स्पेशल गिफ्ट' };
    }
    if (total >= 500) {
      return { rank: `#${index + 1} ब्रॉन्ज ग्राहक`, label: 'ब्रॉन्ज रिवॉर्ड', badgeBg: '#ecfdf5', badgeColor: '#065f46', icon: '🎁', gift: '₹50 डिस्काउंट वाउचर' };
    }
    return { rank: `#${index + 1} ग्राहक`, label: 'वेलकम रिवॉर्ड', badgeBg: '#f0fdf4', badgeColor: '#166534', icon: '🎁', gift: 'विशेष लॉयल्टी डिस्काउंट गिफ्ट' };
  }

  sendPrizeWhatsApp(c: any, index: number) {
    if (!c.mobile) {
      this.toast.warning('मोबाइल नंबर नहीं', 'इस ग्राहक का मोबाइल नंबर उपलब्ध नहीं है।');
      return;
    }
    const clean = c.mobile.replace(/\D/g, '');
    const phone = clean.length === 10 ? '91' + clean : clean;
    const shopName = this.auth.currentShop()?.name || 'MKS Store';
    const rewardInfo = this.getRewardBadge(c, index);
    const text = encodeURIComponent(`🎉 बधाई हो ${c.name} जी! 🎁\n\nआप *${shopName}* के सम्मानित ग्राहक हैं (क्रमांक: ${rewardInfo.rank})!\n\n🛍️ आपकी कुल खरीदारी: ₹${(c.totalPurchases || 0).toLocaleString('en-IN')}\n🎁 आपके लिए विशेष ईनाम/रिवॉर्ड: *${rewardInfo.gift}*\n\nकृपया दुकान पर पधारकर अपना ईनाम व डिस्काउंट प्राप्त करें!\n\nधन्यवाद! 🙏\n*${shopName}*`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  }

  downloadReport(period: string, type: 'sales' | 'purchases' = 'sales') {
    const key = `${period}_${type}`;
    this.downloading.set(key);

    let params: any = { period, type };
    if (period === 'custom') {
      if (!this.customStart || !this.customEnd) {
        this.toast.warning('Date Required', 'कृपया शुरू और अंत की तारीख चुनें।');
        this.downloading.set('');
        return;
      }
      params.startDate = this.customStart;
      params.endDate = this.customEnd;
    }

    // Build query string
    const queryStr = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`).join('&');
    const token = this.auth.getAccessToken() || sessionStorage.getItem('mks_access_token') || localStorage.getItem('mks_access_token') || '';
    const url = `http://localhost:5000/api/reports/download?${queryStr}`;

    const link = document.createElement('a');
    link.href = url;

    // Use fetch with auth header for download
    fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then(blob => {
        const periodLabels: any = { today: 'Today', '7days': '7-Day', '15days': '15-Day', month: 'Monthly', custom: 'Custom' };
        const typeLabel = type === 'sales' ? 'Sales' : 'Purchase';
        const filename = `${typeLabel}_Report_${periodLabels[period] || period}_${new Date().toISOString().slice(0,10)}.csv`;
        const url2 = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url2;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url2);
        this.toast.success('Download Ready!', `${typeLabel} report (${periodLabels[period]}) download ho gayi.`);
        this.downloading.set('');
      })
      .catch(err => {
        this.toast.error('Download Failed', 'Report download nahi ho saki. Please try again.');
        this.downloading.set('');
      });
  }

  isDownloading(period: string, type: string): boolean {
    return this.downloading() === `${period}_${type}`;
  }
}
