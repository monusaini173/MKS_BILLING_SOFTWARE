import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { FaceAuthService } from '../../core/services/face-auth.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';
import { FaceLockModalComponent } from '../../shared/components/face-lock-modal/face-lock-modal.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule, FormsModule, FaceLockModalComponent],
  templateUrl: './admin-layout.component.html'
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  faceService = inject(FaceAuthService);
  lang = inject(LanguageService);
  router = inject(Router);
  toast = inject(ToastService);

  sidebarCollapsed = signal(false);
  mobileSidebarOpen = signal(false);
  profileDropdownOpen = signal(false);
  showEnrollModal = signal(false);

  liveTime = signal('');
  liveDate = signal('');
  private clockTimer: any;

  navItems = [
    { path: '/admin/dashboard', icon: 'fa-solid fa-gauge-high', label: 'Dashboard', labelHindi: 'डैशबोर्ड' },
    { path: '/admin/shops', icon: 'fa-solid fa-store', label: 'Shop Management', labelHindi: 'दुकानें (Shops)' },
    { path: '/admin/shop-types', icon: 'fa-solid fa-tags', label: 'Shop Types', labelHindi: 'दुकान प्रकार (Types)' },
    { path: '/admin/subscriptions', icon: 'fa-solid fa-crown', label: 'Subscriptions', labelHindi: 'सब्सक्रिप्शन' },
    { path: '/admin/users', icon: 'fa-solid fa-users-gear', label: 'Users & Staff', labelHindi: 'यूज़र्स व स्टाफ' },
    { path: '/admin/reports', icon: 'fa-solid fa-chart-line', label: 'Platform Reports', labelHindi: 'प्लेटफॉर्म रिपोर्ट्स' },
    { path: '/admin/settings', icon: 'fa-solid fa-gears', label: 'System Settings', labelHindi: 'सिस्टम सेटिंग्स' },
  ];

  ngOnInit() {
    this.updateClock();
    this.clockTimer = setInterval(() => this.updateClock(), 1000);

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.mobileSidebarOpen.set(false);
      }
    });
  }

  ngOnDestroy() {
    if (this.clockTimer) clearInterval(this.clockTimer);
  }

  private updateClock() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = now.toLocaleString('en-IN', { month: 'short' });
    const year = now.getFullYear();
    this.liveDate.set(`${day} ${month} ${year}`);
    this.liveTime.set(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
  }

  toggleSidebar() {
    this.sidebarCollapsed.update(val => !val);
  }

  toggleMobileSidebar() {
    this.mobileSidebarOpen.update(val => !val);
  }

  toggleProfileDropdown() {
    this.profileDropdownOpen.update(val => !val);
  }

  toggleLang() {
    this.lang.toggleLanguage();
  }

  lockScreen() {
    this.faceService.lockAdminScreen();
    this.profileDropdownOpen.set(false);
  }

  openFaceEnrollment() {
    this.showEnrollModal.set(true);
    this.profileDropdownOpen.set(false);
  }

  logout() {
    this.auth.logout();
  }
}
