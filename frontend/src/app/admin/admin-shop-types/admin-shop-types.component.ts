import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { LanguageService } from '../../core/services/language.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-admin-shop-types',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-shop-types.component.html'
})
export class AdminShopTypesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  shopTypes = signal<any[]>([]);
  loading = signal(true);
  submitting = false;

  showModal = false;
  editMode = false;
  selectedShopType: any = null;
  shopTypeForm!: FormGroup;

  ngOnInit() {
    this.initForm();
    this.loadShopTypes();
  }

  initForm() {
    this.shopTypeForm = this.fb.group({
      key: ['', [Validators.required]],
      label: ['', Validators.required],
      labelHindi: ['', Validators.required],
      emoji: ['🏬'],
      icon: ['fa-solid fa-store'],
      accentColor: ['#4f46e5'],
      accentBg: ['#eef2ff'],
      description: [''],
      defaultCategoriesStr: ['']
    });
  }

  loadShopTypes() {
    this.loading.set(true);
    this.api.get<any>('/admin/shop-types').subscribe({
      next: (res) => {
        if (res.success) {
          this.shopTypes.set(res.data || []);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'दुकान प्रकार लोड नहीं हो सके।');
        this.loading.set(false);
      }
    });
  }

  openAddModal() {
    this.editMode = false;
    this.selectedShopType = null;
    this.shopTypeForm.reset({
      key: '',
      label: '',
      labelHindi: '',
      emoji: '🏬',
      icon: 'fa-solid fa-store',
      accentColor: '#4f46e5',
      accentBg: '#eef2ff',
      description: '',
      defaultCategoriesStr: ''
    });
    this.showModal = true;
  }

  openEditModal(st: any) {
    this.editMode = true;
    this.selectedShopType = st;
    this.shopTypeForm.patchValue({
      key: st.key,
      label: st.label,
      labelHindi: st.labelHindi,
      emoji: st.emoji || '🏬',
      icon: st.icon || 'fa-solid fa-store',
      accentColor: st.accentColor || '#4f46e5',
      accentBg: st.accentBg || '#eef2ff',
      description: st.description || '',
      defaultCategoriesStr: (st.defaultCategories || []).join(', ')
    });
    this.showModal = true;
  }

  setEmoji(emojiChar: string) {
    this.shopTypeForm.patchValue({ emoji: emojiChar });
  }

  onSubmit() {
    if (this.shopTypeForm.invalid) {
      this.shopTypeForm.markAllAsTouched();
      this.toast.warning('अधूरा फॉर्म', 'कृपया यूनिक कोड (Key), हिन्दी नाम और अंग्रेज़ी नाम भरें।');
      return;
    }

    this.submitting = true;
    const formVal = this.shopTypeForm.value;
    const rawKey = (formVal.key || '').trim().toUpperCase().replace(/[\s-]+/g, '_').replace(/[^A-Z0-9_]/g, '');
    
    if (!rawKey) {
      this.submitting = false;
      this.toast.warning('अमान्य कोड', 'कृपया एक मान्य यूनिक कोड दर्ज करें (जैसे: DAIRY या BAKERY)');
      return;
    }

    const defaultCategories = formVal.defaultCategoriesStr
      ? formVal.defaultCategoriesStr.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];

    const payload = {
      key: rawKey,
      label: (formVal.label || '').trim(),
      labelHindi: (formVal.labelHindi || '').trim(),
      emoji: (formVal.emoji || '🏬').trim(),
      icon: (formVal.icon || 'fa-solid fa-store').trim(),
      accentColor: formVal.accentColor || '#4f46e5',
      accentBg: formVal.accentBg || '#eef2ff',
      description: (formVal.description || '').trim(),
      defaultCategories
    };

    if (this.editMode) {
      this.api.put<any>(`/admin/shop-types/${this.selectedShopType._id}`, payload).subscribe({
        next: (res) => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('Updated', 'दुकान प्रकार सफलतापूर्वक अपडेट हो गया।');
          this.loadShopTypes();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('Error', err.error?.message || 'अपडेट नहीं हो सका।');
        }
      });
    } else {
      this.api.post<any>('/admin/shop-types', payload).subscribe({
        next: (res) => {
          this.submitting = false;
          this.showModal = false;
          this.toast.success('Created', 'नया दुकान प्रकार सफलतापूर्वक जुड़ गया।');
          this.loadShopTypes();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error('Error', err.error?.message || 'नया दुकान प्रकार नहीं बन सका।');
        }
      });
    }
  }

  deleteShopType(st: any) {
    if (st.isSystem) {
      this.toast.warning('सिस्टम डिफॉल्ट', 'डिफॉल्ट दुकान प्रकार को हटाया नहीं जा सकता।');
      return;
    }
    if (!confirm(`क्या आप "${st.label}" दुकान प्रकार को हटाना चाहते हैं?`)) return;

    this.api.delete<any>(`/admin/shop-types/${st._id}`).subscribe({
      next: () => {
        this.toast.success('Deleted', 'दुकान प्रकार हटा दिया गया।');
        this.loadShopTypes();
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'हटाया नहीं जा सका।');
      }
    });
  }
}
