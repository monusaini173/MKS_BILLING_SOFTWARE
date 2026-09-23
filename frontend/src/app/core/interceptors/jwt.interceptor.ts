import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const token = authService.getAccessToken();
  const shop = authService.currentShop();
  const shopType = shop?.shopType;
  const shopId = shop?._id;

  let headersToSet: any = {};
  if (token) {
    headersToSet['Authorization'] = `Bearer ${token}`;
  }
  if (shopType) {
    headersToSet['X-Shop-Type'] = shopType;
  }
  if (shopId) {
    headersToSet['X-Shop-Id'] = shopId;
  }

  let authReq = req.clone({
    setHeaders: headersToSet
  });

  return next(authReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse) {
        // Shop is blocked or user deactivated by Admin
        if (error.status === 403 && (error.error?.code === 'SHOP_BLOCKED' || error.error?.code === 'ACCOUNT_DEACTIVATED')) {
          authService.clearTokens();
          toast.error('🚫 दुकान ब्लॉक है (Shop Blocked)', error.error?.message || 'आपकी दुकान एडमिन द्वारा ब्लॉक कर दी गई है।');
          router.navigate(['/auth/login']);
          return throwError(() => error);
        }

        if (error.status === 401) {
          // If the failed request was already login, register, or refresh, do not retry
          if (req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/refresh')) {
            return throwError(() => error);
          }

          const refreshToken = authService.getRefreshToken();
          if (!refreshToken) {
            authService.logout();
            return throwError(() => error);
          }

          // Attempt to refresh token
          return authService.refreshToken().pipe(
            switchMap((res) => {
              const newToken = res.data?.accessToken;
              if (!newToken) {
                authService.logout();
                return throwError(() => error);
              }
              const newAuthReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
              return next(newAuthReq);
            }),
            catchError((refreshErr) => {
              authService.logout();
              return throwError(() => refreshErr);
            })
          );
        }
      }
      return throwError(() => error);
    })
  );
};
