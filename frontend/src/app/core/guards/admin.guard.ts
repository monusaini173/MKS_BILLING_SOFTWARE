import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AdminSecurityService } from '../services/admin-security.service';
import { ToastService } from '../services/toast.service';

export const adminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const adminSecurity = inject(AdminSecurityService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const user = auth.currentUser();
  const token = auth.getAccessToken();

  if (!token) {
    return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: state.url } });
  }

  if (user?.role === 'SUPER_ADMIN') {
    return true;
  }

  // If user is not super admin, redirect to login
  toast.warning('Admin Login Required', 'Super Admin Console access karne ke liye Admin ID se Login karein.');
  auth.logout();
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl: '/admin/dashboard' } });
};
