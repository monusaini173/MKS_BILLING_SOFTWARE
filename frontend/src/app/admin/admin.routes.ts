import { Routes } from '@angular/router';
import { adminGuard } from '../core/guards/admin.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./admin-dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent),
        title: 'MKS Owner Console - Dashboard'
      },
      {
        path: 'shops',
        loadComponent: () => import('./admin-shops/admin-shops.component').then(m => m.AdminShopsComponent),
        title: 'MKS Owner Console - Shop Management'
      },
      {
        path: 'shop-types',
        loadComponent: () => import('./admin-shop-types/admin-shop-types.component').then(m => m.AdminShopTypesComponent),
        title: 'MKS Owner Console - Shop Types'
      },
      {
        path: 'subscriptions',
        loadComponent: () => import('./admin-subscriptions/admin-subscriptions.component').then(m => m.AdminSubscriptionsComponent),
        title: 'MKS Owner Console - Subscriptions'
      },
      {
        path: 'users',
        loadComponent: () => import('./admin-users/admin-users.component').then(m => m.AdminUsersComponent),
        title: 'MKS Owner Console - Users & Staff'
      },
      {
        path: 'reports',
        loadComponent: () => import('./admin-reports/admin-reports.component').then(m => m.AdminReportsComponent),
        title: 'MKS Owner Console - Platform Reports'
      },
      {
        path: 'settings',
        loadComponent: () => import('./admin-settings/admin-settings.component').then(m => m.AdminSettingsComponent),
        title: 'MKS Owner Console - System Settings'
      }
    ]
  }
];
