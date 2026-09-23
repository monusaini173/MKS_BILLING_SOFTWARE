import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { roleGuard } from './core/guards/role.guard';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },

  // Auth
  {
    path: 'auth/login',
    component: LoginComponent,
  },
  {
    path: 'auth/register',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  },
  // Public Product Info View (Google Lens / QR Scan Destination)
  {
    path: 'p/:code',
    loadComponent: () => import('./products/product-public-view/product-public-view.component').then(m => m.ProductPublicViewComponent),
  },
  {
    path: 'product/:code',
    loadComponent: () => import('./products/product-public-view/product-public-view.component').then(m => m.ProductPublicViewComponent),
  },

  // Super Admin Platform Owner Console
  {
    path: 'admin',
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    loadChildren: () => import('./admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },

  // Main App (requires auth)
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shared/layout/layout.component').then(m => m.LayoutComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'billing', loadComponent: () => import('./billing/billing.component').then(m => m.BillingComponent) },
      { path: 'billing/:id/invoice', loadComponent: () => import('./billing/invoice/invoice.component').then(m => m.InvoiceComponent) },
      { path: 'documents', loadComponent: () => import('./documents/documents.component').then(m => m.DocumentsComponent) },
      { path: 'documents/purchase-orders', loadComponent: () => import('./documents/documents.component').then(m => m.DocumentsComponent) },
      { path: 'documents/quotations', loadComponent: () => import('./documents/documents.component').then(m => m.DocumentsComponent) },
      { path: 'documents/delivery-challans', loadComponent: () => import('./documents/documents.component').then(m => m.DocumentsComponent) },
      { path: 'documents/returns', loadComponent: () => import('./documents/documents.component').then(m => m.DocumentsComponent) },
      { path: 'products', loadComponent: () => import('./products/products.component').then(m => m.ProductsComponent) },
      { path: 'products/barcode-printer', loadComponent: () => import('./products/barcode-printer/barcode-printer.component').then(m => m.BarcodePrinterComponent) },
      { path: 'inventory', loadComponent: () => import('./inventory/inventory.component').then(m => m.InventoryComponent) },
      { path: 'staff', loadComponent: () => import('./staff/staff.component').then(m => m.StaffComponent) },
      { path: 'customers', loadComponent: () => import('./customers/customers.component').then(m => m.CustomersComponent) },
      { path: 'customers/:id', loadComponent: () => import('./customers/customer-detail/customer-detail.component').then(m => m.CustomerDetailComponent) },
      { path: 'suppliers', loadComponent: () => import('./suppliers/suppliers.component').then(m => m.SuppliersComponent) },
      { path: 'suppliers/:id', loadComponent: () => import('./suppliers/supplier-detail/supplier-detail.component').then(m => m.SupplierDetailComponent) },
      { path: 'purchases', loadComponent: () => import('./purchases/purchases.component').then(m => m.PurchasesComponent) },
      { path: 'expenses', loadComponent: () => import('./expenses/expenses.component').then(m => m.ExpensesComponent) },
      { path: 'payments', loadComponent: () => import('./payments/payment-history.component').then(m => m.PaymentHistoryComponent) },
      { path: 'reports', loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'reports/payments', loadComponent: () => import('./payments/payment-history.component').then(m => m.PaymentHistoryComponent) },
      { path: 'reports/sales', loadComponent: () => import('./reports/sales-report/sales-report.component').then(m => m.SalesReportComponent) },
      { path: 'reports/purchases', loadComponent: () => import('./reports/purchase-report/purchase-report.component').then(m => m.PurchaseReportComponent) },
      { path: 'reports/profit', loadComponent: () => import('./reports/profit-report/profit-report.component').then(m => m.ProfitReportComponent) },
      { path: 'reports/gst', loadComponent: () => import('./reports/gst-report/gst-report.component').then(m => m.GstReportComponent) },
      { path: 'reports/ca', loadComponent: () => import('./reports/ca-report/ca-report.component').then(m => m.CaReportComponent) },
      { path: 'reports/ca-monthly', loadComponent: () => import('./reports/ca-report/ca-report.component').then(m => m.CaReportComponent) },
      { path: 'reports/stock', loadComponent: () => import('./reports/stock-report/stock-report.component').then(m => m.StockReportComponent) },
      { path: 'reports/expenses', loadComponent: () => import('./reports/expense-report/expense-report.component').then(m => m.ExpenseReportComponent) },
      { path: 'marketing', loadComponent: () => import('./marketing/marketing-studio.component').then(m => m.MarketingStudioComponent) },
      { path: 'settings', loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent) },
    ],
  },

  { path: '**', redirectTo: '/auth/login' },
];

