import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FaceAuthService, HeadPose } from '../../core/services/face-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-remote-unlock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mobile-unlock-wrapper">
      
      <!-- Top Cyber Navigation Header -->
      <div class="mobile-top-bar">
        <div class="brand-pill">
          <i class="fa-solid fa-shield-halved text-cyan"></i>
          <span>MKS Mobile Face ID</span>
        </div>
        <button type="button" class="lang-switch-btn" (click)="lang.toggleLanguage()">
          {{ lang.currentLang() === 'hi' ? 'English' : 'हिंदी' }}
        </button>
      </div>

      <!-- Main Remote Unlock Card -->
      <div class="unlock-card">
        
        <!-- Header Banner -->
        <div class="card-header-section">
          <div class="icon-orb" [class.success]="isVerified()" [class.failed]="isFailed()">
            <i class="fa-solid" [ngClass]="isVerified() ? 'fa-circle-check text-green' : (isFailed() ? 'fa-triangle-exclamation text-red' : 'fa-mobile-screen text-cyan')"></i>
          </div>
          <h2>{{ isVerified() ? (lang.isHindi() ? 'कंप्यूटर अनलॉक हो गया!' : 'Desktop Unlocked!') : (lang.isHindi() ? 'रिमोट फेस अनलॉक' : 'Remote Face Unlock') }}</h2>
          <p>{{ isVerified() ? (lang.isHindi() ? 'आपका कंप्यूटर स्क्रीन अब खुल चुका है।' : 'Your computer admin console is now unlocked.') : (lang.isHindi() ? 'कंप्यूटर खोलने के लिए अपना चेहरा कैमरे में दिखाएं' : 'Verify your face to unlock your desktop console') }}</p>
        </div>

        <!-- Camera HUD Viewport (When not verified yet) -->
        <div *ngIf="!isVerified() && sessionId" class="camera-viewport-box">
          
          <!-- Native Mobile Camera Snap Button (Works 100% on all Android/iOS browsers) -->
          <div class="native-snap-box w-full mb-2">
            <input 
              #fileInput 
              type="file" 
              accept="image/*" 
              capture="user" 
              style="display: none;" 
              (change)="onMobileFaceCaptured($event)"
            />

            <button 
              type="button" 
              class="btn-native-snap"
              [disabled]="isVerifying()"
              (click)="triggerNativeMobileCamera(fileInput)"
            >
              <i class="fa-solid" [ngClass]="isVerifying() ? 'fa-spinner fa-spin' : 'fa-camera'"></i>
              <span>{{ isVerifying() ? (lang.isHindi() ? 'चेहरा सत्यापित हो रहा है...' : 'Verifying face...') : (lang.isHindi() ? '📸 फोन कैमरे से चेहरा फोटो लें' : '📸 Take Face Photo to Unlock') }}</span>
            </button>
          </div>

          <!-- Video Container (for browsers that support live stream) -->
          <div *ngIf="cameraActive()" class="video-container">
            <video #videoElement autoplay playsinline muted class="camera-feed"></video>

            <!-- HUD Overlays -->
            <div class="biometric-hud">
              <div class="bracket top-left"></div>
              <div class="bracket top-right"></div>
              <div class="bracket bottom-left"></div>
              <div class="bracket bottom-right"></div>

              <!-- Laser Scanner Line -->
              <div class="laser-scanner"></div>

              <!-- Oval Face Guide Ring -->
              <div class="face-guide-oval" [class.matched]="isVerified()" [class.error]="isFailed()">
                <div class="pulse-ring"></div>
              </div>
            </div>
          </div>

          <!-- Preview of captured photo if processed via native camera -->
          <div *ngIf="capturedPhotoPreview()" class="photo-preview-box">
            <img [src]="capturedPhotoPreview()" alt="Face Capture" class="photo-preview-img" />
          </div>

          <!-- Real-Time Status Message -->
          <div class="live-status-pill" [class.error]="isFailed()" [class.verifying]="isVerifying()">
            <i class="fa-solid" [ngClass]="isVerifying() ? 'fa-spinner fa-spin' : (isFailed() ? 'fa-triangle-exclamation' : 'fa-face-viewfinder')"></i>
            <span>{{ statusMessage() }}</span>
          </div>

          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.4;">
            {{ lang.isHindi() ? 'ऊपर दिए नीले बटन पर क्लिक करें, अपना चेहरा फोटो खींचें और कंप्यूटर तुरंत खुल जाएगा।' : 'Tap the blue button above to take your face photo and instantly unlock desktop.' }}
          </p>
        </div>

        <!-- Success Screen View -->
        <div *ngIf="isVerified()" class="success-view-box">
          <div class="success-badge-circle">
            <i class="fa-solid fa-check"></i>
          </div>
          <div class="success-details">
            <h3>{{ lang.isHindi() ? 'सत्यापन सफल!' : 'Verification Success!' }}</h3>
            <p>{{ lang.isHindi() ? 'कंप्यूटर कंसोल सफलता से अनलॉक हो चुका है। आप इस पेज को बंद कर सकते हैं।' : 'Your desktop console is now completely unlocked. You may close this tab.' }}</p>
          </div>
          <div class="security-chip">
            <i class="fa-solid fa-lock text-green"></i>
            <span>{{ lang.isHindi() ? '256-Bit एन्क्रिप्टेड रिमोट सेशन' : '256-Bit Encrypted Remote Session' }}</span>
          </div>
        </div>

        <!-- Invalid / Expired Session Notice -->
        <div *ngIf="!sessionId && !isVerified()" class="invalid-session-box">
          <i class="fa-solid fa-link-slash text-red"></i>
          <h4>{{ lang.isHindi() ? 'अमान्य या एक्सपायर्ड लिंक' : 'Invalid or Expired Link' }}</h4>
          <p>{{ lang.isHindi() ? 'कृपया कंप्यूटर स्क्रीन पर जाकर नया QR कोड स्कैन करें।' : 'Please scan the fresh QR code shown on your desktop screen.' }}</p>
        </div>

      </div>

      <!-- Footer Info -->
      <div class="footer-security-note">
        <i class="fa-solid fa-shield-halved"></i>
        <span>MKS Billing Software &bull; Private Biometric Encryption</span>
      </div>

    </div>
  `,
  styles: [`
    .mobile-unlock-wrapper {
      min-height: 100vh;
      background: radial-gradient(circle at top, #0f172a 0%, #030712 100%);
      color: #ffffff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      box-sizing: border-box;
    }

    .mobile-top-bar {
      width: 100%;
      max-width: 440px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 4px;
    }

    .brand-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 20px;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
    }

    .lang-switch-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #cbd5e1;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }

    .unlock-card {
      width: 100%;
      max-width: 440px;
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(56, 189, 248, 0.25);
      backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 24px 20px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
      box-sizing: border-box;
    }

    .card-header-section {
      text-align: center;
      margin-bottom: 20px;
    }

    .icon-orb {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(56, 189, 248, 0.1);
      border: 1.5px solid rgba(56, 189, 248, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin: 0 auto 12px auto;
      transition: all 0.3s ease;
    }
    .icon-orb.success {
      background: rgba(16, 185, 129, 0.15);
      border-color: #10b981;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
    }
    .icon-orb.failed {
      background: rgba(239, 68, 68, 0.15);
      border-color: #ef4444;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
    }

    .card-header-section h2 {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 6px 0;
      letter-spacing: -0.3px;
    }
    .card-header-section p {
      font-size: 13px;
      color: #94a3b8;
      margin: 0;
      line-height: 1.4;
    }

    .camera-viewport-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .video-container {
      width: 100%;
      height: 280px;
      position: relative;
      border-radius: 20px;
      overflow: hidden;
      background: #020617;
      border: 1.5px solid rgba(56, 189, 248, 0.3);
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
    }

    .camera-feed {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    .biometric-hud {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }

    .bracket {
      position: absolute;
      width: 18px;
      height: 18px;
      border-color: #38bdf8;
      border-style: solid;
      border-width: 0;
    }
    .bracket.top-left { top: 12px; left: 12px; border-top-width: 2.5px; border-left-width: 2.5px; }
    .bracket.top-right { top: 12px; right: 12px; border-top-width: 2.5px; border-right-width: 2.5px; }
    .bracket.bottom-left { bottom: 12px; left: 12px; border-bottom-width: 2.5px; border-left-width: 2.5px; }
    .bracket.bottom-right { bottom: 12px; right: 12px; border-bottom-width: 2.5px; border-right-width: 2.5px; }

    .laser-scanner {
      position: absolute;
      left: 0;
      right: 0;
      height: 2.5px;
      background: linear-gradient(90deg, transparent, #38bdf8, #00f2fe, #38bdf8, transparent);
      box-shadow: 0 0 12px #38bdf8;
      animation: laserSweep 1.8s ease-in-out infinite alternate;
    }

    @keyframes laserSweep {
      0% { top: 10%; opacity: 0.8; }
      100% { top: 90%; opacity: 1; }
    }

    .face-guide-oval {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 150px;
      height: 200px;
      border-radius: 50%;
      border: 2px dashed rgba(56, 189, 248, 0.4);
      transition: all 0.3s ease;
    }
    .face-guide-oval.matched {
      border-color: #10b981;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.6);
    }
    .face-guide-oval.error {
      border-color: #ef4444;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
    }

    .gesture-pill {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.9);
      border: 1.5px solid #38bdf8;
      border-radius: 20px;
      padding: 5px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
      white-space: nowrap;
    }

    .live-status-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      color: #e2e8f0;
      text-align: center;
    }
    .live-status-pill.error {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .live-status-pill.verifying {
      background: rgba(56, 189, 248, 0.15);
      border-color: rgba(56, 189, 248, 0.4);
      color: #38bdf8;
    }

    .camera-loader, .camera-error {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #090d16;
      color: #94a3b8;
      font-size: 13px;
      padding: 20px;
      text-align: center;
    }
    .cyber-spinner {
      width: 36px;
      height: 36px;
      border: 3px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .btn-retry {
      background: #38bdf8;
      color: #030712;
      border: none;
      border-radius: 12px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      margin-top: 10px;
      cursor: pointer;
    }

    .btn-native-snap {
      width: 100%;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff;
      border: 1.5px solid #38bdf8;
      border-radius: 18px;
      padding: 16px 20px;
      font-size: 15px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      cursor: pointer;
      box-shadow: 0 8px 25px rgba(2, 132, 199, 0.45);
      transition: all 0.2s ease;
      letter-spacing: 0.2px;
    }
    .btn-native-snap:active {
      transform: scale(0.98);
      box-shadow: 0 4px 15px rgba(2, 132, 199, 0.3);
    }
    .btn-native-snap:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .photo-preview-box {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      overflow: hidden;
      border: 3px solid #38bdf8;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
      margin: 10px 0;
    }
    .photo-preview-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Success View */
    .success-view-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 20px 10px;
      animation: fadeIn 0.4s ease;
    }
    .success-badge-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #059669);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 38px;
      color: #ffffff;
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.5);
      margin-bottom: 18px;
    }
    .success-details h3 {
      font-size: 20px;
      font-weight: 800;
      color: #10b981;
      margin: 0 0 8px 0;
    }
    .success-details p {
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0 0 20px 0;
    }
    .security-chip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: #6ee7b7;
    }

    .invalid-session-box {
      text-align: center;
      padding: 30px 10px;
    }
    .invalid-session-box i {
      font-size: 40px;
      margin-bottom: 12px;
    }
    .invalid-session-box h4 {
      font-size: 16px;
      font-weight: 800;
      margin: 0 0 6px 0;
      color: #f87171;
    }
    .invalid-session-box p {
      font-size: 13px;
      color: #94a3b8;
      margin: 0;
    }

    .footer-security-note {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      padding: 10px 0;
    }

    .text-cyan { color: #38bdf8; }
    .text-green { color: #10b981; }
    .text-red { color: #ef4444; }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class RemoteUnlockComponent implements OnInit, OnDestroy {
  public faceService = inject(FaceAuthService);
  public lang = inject(LanguageService);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;

  sessionId = '';
  cameraActive = signal<boolean>(false);
  cameraError = signal<string | null>(null);
  statusMessage = signal<string>('');
  
  isVerifying = signal<boolean>(false);
  isVerified = signal<boolean>(false);
  isFailed = signal<boolean>(false);
  capturedPhotoPreview = signal<string | null>(null);

  private mediaStream: MediaStream | null = null;
  private scanInterval: any = null;

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.sessionId = params['session'] || '';
      if (this.sessionId) {
        this.statusMessage.set(this.lang.isHindi() ? 'कैमरे के सामने सीधे देखें या फोटो लें' : 'Look at camera or take photo');
        this.startCamera();
      } else {
        this.statusMessage.set(this.lang.isHindi() ? 'अमान्य सेशन लिंक' : 'Invalid session link');
      }
    });
  }

  triggerNativeMobileCamera(inputElem: HTMLInputElement) {
    inputElem.click();
  }

  onMobileFaceCaptured(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    this.isVerifying.set(true);
    this.isFailed.set(false);
    this.statusMessage.set(this.lang.isHindi() ? 'फोटो प्रोसेस हो रही है...' : 'Processing face photo...');

    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        this.capturedPhotoPreview.set(img.src);
        
        const capture = this.faceService.extractBiometricDescriptor(img);

        if (!capture || !capture.hasFace || !capture.descriptor || capture.descriptor.length < 10) {
          this.isVerifying.set(false);
          this.isFailed.set(true);
          this.statusMessage.set(capture?.error || (this.lang.isHindi() ? 'चेहरा स्पष्ट नहीं दिखा। कृपया सामने से साफ फोटो लें।' : 'Face unclear. Please retake photo.'));
          this.toast.error('Face Error', 'Please keep face straight and clear in the photo.');
          return;
        }

        this.statusMessage.set(this.lang.isHindi() ? 'कंप्यूटर अनलॉक हो रहा है...' : 'Authorizing Desktop...');

        this.faceService.verifyRemoteUnlock(this.sessionId, capture.descriptor).subscribe({
          next: (res) => {
            this.isVerifying.set(false);
            this.isVerified.set(true);
            this.isFailed.set(false);
            this.statusMessage.set(this.lang.isHindi() ? 'कंप्यूटर अनलॉक हो गया!' : 'Desktop Unlocked!');
            this.faceService.playSuccessChime();
          },
          error: (err) => {
            this.isVerifying.set(false);
            this.isFailed.set(true);
            this.statusMessage.set(err.error?.message || (this.lang.isHindi() ? 'चेहरा मैच नहीं हुआ (Unauthorized)' : 'Face mismatch'));
          }
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  ngOnDestroy() {
    this.stopCamera();
    if (this.scanInterval) clearInterval(this.scanInterval);
  }

  async startCamera() {
    this.cameraError.set(null);
    this.cameraActive.set(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this browser.');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      if (this.videoRef && this.videoRef.nativeElement) {
        this.videoRef.nativeElement.srcObject = this.mediaStream;
        this.videoRef.nativeElement.onloadedmetadata = () => {
          this.videoRef.nativeElement.play();
          this.cameraActive.set(true);
          this.statusMessage.set(this.lang.isHindi() ? 'चेहरा स्कैन हो रहा है...' : 'Scanning face...');
          this.startLiveVerificationLoop();
        };
      }
    } catch (err: any) {
      this.cameraError.set(err.message || 'Camera permission denied.');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  startLiveVerificationLoop() {
    if (this.scanInterval) clearInterval(this.scanInterval);

    this.scanInterval = setInterval(() => {
      if (!this.cameraActive() || this.isVerified() || this.isVerifying()) return;
      this.performMobileLiveScan();
    }, 180);
  }

  private performMobileLiveScan() {
    if (!this.videoRef || !this.videoRef.nativeElement) return;
    const video = this.videoRef.nativeElement;
    if (video.readyState < 2) return;

    const capture = this.faceService.extractBiometricDescriptor(video);
    if (!capture) return;

    if (!capture.hasFace || !capture.descriptor || capture.descriptor.length < 10) {
      this.statusMessage.set(capture.error || (this.lang.isHindi() ? 'कृपया असली चेहरा कैमरे में रखें' : 'Keep face in camera'));
      return;
    }

    // Direct Instant Verification
    this.isVerifying.set(true);
    this.statusMessage.set(this.lang.isHindi() ? 'सत्यापन हो रहा है...' : 'Verifying with Desktop...');

    this.faceService.verifyRemoteUnlock(this.sessionId, capture.descriptor).subscribe({
      next: (res) => {
        clearInterval(this.scanInterval);
        this.isVerifying.set(false);
        this.isVerified.set(true);
        this.statusMessage.set(this.lang.isHindi() ? 'कंप्यूटर अनलॉक हो गया!' : 'Desktop Unlocked!');
        this.faceService.playSuccessChime();
        this.stopCamera();
      },
      error: (err) => {
        this.isVerifying.set(false);
        this.statusMessage.set(err.error?.message || (this.lang.isHindi() ? 'चेहरा मैच नहीं हुआ' : 'Face mismatch'));
      }
    });
  }
}
