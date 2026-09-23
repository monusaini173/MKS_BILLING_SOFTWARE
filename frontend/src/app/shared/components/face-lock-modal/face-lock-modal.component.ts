import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  input,
  output,
  ElementRef,
  ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FaceAuthService } from '../../../core/services/face-auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { LanguageService } from '../../../core/services/language.service';
import { AuthService } from '../../../core/services/auth.service';
import * as QRCode from 'qrcode';

export type FaceModalMode = 'ENROLL' | 'UNLOCK' | 'LOCKSCREEN';

@Component({
  selector: 'app-face-lock-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="face-modal-backdrop" [class.lockscreen-backdrop]="mode() === 'LOCKSCREEN'">
      <div class="face-modal-container" [class.lockscreen-card]="mode() === 'LOCKSCREEN'">
        
        <!-- Header -->
        <div class="face-modal-header">
          <div class="header-badge">
            <i class="fa-solid fa-face-viewfinder text-cyan"></i>
            <span>{{ getBadgeTitle() }}</span>
          </div>
          <button 
            *ngIf="mode() !== 'LOCKSCREEN' || allowDismiss()" 
            type="button" 
            class="btn-close" 
            (click)="closeModal()"
            title="Close"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Lockscreen Header Details -->
        <div *ngIf="mode() === 'LOCKSCREEN'" class="lockscreen-user-info">
          <div class="user-avatar-glow">
            <span *ngIf="!faceService.faceStatus().faceThumbnail">👑</span>
            <img 
              *ngIf="faceService.faceStatus().faceThumbnail" 
              [src]="faceService.faceStatus().faceThumbnail" 
              alt="Admin Face" 
              class="user-avatar-img"
            />
          </div>
          <h2 class="lockscreen-title">
            {{ lang.isHindi() ? 'एडमिन कंसोल लॉक है' : 'Admin Console Locked' }}
          </h2>
          <p class="lockscreen-subtitle">
            {{ lang.isHindi() ? 'कैमरे के सामने सीधे देखें — चेहरा पहचानते ही 1 सेकंड में अनलॉक हो जाएगा' : 'Look directly at camera to instantly unlock' }}
          </p>
        </div>

        <!-- Mode Switcher Tabs (PC Camera vs Phone QR Unlock) in UNLOCK/LOCKSCREEN Mode -->
        <div *ngIf="mode() === 'UNLOCK' || mode() === 'LOCKSCREEN'" class="flex gap-2 justify-center mb-3">
          <button 
            type="button" 
            class="btn btn-sm"
            [style.background]="unlockMethod() === 'WEBCAM' ? '#38bdf8' : 'rgba(255,255,255,0.06)'"
            [style.color]="unlockMethod() === 'WEBCAM' ? '#030712' : '#cbd5e1'"
            [style.border]="unlockMethod() === 'WEBCAM' ? 'none' : '1px solid rgba(255,255,255,0.1)'"
            style="border-radius: 20px; font-weight: 700; padding: 6px 14px; font-size: 12px; transition: all 0.2s;"
            (click)="setUnlockMethod('WEBCAM')"
          >
            <i class="fa-solid fa-camera"></i>
            {{ lang.isHindi() ? 'कंप्यूटर कैमरा' : 'PC Camera' }}
          </button>

          <button 
            type="button" 
            class="btn btn-sm"
            [style.background]="unlockMethod() === 'PHONE_QR' ? '#38bdf8' : 'rgba(255,255,255,0.06)'"
            [style.color]="unlockMethod() === 'PHONE_QR' ? '#030712' : '#cbd5e1'"
            [style.border]="unlockMethod() === 'PHONE_QR' ? 'none' : '1px solid rgba(255,255,255,0.1)'"
            style="border-radius: 20px; font-weight: 700; padding: 6px 14px; font-size: 12px; transition: all 0.2s;"
            (click)="setUnlockMethod('PHONE_QR')"
          >
            <i class="fa-solid fa-mobile-screen"></i>
            {{ lang.isHindi() ? '📱 फोन से फेस अनलॉक (QR)' : '📱 Phone Face Unlock' }}
          </button>
        </div>

        <!-- 1. PC Camera Scanner Viewport -->
        <div *ngIf="unlockMethod() === 'WEBCAM' || mode() === 'ENROLL'" class="scanner-viewport-wrapper">
          <div class="scanner-viewport" [class.is-success]="matchState() === 'SUCCESS'" [class.is-scanning]="isScanning()">
            
            <!-- Video Feed -->
            <video 
              #videoElement 
              autoplay 
              playsinline 
              muted 
              class="camera-stream"
              [class.mirror]="true"
            ></video>

            <!-- Biometric HUD Overlays -->
            <div class="biometric-hud">
              <!-- Corner brackets -->
              <div class="bracket top-left"></div>
              <div class="bracket top-right"></div>
              <div class="bracket bottom-left"></div>
              <div class="bracket bottom-right"></div>

              <!-- Animated Laser Sweep Line -->
              <div *ngIf="cameraActive() && (isScanning() || isCapturing())" class="laser-scanner"></div>

              <!-- Oval Face Guide Ring (Mobile Style) -->
              <div class="face-guide-oval" [class.matched]="matchState() === 'SUCCESS'" [class.error]="matchState() === 'FAILED'">
                <div class="pulse-ring"></div>
                <div *ngIf="matchState() === 'SUCCESS'" class="success-icon-badge">
                  <i class="fa-solid fa-check"></i>
                </div>
              </div>

              <!-- Live Status HUD Pill -->
              <div class="hud-status-pill" [class.success]="matchState() === 'SUCCESS'" [class.failed]="matchState() === 'FAILED'">
                <i [class]="getStatusIcon()"></i>
                <span>{{ statusMessage() }}</span>
              </div>
            </div>

            <!-- Fallback / Loading camera state -->
            <div *ngIf="!cameraActive() && !cameraError()" class="camera-loading-overlay">
              <div class="cyber-spinner"></div>
              <span>{{ lang.isHindi() ? 'कैमरा शुरू हो रहा है...' : 'Initializing Camera...' }}</span>
            </div>

            <div *ngIf="cameraError()" class="camera-error-overlay">
              <i class="fa-solid fa-video-slash" style="font-size: 32px; color: #ef4444; margin-bottom: 8px;"></i>
              <p style="font-size: 13px; font-weight: 600; color: #f87171; text-align: center; margin: 0 0 10px 0;">
                {{ cameraError() }}
              </p>
              <button type="button" class="btn btn-sm btn-outline-cyan" (click)="startCamera()">
                <i class="fa-solid fa-rotate-right"></i> {{ lang.isHindi() ? 'पुनः प्रयास करें' : 'Retry Camera' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 2. Phone QR Code Remote Unlock Viewport -->
        <div *ngIf="unlockMethod() === 'PHONE_QR' && (mode() === 'UNLOCK' || mode() === 'LOCKSCREEN')" class="phone-qr-viewport p-4" style="background: rgba(2, 6, 23, 0.7); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px;">
          
          <div *ngIf="qrCodeDataUrl()" style="padding: 10px; background: #ffffff; border-radius: 16px; box-shadow: 0 0 25px rgba(56, 189, 248, 0.35);">
            <img [src]="qrCodeDataUrl()" alt="Remote Unlock QR" style="width: 175px; height: 175px; display: block;" />
          </div>

          <div *ngIf="!qrCodeDataUrl()" style="width: 175px; height: 175px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); border-radius: 16px;">
            <div class="cyber-spinner"></div>
          </div>

          <div style="font-size: 13px; color: #e2e8f0; font-weight: 600; max-width: 280px; line-height: 1.4;">
            <i class="fa-solid fa-qrcode text-cyan"></i>
            {{ lang.isHindi() ? 'फोन के कैमरे से यह QR कोड स्कैन करें और फोन पर चेहरा दिखाकर अनलॉक करें।' : 'Scan this QR code with your mobile camera to unlock with Phone Face ID.' }}
          </div>

          <div class="flex gap-2 items-center justify-center">
            <button type="button" class="btn btn-sm btn-outline-cyan" (click)="copyRemoteUnlockUrl()">
              <i class="fa-solid fa-link"></i> {{ lang.isHindi() ? 'लिंक कॉपी करें' : 'Copy Link' }}
            </button>
            <button type="button" class="btn btn-sm btn-outline-cyan" (click)="generateRemoteUnlockSession()">
              <i class="fa-solid fa-rotate-right"></i> {{ lang.isHindi() ? 'नया QR' : 'Refresh' }}
            </button>
          </div>

          <div style="font-size: 11px; color: #64748b; font-weight: 600;">
            <i class="fa-solid fa-clock"></i> {{ lang.isHindi() ? 'QR कोड 3 मिनट के लिए वैध है' : 'QR code valid for 3 mins' }}
          </div>
        </div>

        <!-- Match Score Bar (in UNLOCK/LOCKSCREEN mode) -->
        <div *ngIf="matchConfidence() > 0" class="confidence-bar-container">
          <div class="confidence-info">
            <span>{{ lang.isHindi() ? 'बायोमेट्रिक मैच स्कोर' : 'Biometric Match Confidence' }}</span>
            <span class="score-num" [class.high]="matchConfidence() >= 70">{{ matchConfidence() }}%</span>
          </div>
          <div class="confidence-track">
            <div 
              class="confidence-fill" 
              [style.width.%]="matchConfidence()"
              [class.verified]="matchConfidence() >= 70"
            ></div>
          </div>
        </div>

        <!-- Mode Specific Actions -->
        
        <!-- ENROLL MODE CONTROLS -->
        <div *ngIf="mode() === 'ENROLL'" class="modal-actions-box">
          
          <!-- Progress Bar during enrollment -->
          <div *ngIf="enrollProgress() > 0" class="confidence-bar-container mb-3" style="animation: fadeIn 0.2s ease;">
            <div class="confidence-info">
              <span style="color: #38bdf8; font-weight: 700;">{{ statusMessage() }}</span>
              <span class="score-num" style="color: #10b981; font-weight: 800;">{{ enrollProgress() }}%</span>
            </div>
            <div class="confidence-track" style="height: 8px;">
              <div 
                class="confidence-fill verified" 
                [style.width.%]="enrollProgress()"
                style="transition: width 0.3s ease; background: linear-gradient(90deg, #38bdf8, #10b981);"
              ></div>
            </div>
          </div>

          <div *ngIf="enrollProgress() === 0" class="enroll-instructions mb-3">
            <i class="fa-solid fa-circle-info text-cyan"></i>
            <span>{{ lang.isHindi() ? 'कैमरे के सामने सीधे देखें और नीचे दिए बटन पर क्लिक करें।' : 'Look directly at camera and click the button below.' }}</span>
          </div>

          <div class="flex gap-3 justify-center w-full">
            <button 
              type="button" 
              class="btn btn-cyber-primary w-full"
              style="padding: 13px 20px; font-size: 14px; font-weight: 800;"
              [disabled]="!cameraActive() || isCapturing()"
              (click)="captureAndEnrollFace()"
            >
              <i class="fa-solid" [ngClass]="isCapturing() ? 'fa-spinner fa-spin' : 'fa-camera'"></i>
              <span>{{ isCapturing() ? (lang.isHindi() ? 'स्कैन हो रहा है...' : 'Scanning...') : (lang.isHindi() ? '📸 चेहरा स्कैन व सेव करें (Scan & Save Face)' : '📸 Scan & Save Face') }}</span>
            </button>
          </div>
        </div>

        <!-- UNLOCK / LOCKSCREEN MODE CONTROLS -->
        <div *ngIf="mode() === 'UNLOCK' || mode() === 'LOCKSCREEN'" class="modal-actions-box">
          
          <!-- Password fallback input (if user prefers password) -->
          <div *ngIf="showPasswordFallback()" class="password-fallback-box">
            <div class="input-group mb-2">
              <input 
                type="password" 
                class="form-control cyber-input" 
                [(ngModel)]="fallbackPassword"
                [placeholder]="lang.isHindi() ? 'एडमिन पासवर्ड दर्ज करें' : 'Enter Admin Password'"
                (keyup.enter)="verifyPasswordUnlock()"
              />
              <button 
                type="button" 
                class="btn btn-cyber-primary"
                [disabled]="!fallbackPassword || isUnlockingWithPassword"
                (click)="verifyPasswordUnlock()"
              >
                {{ isUnlockingWithPassword ? '...' : (lang.isHindi() ? 'खोलें' : 'Unlock') }}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 w-full mt-2">
            <button 
              type="button" 
              class="btn-text-link" 
              (click)="togglePasswordFallback()"
            >
              <i class="fa-solid fa-key"></i>
              <span>{{ showPasswordFallback() ? (lang.isHindi() ? 'फेस स्कैन पर वापस जाएं' : 'Back to Face Scan') : (lang.isHindi() ? 'पासवर्ड से खोलें' : 'Unlock with Password') }}</span>
            </button>

            <button 
              *ngIf="mode() === 'UNLOCK'" 
              type="button" 
              class="btn-text-link text-muted" 
              (click)="closeModal()"
            >
              {{ lang.isHindi() ? 'रद्द करें' : 'Cancel' }}
            </button>

            <button 
              *ngIf="mode() === 'LOCKSCREEN' && !isScanning() && cameraActive()" 
              type="button" 
              class="btn btn-sm btn-outline-cyan" 
              (click)="triggerManualScan()"
            >
              <i class="fa-solid fa-magnifying-glass"></i> {{ lang.isHindi() ? 'स्कैन करें' : 'Scan Again' }}
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .face-modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 15, 29, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      padding: 16px;
      animation: fadeIn 0.25s ease-out;
    }

    .lockscreen-backdrop {
      background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
    }

    .face-modal-container {
      width: 100%;
      max-width: 440px;
      background: #0d1527;
      border: 1px solid rgba(56, 189, 248, 0.3);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15);
      color: #f8fafc;
      position: relative;
      overflow: hidden;
    }

    .lockscreen-card {
      max-width: 460px;
      border: 1px solid rgba(99, 102, 241, 0.35);
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.2);
    }

    .face-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
      letter-spacing: 0.3px;
    }

    .btn-close {
      background: rgba(255, 255, 255, 0.08);
      border: none;
      color: #94a3b8;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-close:hover {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    /* Lockscreen Top Avatar & Heading */
    .lockscreen-user-info {
      text-align: center;
      margin-bottom: 20px;
    }
    .user-avatar-glow {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      margin: 0 auto 12px auto;
      background: linear-gradient(135deg, #6366f1, #4338ca);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.5);
      border: 2px solid #818cf8;
      overflow: hidden;
    }
    .user-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .lockscreen-title {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      margin: 0 0 4px 0;
      letter-spacing: -0.2px;
    }
    .lockscreen-subtitle {
      font-size: 12.5px;
      color: #94a3b8;
      margin: 0;
    }

    /* Scanner Viewport */
    .scanner-viewport-wrapper {
      position: relative;
      width: 100%;
      aspect-ratio: 4/3;
      border-radius: 18px;
      overflow: hidden;
      background: #020617;
      border: 2px solid rgba(56, 189, 248, 0.2);
    }
    .scanner-viewport {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .camera-stream {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }

    /* Biometric HUD Overlays */
    .biometric-hud {
      position: absolute;
      inset: 0;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* Corner Brackets */
    .bracket {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: #38bdf8;
      border-style: solid;
    }
    .bracket.top-left {
      top: 14px;
      left: 14px;
      border-width: 3px 0 0 3px;
      border-top-left-radius: 8px;
    }
    .bracket.top-right {
      top: 14px;
      right: 14px;
      border-width: 3px 3px 0 0;
      border-top-right-radius: 8px;
    }
    .bracket.bottom-left {
      bottom: 14px;
      left: 14px;
      border-width: 0 0 3px 3px;
      border-bottom-left-radius: 8px;
    }
    .bracket.bottom-right {
      bottom: 14px;
      right: 14px;
      border-width: 0 3px 3px 0;
      border-bottom-right-radius: 8px;
    }

    /* Laser Scanner Animation */
    .laser-scanner {
      position: absolute;
      top: 0;
      left: 10%;
      right: 10%;
      height: 3px;
      background: linear-gradient(90deg, transparent, #38bdf8, #00f2fe, #38bdf8, transparent);
      box-shadow: 0 0 15px #00f2fe, 0 0 30px #38bdf8;
      animation: laserSweep 1.5s ease-in-out infinite;
      z-index: 10;
    }

    @keyframes laserSweep {
      0% { top: 12%; opacity: 0.3; }
      50% { top: 82%; opacity: 1; }
      100% { top: 12%; opacity: 0.3; }
    }

    /* Oval Face Ring (Mobile Face ID Style) */
    .face-guide-oval {
      width: 175px;
      height: 215px;
      border-radius: 50%;
      border: 2.5px solid rgba(56, 189, 248, 0.55);
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);
    }
    .face-guide-oval.matched {
      border: 3.5px solid #10b981;
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.7);
    }
    .face-guide-oval.error {
      border: 2.5px solid #ef4444;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
    }

    .success-icon-badge {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #10b981;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      font-size: 26px;
      box-shadow: 0 0 25px rgba(16, 185, 129, 0.8);
      animation: scalePop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    @keyframes scalePop {
      0% { transform: scale(0.3); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    .pulse-ring {
      position: absolute;
      inset: -8px;
      border-radius: 50%;
      border: 1.5px solid rgba(56, 189, 248, 0.3);
      animation: pulseGrow 2s infinite;
    }

    @keyframes pulseGrow {
      0% { transform: scale(0.97); opacity: 0.8; }
      50% { transform: scale(1.03); opacity: 0.2; }
      100% { transform: scale(0.97); opacity: 0.8; }
    }

    /* HUD Status Pill */
    .hud-status-pill {
      position: absolute;
      bottom: 14px;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(56, 189, 248, 0.4);
      color: #38bdf8;
      font-size: 12.5px;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      letter-spacing: 0.2px;
      transition: all 0.2s;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
    .hud-status-pill.success {
      background: rgba(16, 185, 129, 0.95);
      border-color: #34d399;
      color: #ffffff;
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.6);
    }
    .hud-status-pill.failed {
      background: rgba(239, 68, 68, 0.9);
      border-color: #f87171;
      color: #ffffff;
    }

    /* Camera States */
    .camera-loading-overlay, .camera-error-overlay {
      position: absolute;
      inset: 0;
      background: #090d16;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      font-size: 13px;
      padding: 20px;
    }
    .cyber-spinner {
      width: 42px;
      height: 42px;
      border: 3px solid rgba(56, 189, 248, 0.2);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 12px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Confidence Bar */
    .confidence-bar-container {
      margin-top: 14px;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 10px 14px;
    }
    .confidence-info {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 6px;
    }
    .score-num {
      color: #38bdf8;
      font-weight: 800;
    }
    .score-num.high {
      color: #10b981;
    }
    .confidence-track {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .confidence-fill {
      height: 100%;
      background: linear-gradient(90deg, #38bdf8, #818cf8);
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .confidence-fill.verified {
      background: linear-gradient(90deg, #10b981, #34d399);
    }

    /* Modal Actions */
    .modal-actions-box {
      margin-top: 18px;
    }
    .enroll-instructions {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.04);
      padding: 8px 12px;
      border-radius: 10px;
    }

    .btn-cyber-primary {
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      color: #ffffff;
      border: none;
      font-weight: 700;
      font-size: 13.5px;
      padding: 11px 20px;
      border-radius: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 4px 15px rgba(14, 165, 233, 0.35);
      transition: all 0.2s;
    }
    .btn-cyber-primary:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(14, 165, 233, 0.5);
    }
    .btn-cyber-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-outline-cyan {
      background: transparent;
      border: 1px solid #38bdf8;
      color: #38bdf8;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-outline-cyan:hover {
      background: rgba(56, 189, 248, 0.15);
    }

    .btn-text-link {
      background: none;
      border: none;
      color: #38bdf8;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      transition: color 0.15s;
    }
    .btn-text-link:hover {
      color: #7dd3fc;
      text-decoration: underline;
    }
    .btn-text-link.text-muted {
      color: #94a3b8;
    }

    .password-fallback-box {
      margin-bottom: 12px;
      animation: fadeIn 0.2s ease;
    }
    .cyber-input {
      background: #090d16;
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #ffffff;
      border-radius: 10px;
      padding: 8px 12px;
    }
    .cyber-input:focus {
      border-color: #38bdf8;
      outline: none;
      box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
    }

    .text-cyan { color: #38bdf8; }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class FaceLockModalComponent implements OnInit, OnDestroy {
  public faceService = inject(FaceAuthService);
  public lang = inject(LanguageService);
  private toast = inject(ToastService);
  private auth = inject(AuthService);
  private router = inject(Router);

  // Inputs
  mode = input<FaceModalMode>('UNLOCK');
  allowDismiss = input<boolean>(true);
  targetEmail = input<string>('');

  // Outputs
  closed = output<void>();
  enrolled = output<any>();
  unlocked = output<any>();

  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;

  cameraActive = signal<boolean>(false);
  cameraError = signal<string | null>(null);
  isScanning = signal<boolean>(true);
  isCapturing = signal<boolean>(false);
  matchState = signal<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  matchConfidence = signal<number>(0);
  enrollProgress = signal<number>(0);
  statusMessage = signal<string>('');

  // Remote QR Phone Unlock State
  unlockMethod = signal<'WEBCAM' | 'PHONE_QR'>('WEBCAM');
  remoteSessionId = signal<string>('');
  remoteUnlockUrl = signal<string>('');
  qrCodeDataUrl = signal<string>('');
  private pollInterval: any = null;

  // Fallback password
  showPasswordFallback = signal<boolean>(false);
  fallbackPassword = '';
  isUnlockingWithPassword = false;

  private mediaStream: MediaStream | null = null;
  private scanInterval: any = null;
  private isVerifyingNow = false;

  ngOnInit() {
    this.statusMessage.set(this.lang.isHindi() ? 'कैमरा कनेक्ट हो रहा है...' : 'Connecting camera...');
    setTimeout(() => {
      this.startCamera();
    }, 150);
  }

  ngOnDestroy() {
    this.stopCamera();
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  setUnlockMethod(method: 'WEBCAM' | 'PHONE_QR') {
    this.unlockMethod.set(method);
    if (method === 'PHONE_QR') {
      this.stopCamera();
      if (this.scanInterval) clearInterval(this.scanInterval);
      this.generateRemoteUnlockSession();
    } else {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.startCamera();
    }
  }

  async generateRemoteUnlockSession() {
    this.qrCodeDataUrl.set('');
    const email = this.targetEmail() || this.auth.currentUser()?.email || '';

    this.faceService.initRemoteUnlockSession(email).subscribe({
      next: async (res) => {
        if (res.success && res.data) {
          this.remoteSessionId.set(res.data.sessionId);
          this.remoteUnlockUrl.set(res.data.unlockUrl);

          try {
            const qrUrl = await QRCode.toDataURL(res.data.unlockUrl, {
              width: 200,
              margin: 1,
              color: { dark: '#020617', light: '#ffffff' }
            });
            this.qrCodeDataUrl.set(qrUrl);
          } catch (err) {
            console.error('QR code generation error:', err);
          }

          this.startRemoteStatusPolling(res.data.sessionId);
        }
      },
      error: (err) => {
        this.toast.error('Remote Session Error', err.error?.message || 'Could not generate mobile QR code.');
      }
    });
  }

  private startRemoteStatusPolling(sessionId: string) {
    if (this.pollInterval) clearInterval(this.pollInterval);

    this.pollInterval = setInterval(() => {
      if (this.matchState() === 'SUCCESS' || this.unlockMethod() !== 'PHONE_QR') {
        clearInterval(this.pollInterval);
        return;
      }

      this.faceService.getRemoteUnlockStatus(sessionId).subscribe({
        next: (res) => {
          if (res.success && res.data?.status === 'VERIFIED') {
            clearInterval(this.pollInterval);
            this.matchState.set('SUCCESS');
            this.faceService.playSuccessChime();
            this.toast.success('Mobile Face Verified', 'Desktop console unlocked via phone!');

            if (res.data.accessToken && res.data.refreshToken) {
              this.auth.setTokens(res.data.accessToken, res.data.refreshToken);
              if (res.data.user) {
                this.auth.currentUser.set(res.data.user);
                localStorage.setItem('mks_user', JSON.stringify(res.data.user));
              }
            }

            setTimeout(() => {
              if (this.mode() === 'LOCKSCREEN') {
                this.faceService.unlockAdminScreen();
              }
              this.unlocked.emit(res.data);
              this.closeModal();

              if (this.mode() === 'UNLOCK') {
                if (res.data?.user?.role === 'SUPER_ADMIN' || res.data?.user?.email === 'owner@mksbilling.com') {
                  this.router.navigate(['/admin/dashboard']);
                } else {
                  this.router.navigate(['/dashboard']);
                }
              }
            }, 600);
          } else if (res.data?.status === 'EXPIRED') {
            clearInterval(this.pollInterval);
            this.toast.info('QR Expired', 'QR code expired. Refreshing new code...');
            this.generateRemoteUnlockSession();
          }
        }
      });
    }, 1500);
  }

  copyRemoteUnlockUrl() {
    const url = this.remoteUnlockUrl();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Link Copied', 'Mobile unlock link copied to clipboard.');
    });
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    if (this.mode() !== 'LOCKSCREEN' || this.allowDismiss()) {
      this.closeModal();
    }
  }

  getBadgeTitle(): string {
    if (this.mode() === 'ENROLL') {
      return this.lang.isHindi() ? 'फेस लॉक रजिस्ट्रेशन' : 'Face Biometric Enrollment';
    }
    if (this.mode() === 'LOCKSCREEN') {
      return this.lang.isHindi() ? 'बायोमेट्रिक स्क्रीन लॉक' : 'Biometric Screen Lock';
    }
    return this.lang.isHindi() ? 'फेस अनलॉक' : 'Face ID Unlock';
  }

  getStatusIcon(): string {
    if (this.matchState() === 'SUCCESS') return 'fa-solid fa-circle-check';
    if (this.matchState() === 'FAILED') return 'fa-solid fa-triangle-exclamation';
    return 'fa-solid fa-spinner fa-spin';
  }

  async startCamera() {
    this.cameraError.set(null);
    this.cameraActive.set(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this device/browser.');
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
          this.statusMessage.set(this.lang.isHindi() ? 'कैमरे में सीधे देखें...' : 'Looking for face...');
          
          if (this.mode() === 'UNLOCK' || this.mode() === 'LOCKSCREEN') {
            this.startLiveFaceScanning();
          }
        };
      }
    } catch (err: any) {
      console.error('Camera init error:', err);
      this.cameraError.set(err.message || 'Camera access was blocked or unavailable.');
      this.statusMessage.set(this.lang.isHindi() ? 'कैमरा उपलब्ध नहीं है' : 'Camera unavailable');
    }
  }

  stopCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  /**
   * Continuous live face scan loop for UNLOCK and LOCKSCREEN modes (Instant Mobile Style)
   */
  startLiveFaceScanning() {
    if (this.scanInterval) clearInterval(this.scanInterval);
    this.isScanning.set(true);
    this.isVerifyingNow = false;

    this.scanInterval = setInterval(() => {
      if (!this.cameraActive() || this.matchState() === 'SUCCESS' || this.isVerifyingNow) return;
      this.performLiveFaceVerification();
    }, 120);
  }

  private performLiveFaceVerification() {
    if (!this.videoRef || !this.videoRef.nativeElement) return;
    const video = this.videoRef.nativeElement;
    if (video.readyState < 2) return;

    const capture = this.faceService.extractBiometricDescriptor(video, false);
    if (!capture) return;

    if (!capture.hasFace || !capture.descriptor || capture.descriptor.length < 10) {
      this.statusMessage.set(capture.error || (this.lang.isHindi() ? 'कैमरे के सामने सीधे देखें' : 'Look directly at camera'));
      this.matchState.set('IDLE');
      return;
    }

    // Face detected! Perform immediate biometric verification
    this.isVerifyingNow = true;
    this.statusMessage.set(this.lang.isHindi() ? 'चेहरा पहचान रहा है...' : 'Verifying face...');
    const email = this.targetEmail() || this.auth.currentUser()?.email || '';

    this.faceService.verifyFaceLogin(capture.descriptor, email).subscribe({
      next: (res) => {
        if (res.success) {
          clearInterval(this.scanInterval);
          this.matchState.set('SUCCESS');
          this.matchConfidence.set(res.data?.matchConfidence || 98);
          this.statusMessage.set(this.lang.isHindi() ? 'चेहरा सत्यापित! अनलॉक हो गया' : 'Face Verified! Access Granted');
          this.faceService.playSuccessChime();

          setTimeout(() => {
            if (this.mode() === 'LOCKSCREEN') {
              this.faceService.unlockAdminScreen();
            }
            this.unlocked.emit(res.data);
            this.closeModal();

            if (this.mode() === 'UNLOCK') {
              this.toast.success('Face ID Login', `${res.data?.user?.name || 'Admin'} logged in successfully.`);
              if (res.data?.user?.role === 'SUPER_ADMIN' || res.data?.user?.email === 'owner@mksbilling.com') {
                this.router.navigate(['/admin/dashboard']);
              } else {
                this.router.navigate(['/dashboard']);
              }
            }
          }, 80);
        } else {
          this.isVerifyingNow = false;
        }
      },
      error: (err) => {
        this.isVerifyingNow = false;
        const conf = err.error?.matchConfidence || 0;
        this.matchConfidence.set(conf);
        this.statusMessage.set(this.lang.isHindi() ? 'चेहरा स्कैन हो रहा है...' : 'Scanning face...');
      }
    });
  }

  /**
   * Fast Mobile-Style Biometric Enrollment (Direct, Instant Burst)
   */
  async captureAndEnrollFace() {
    if (!this.videoRef || !this.videoRef.nativeElement) return;
    const video = this.videoRef.nativeElement;

    this.isCapturing.set(true);
    const collectedSamples: number[][] = [];
    let capturedThumbnail = '';

    // Snapshot 1
    this.enrollProgress.set(40);
    this.statusMessage.set(this.lang.isHindi() ? 'चेहरा स्कैन हो रहा है...' : 'Scanning face...');
    await new Promise(r => setTimeout(r, 60));
    const s1 = this.faceService.extractBiometricDescriptor(video, true);
    if (!s1 || !s1.hasFace || !s1.descriptor || s1.descriptor.length < 10) {
      this.toast.error('Enrollment Error', 'Face not clearly visible. Please look straight into the camera.');
      this.isCapturing.set(false);
      this.enrollProgress.set(0);
      this.statusMessage.set(this.lang.isHindi() ? 'कैमरे के सामने सीधे देखें' : 'Look directly at camera');
      return;
    }
    collectedSamples.push(s1.descriptor);
    capturedThumbnail = s1.thumbnail;

    // Snapshot 2
    this.enrollProgress.set(75);
    await new Promise(r => setTimeout(r, 60));
    const s2 = this.faceService.extractBiometricDescriptor(video, false);
    if (s2 && s2.descriptor) collectedSamples.push(s2.descriptor);

    // Snapshot 3
    this.enrollProgress.set(95);
    await new Promise(r => setTimeout(r, 60));
    const s3 = this.faceService.extractBiometricDescriptor(video, false);
    if (s3 && s3.descriptor) collectedSamples.push(s3.descriptor);

    // Composite Average Vector
    const avgVector: number[] = new Array(collectedSamples[0].length).fill(0);
    for (const sample of collectedSamples) {
      for (let i = 0; i < sample.length; i++) {
        avgVector[i] += sample[i] / collectedSamples.length;
      }
    }

    const norm = Math.sqrt(avgVector.reduce((a, b) => a + b * b, 0));
    const finalDescriptor = norm > 0 ? avgVector.map(v => Number((v / norm).toFixed(5))) : avgVector;

    this.faceService.registerFace(finalDescriptor, capturedThumbnail, true).subscribe({
      next: (res) => {
        this.enrollProgress.set(100);
        this.isCapturing.set(false);
        this.matchState.set('SUCCESS');
        this.statusMessage.set(this.lang.isHindi() ? 'फेस लॉक 100% सफलतापूर्वक सेट हो गया!' : 'Face Profile Successfully Registered!');
        this.faceService.playSuccessChime();
        this.toast.success('Face Enrolled', 'Face biometric profile is now active.');
        this.enrolled.emit(res.data);

        setTimeout(() => {
          this.closeModal();
        }, 300);
      },
      error: (err) => {
        this.isCapturing.set(false);
        this.enrollProgress.set(0);
        this.toast.error('Registration Failed', err.error?.message || 'Could not register face biometric.');
      }
    });
  }

  triggerManualScan() {
    this.matchState.set('IDLE');
    this.startLiveFaceScanning();
  }

  togglePasswordFallback() {
    this.showPasswordFallback.update(val => !val);
  }

  verifyPasswordUnlock() {
    if (!this.fallbackPassword) return;
    this.isUnlockingWithPassword = true;

    const email = this.auth.currentUser()?.email || this.targetEmail() || 'owner@mksbilling.com';

    this.auth.login({ email, password: this.fallbackPassword }).subscribe({
      next: (res) => {
        this.isUnlockingWithPassword = false;
        this.faceService.unlockAdminScreen();
        this.toast.success('Unlocked', 'Admin Console unlocked with password.');
        this.unlocked.emit(res.data);
        this.closeModal();
      },
      error: (err) => {
        this.isUnlockingWithPassword = false;
        this.toast.error('Password Incorrect', 'The password you entered is incorrect.');
      }
    });
  }

  closeModal() {
    this.stopCamera();
    this.closed.emit();
  }
}

