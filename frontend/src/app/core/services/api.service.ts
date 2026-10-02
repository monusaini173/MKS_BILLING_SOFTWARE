import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  public getApiBaseUrl(): string {
    // 1. User/Admin configured custom API URL in localStorage
    const customUrl = localStorage.getItem('MKS_API_URL');
    if (customUrl && customUrl.trim()) {
      let clean = customUrl.trim().replace(/\/+$/, '');
      if (!clean.endsWith('/api')) clean += '/api';
      return clean;
    }

    // 2. Check current browser hostname for local development
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname || 'localhost';
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return `http://${hostname}:5000/api`;
      }
    }

    // 3. Fallback for Vercel / Production environment (Render API)
    const renderBackend = localStorage.getItem('RENDER_BACKEND_URL') || 'https://mks-billing-software.onrender.com/api';
    let cleanRender = renderBackend.trim().replace(/\/+$/, '');
    if (!cleanRender.endsWith('/api')) cleanRender += '/api';
    return cleanRender;
  }

  public setApiBaseUrl(url: string): void {
    if (url && url.trim()) {
      let clean = url.trim().replace(/\/+$/, '');
      if (!clean.endsWith('/api')) clean += '/api';
      localStorage.setItem('MKS_API_URL', clean);
    } else {
      localStorage.removeItem('MKS_API_URL');
    }
  }

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders();
    const token = sessionStorage.getItem('mks_access_token') || localStorage.getItem('mks_access_token');
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  get<T>(path: string, params: any = {}): Observable<T> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get<T>(`${this.getApiBaseUrl()}${path}`, { headers: this.getHeaders(), params: httpParams });
  }

  post<T>(path: string, body: any = {}): Observable<T> {
    return this.http.post<T>(`${this.getApiBaseUrl()}${path}`, body, { headers: this.getHeaders() });
  }

  put<T>(path: string, body: any = {}): Observable<T> {
    return this.http.put<T>(`${this.getApiBaseUrl()}${path}`, body, { headers: this.getHeaders() });
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.getApiBaseUrl()}${path}`, { headers: this.getHeaders() });
  }

  getBlob(path: string, params: any = {}): Observable<Blob> {
    let httpParams = new HttpParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        httpParams = httpParams.set(key, params[key]);
      }
    });
    return this.http.get(`${this.getApiBaseUrl()}${path}`, {
      headers: this.getHeaders(),
      params: httpParams,
      responseType: 'blob'
    });
  }
}
