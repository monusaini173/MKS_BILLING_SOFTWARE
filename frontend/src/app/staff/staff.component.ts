import { Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../core/services/api.service';
import { AuthService } from '../core/services/auth.service';
import { FaceAuthService } from '../core/services/face-auth.service';
import { LanguageService } from '../core/services/language.service';
import { ToastService } from '../core/services/toast.service';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './staff.component.html',
  styleUrls: ['./staff.component.css']
})
export class StaffComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  public auth = inject(AuthService);
  public faceAuth = inject(FaceAuthService);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);

  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasRef!: ElementRef<HTMLCanvasElement>;

  // Active View: 'ATTENDANCE' | 'STAFF_LIST'
  activeTab = signal<'ATTENDANCE' | 'STAFF_LIST'>('ATTENDANCE');

  staffList = signal<any[]>([]);
  loading = signal<boolean>(true);

  // Attendance Date
  selectedDate = signal<string>(new Date().toISOString().slice(0, 10));
  attendanceMap = signal<Record<string, any>>({});

  // Modals
  showAddStaffModal = signal<boolean>(false);
  showAdvanceModal = signal<boolean>(false);
  selectedStaffForAdvance = signal<any | null>(null);

  // 📱 Mobile / AI Face Scan Attendance Kiosk Modal
  showFaceModal = signal<boolean>(false);
  isFaceEnrollMode = signal<boolean>(false); // TRUE = Register Face, FALSE = Punch Attendance
  selectedStaffForFace = signal<string>('');
  isCapturing = signal<boolean>(false);
  punchSuccess = signal<any | null>(null);
  faceMismatchError = signal<string>('');
  cameraError = signal<string>('');
  private mediaStream: MediaStream | null = null;

  staffForm!: FormGroup;
  advanceAmount = 0;
  advanceNotes = '';

  ngOnInit() {
    this.initStaffForm();
    this.loadStaff();
    this.loadDailyAttendance(this.selectedDate());
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  initStaffForm() {
    this.staffForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      mobile: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
      designation: ['Salesman / Cashier', Validators.required],
      salaryType: ['MONTHLY', Validators.required],
      salaryAmount: [10000, [Validators.required, Validators.min(0)]],
      address: ['']
    });
  }

  loadStaff() {
    this.loading.set(true);
    this.api.get<any>('/staff').subscribe({
      next: (res) => {
        if (res.success) {
          this.staffList.set(res.data || []);
          if (res.data && res.data.length > 0 && !this.selectedStaffForFace()) {
            this.selectedStaffForFace.set(res.data[0]._id);
          }
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error', 'स्टाफ लिस्ट लोड नहीं हो सकी।');
      }
    });
  }

  loadDailyAttendance(date: string) {
    this.api.get<any>(`/staff/attendance?date=${date}`).subscribe({
      next: (res) => {
        if (res.success) {
          const map: Record<string, any> = {};
          (res.data || []).forEach((rec: any) => {
            const staffId = typeof rec.staff === 'object' ? rec.staff._id : rec.staff;
            map[staffId] = rec;
          });
          this.attendanceMap.set(map);
        }
      }
    });
  }

  onDateChange(newDate: string) {
    this.selectedDate.set(newDate);
    this.loadDailyAttendance(newDate);
  }

  markStatus(staffId: string, status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE') {
    const date = this.selectedDate();
    const inTime = status === 'PRESENT' || status === 'HALF_DAY' 
      ? new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) 
      : '';

    this.api.post<any>('/staff/attendance', { staffId, date, status, inTime }).subscribe({
      next: (res) => {
        if (res.success) {
          const currentMap = { ...this.attendanceMap() };
          currentMap[staffId] = res.data;
          this.attendanceMap.set(currentMap);
          this.toast.success('हाजिरी दर्ज', `Status set to ${status}`);
        }
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'हाजिरी दर्ज नहीं हो सकी।');
      }
    });
  }

  getStaffAttendance(staffId: string): any {
    return this.attendanceMap()[staffId] || null;
  }

  getSelectedStaff(): any {
    return this.staffList().find(s => s._id === this.selectedStaffForFace()) || null;
  }

  // =========================================================================
  // 📱 MOBILE / AI FACE ATTENDANCE KIOSK METHODS
  // =========================================================================
  openFaceAttendanceModal(enrollMode: boolean = false, staffId?: string) {
    this.isFaceEnrollMode.set(enrollMode);
    if (staffId) {
      this.selectedStaffForFace.set(staffId);
    }
    this.punchSuccess.set(null);
    this.faceMismatchError.set('');
    this.cameraError.set('');
    this.showFaceModal.set(true);
    setTimeout(() => this.startCamera(), 200);
  }

  closeFaceAttendanceModal() {
    this.stopCamera();
    this.showFaceModal.set(false);
    this.punchSuccess.set(null);
    this.faceMismatchError.set('');
  }

  async startCamera() {
    this.cameraError.set('');
    this.faceMismatchError.set('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.cameraError.set('आपके डिवाइस में कैमरा सपोर्ट उपलब्ध नहीं है।');
        return;
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user', // Front selfie camera
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (this.videoRef && this.videoRef.nativeElement) {
        this.videoRef.nativeElement.srcObject = this.mediaStream;
        await this.videoRef.nativeElement.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      this.cameraError.set('कैमरा शुरू नहीं हो सका। कृपया कैमरा परमिशन (Permission) दें।');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }

  /**
   * 📸 PUNCH ATTENDANCE OR REGISTER FACE WITH ANTI-SPOOFING & STRICT FACE MATCHING
   */
  captureAndPunch() {
    const staffId = this.selectedStaffForFace();
    if (!staffId) {
      this.toast.warning('Warning', 'कृपया कर्मचारी का नाम चुनें।');
      return;
    }

    if (!this.videoRef || !this.canvasRef) return;

    this.isCapturing.set(true);
    this.faceMismatchError.set('');

    const video = this.videoRef.nativeElement;
    const selectedStaff = this.getSelectedStaff();

    // 1. Extract Biometric Face Features from Live Camera Frame
    const bioResult = this.faceAuth.extractBiometricDescriptor(video, true);

    if (!bioResult || !bioResult.hasFace || bioResult.descriptor.length === 0) {
      this.isCapturing.set(false);
      const reason = bioResult?.error || 'कैमरे के सामने कोई वैध चेहरा नहीं दिखा। कृपया सीधा देखें।';
      this.faceMismatchError.set(`⚠️ ${reason}`);
      this.faceAuth.playAudioBeep(250, 300);
      return;
    }

    const liveDescriptor = bioResult.descriptor;
    const selfiePhoto = bioResult.thumbnail;

    // 2. ENROLLMENT MODE (Registering genuine face for future comparisons)
    if (this.isFaceEnrollMode()) {
      this.api.post<any>(`/staff/${staffId}/face-register`, {
        faceDescriptor: liveDescriptor,
        facePhoto: selfiePhoto
      }).subscribe({
        next: (res) => {
          this.isCapturing.set(false);
          if (res.success) {
            this.faceAuth.playSuccessChime();
            this.toast.success('चेहरा रजिस्टर!', `${selectedStaff?.name} का असली चेहरा सुरक्षित रूप से रजिस्टर हो गया।`);
            this.loadStaff();
            this.closeFaceAttendanceModal();
          }
        },
        error: (err) => {
          this.isCapturing.set(false);
          this.toast.error('Error', err.error?.message || 'चेहरा रजिस्टर नहीं हो सका।');
        }
      });
      return;
    }

    // 3. PUNCH ATTENDANCE MODE — STRICT FACE MATCH VERIFICATION!
    if (selectedStaff && selectedStaff.isFaceRegistered && selectedStaff.faceDescriptor && selectedStaff.faceDescriptor.length > 0) {
      const matchResult = this.faceAuth.compareFaceDescriptors(liveDescriptor, selectedStaff.faceDescriptor);

      // ❌ REJECT IF FACE DOES NOT MATCH!
      if (!matchResult.isMatch) {
        this.isCapturing.set(false);
        this.faceAuth.playAudioBeep(200, 450);
        this.faceMismatchError.set(
          `❌ चेहरा मैच नहीं हुआ (Match: ${matchResult.similarity}%)! यह "${selectedStaff.name}" का चेहरा नहीं है। हाजिरी निरस्त कर दी गई है।`
        );
        this.toast.error('Face Mismatch!', `चेहरा मैच नहीं हुआ! किसी और की हाजिरी नहीं लगाई जा सकती।`);
        return;
      }
    }

    // 4. FACE MATCHED (OR FIRST TIME REGISTRATION) -> SAVE ATTENDANCE
    const date = new Date().toISOString().slice(0, 10);
    const inTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    this.api.post<any>('/staff/attendance', {
      staffId,
      date,
      status: 'PRESENT',
      inTime,
      selfiePhoto
    }).subscribe({
      next: (res) => {
        this.isCapturing.set(false);
        if (res.success) {
          this.faceAuth.playSuccessChime();

          // Auto-register face on first punch if not registered yet
          if (selectedStaff && !selectedStaff.isFaceRegistered) {
            this.api.post<any>(`/staff/${staffId}/face-register`, {
              faceDescriptor: liveDescriptor,
              facePhoto: selfiePhoto
            }).subscribe({ next: () => this.loadStaff() });
          }

          this.punchSuccess.set({
            staffName: selectedStaff?.name || 'Staff',
            inTime,
            selfiePhoto
          });

          // Update attendance map
          const currentMap = { ...this.attendanceMap() };
          currentMap[staffId] = res.data;
          this.attendanceMap.set(currentMap);

          this.toast.success('🎉 हाजिरी दर्ज!', `${selectedStaff?.name} की हाजिरी (समय: ${inTime}) दर्ज हो गई।`);
        }
      },
      error: (err) => {
        this.isCapturing.set(false);
        this.toast.error('Error', err.error?.message || 'हाजिरी दर्ज नहीं हो सकी।');
      }
    });
  }

  // Modals management
  openAddStaff() {
    this.staffForm.reset({
      designation: 'Salesman',
      salaryType: 'MONTHLY',
      salaryAmount: 10000
    });
    this.showAddStaffModal.set(true);
  }

  saveStaff() {
    if (this.staffForm.invalid) {
      this.staffForm.markAllAsTouched();
      return;
    }

    this.api.post<any>('/staff', this.staffForm.value).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('सफल!', 'कर्मचारी सफलतापूर्वक जोड़ा गया।');
          this.showAddStaffModal.set(false);
          this.loadStaff();
        }
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'कर्मचारी नहीं जोड़ा जा सका।');
      }
    });
  }

  deleteStaff(id: string) {
    if (!confirm('क्या आप इस कर्मचारी को हटाना चाहते हैं?')) return;
    this.api.delete<any>(`/staff/${id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.info('हटाया गया', 'कर्मचारी हटा दिया गया है।');
          this.loadStaff();
        }
      }
    });
  }

  openAdvanceModal(staff: any) {
    this.selectedStaffForAdvance.set(staff);
    this.advanceAmount = 500;
    this.advanceNotes = 'नकद एडवांस';
    this.showAdvanceModal.set(true);
  }

  saveAdvance() {
    const staff = this.selectedStaffForAdvance();
    if (!staff || this.advanceAmount <= 0) {
      this.toast.warning('Warning', 'कृपया सही एडवांस राशि दर्ज करें।');
      return;
    }

    this.api.post<any>(`/staff/${staff._id}/advance`, {
      amount: this.advanceAmount,
      notes: this.advanceNotes
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('एडवांस दर्ज', `₹${this.advanceAmount} एडवांस दर्ज किया गया।`);
          this.showAdvanceModal.set(false);
          this.loadStaff();
        }
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'एडवांस दर्ज नहीं हो सका।');
      }
    });
  }

  getTotalAdvances(staff: any): number {
    return (staff.advances || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
  }
}
