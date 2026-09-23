import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const user = authService.currentUser();
  const allowedRoles = route.data['roles'] as Array<string>;

  if (user && allowedRoles.includes(user.role)) {
    return true;
  }

  toast.error('Access Denied', 'You do not have permission to access this page.');
  return router.createUrlTree(['/dashboard']);
};
