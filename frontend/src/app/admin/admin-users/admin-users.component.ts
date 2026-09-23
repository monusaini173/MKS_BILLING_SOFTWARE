import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './admin-users.component.html'
})
export class AdminUsersComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  users = signal<any[]>([]);
  shops = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  searchText = '';
  selectedRole = 'ALL';
  selectedStatus = 'ALL';
  page = 1;
  totalPages = 1;
  totalRecords = 0;

  showPasswordModal = false;
  showAddModal = false;
  showPasswordInModal = false;
  selectedUser: any = null;
  resetPasswordForm!: FormGroup;
  userForm!: FormGroup;

  ngOnInit() {
    this.initForms();
    this.loadUsers();
    this.loadShops();
  }

  initForms() {
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(4)]]
    });

    this.userForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required]],
      mobile: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['EMPLOYEE', Validators.required],
      shopId: ['']
    });
  }

  loadShops() {
    this.api.get<any>('/admin/shops', { limit: 100 }).subscribe({
      next: (res) => {
        if (res.success) {
          this.shops.set(res.data || []);
        }
      }
    });
  }

  loadUsers() {
    this.loading.set(true);
    const params: any = {
      page: this.page,
      limit: 25
    };

    if (this.searchText.trim()) params.search = this.searchText.trim();
    if (this.selectedRole !== 'ALL') params.role = this.selectedRole;
    if (this.selectedStatus !== 'ALL') params.status = this.selectedStatus;

    this.api.get<any>('/admin/users', params).subscribe({
      next: (res) => {
        if (res.success) {
          this.users.set(res.data || []);
          this.totalPages = res.pagination?.totalPages || 1;
          this.totalRecords = res.pagination?.total || 0;
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'यूज़र्स लोड नहीं हो सके।');
        this.loading.set(false);
      }
    });
  }

  onFilter() {
    this.page = 1;
    this.loadUsers();
  }

  openAddModal() {
    this.userForm.reset({
      name: '',
      email: '',
      mobile: '',
      password: '',
      role: 'EMPLOYEE',
      shopId: this.shops().length > 0 ? this.shops()[0]._id : ''
    });
    this.showPasswordInModal = false;
    this.showAddModal = true;
  }

  submitCreateUser() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.toast.warning('अधूरा फॉर्म', 'कृपया नाम, ईमेल, मोबाइल और पासवर्ड भरें।');
      return;
    }

    this.submitting = true;
    this.api.post<any>('/admin/users', this.userForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showAddModal = false;
        this.toast.success('यूजर तैयार', res.message || 'नया यूजर / स्टाफ सफलतापूर्वक जोड़ दिया गया।');
        this.loadUsers();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Error', err.error?.message || 'यूजर नहीं बनाया जा सका।');
      }
    });
  }

  toggleUser(user: any) {
    if (user.role === 'SUPER_ADMIN') {
      this.toast.warning('Not Allowed', 'Super admin accounts cannot be blocked.');
      return;
    }
    const action = user.isActive ? 'Block' : 'Unblock';
    if (!confirm(`Are you sure you want to ${action} user "${user.name}"?`)) return;

    this.api.put<any>(`/admin/users/${user._id}/toggle`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('Updated', res.message);
          this.loadUsers();
        }
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'Action failed.');
      }
    });
  }

  deleteUser(user: any) {
    if (user.role === 'SUPER_ADMIN') {
      this.toast.warning('Not Allowed', 'Super admin accounts cannot be deleted.');
      return;
    }
    if (!confirm(`Kya aap sach me user "${user.name}" (${user.email}) ko delete karna chahte hain?`)) return;

    this.api.delete<any>(`/admin/users/${user._id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('Deleted', res.message);
          this.loadUsers();
        }
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'User delete nahi ho saka.');
      }
    });
  }

  openPasswordModal(user: any) {
    this.selectedUser = user;
    this.resetPasswordForm.reset({ newPassword: '' });
    this.showPasswordModal = true;
  }

  submitPasswordReset() {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.api.put<any>(`/admin/users/${this.selectedUser._id}/reset-password`, this.resetPasswordForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.showPasswordModal = false;
        this.toast.success('पासवर्ड रीसेट सफल', res.message);
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error('Error', err.error?.message || 'पासवर्ड रीसेट नहीं हो सका।');
      }
    });
  }
}
