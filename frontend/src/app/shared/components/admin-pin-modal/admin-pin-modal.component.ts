import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSecurityService } from '../../../core/services/admin-security.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-pin-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-pin-modal.component.html',
  styles: [`
    .pin-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid #cbd5e1;
      background: white;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .pin-dot.filled {
      background: #4f46e5;
      border-color: #4f46e5;
      transform: scale(1.15);
      box-shadow: 0 0 10px rgba(79, 70, 229, 0.5);
    }
    .keypad-btn {
      height: 56px;
      font-size: 20px;
      font-weight: 800;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      background: white;
      color: #1e293b;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
      user-select: none;
    }
    .keypad-btn:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.06);
    }
    .keypad-btn:active {
      transform: scale(0.96);
      background: #e2e8f0;
    }
    .action-btn {
      background: #f8fafc;
      color: #64748b;
      font-size: 14px;
      font-weight: 700;
    }
  `]
})
export class AdminPinModalComponent implements OnInit {
  public adminSecurity = inject(AdminSecurityService);
  public auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  pinDigits = signal<string[]>([]);
  scrambledNumbers = signal<number[]>([]);
  isLoading = signal<boolean>(false);
  isRecoveryMode = signal<boolean>(false);

  // Recovery Form State
  recoveryKey = '';
  newRecoveryPin = '';
  confirmRecoveryPin = '';
  isRecovering = signal<boolean>(false);

  ngOnInit() {
    this.reshuffleKeypad();
  }

  reshuffleKeypad() {
    this.scrambledNumbers.set(this.adminSecurity.generateScrambledKeypad());
  }

  appendDigit(num: number) {
    if (this.adminSecurity.isLockedOut()) return;
    const current = this.pinDigits();
    if (current.length < 6) {
      const updated = [...current, String(num)];
      this.pinDigits.set(updated);
      
      // Auto-submit when 6 digits entered
      if (updated.length === 6) {
        this.submitPin(updated.join(''));
      }
    }
  }

  backspace() {
    const current = this.pinDigits();
    if (current.length > 0) {
      this.pinDigits.set(current.slice(0, -1));
    }
  }

  clearPin() {
    this.pinDigits.set([]);
  }

  submitPin(pinString?: string) {
    const pin = (pinString || this.pinDigits().join('')).trim();
    if (pin.length < 4 || pin.length > 6) {
      this.toast.warning('PIN Required', 'कृपया 4-6 अंकों का सुरक्षा पिन दर्ज करें।');
      return;
    }

    this.isLoading.set(true);
    this.adminSecurity.verifyPin(pin, (success) => {
      this.isLoading.set(false);
      if (success) {
        this.pinDigits.set([]);
      } else {
        this.pinDigits.set([]);
        this.reshuffleKeypad(); // Scramble on wrong attempt
      }
    });
  }

  // Keyboard number listener (0-9, Backspace, Enter, Escape)
  @HostListener('window:keydown', ['$event'])
  handleKeyboardInput(event: KeyboardEvent) {
    if (!this.adminSecurity.isPinModalOpen() || this.isRecoveryMode()) return;

    if (event.key >= '0' && event.key <= '9') {
      event.preventDefault();
      this.appendDigit(parseInt(event.key, 10));
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.backspace();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.pinDigits().length >= 4) {
        this.submitPin();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelAndExit();
    }
  }

  cancelAndExit() {
    if (confirm('क्या आप लॉगआउट करके बाहर जाना चाहते हैं? (Do you want to logout?)')) {
      this.adminSecurity.closePinChallenge();
      this.auth.logout();
    }
  }

  toggleRecoveryMode() {
    this.isRecoveryMode.update(val => !val);
    this.recoveryKey = '';
    this.newRecoveryPin = '';
    this.confirmRecoveryPin = '';
  }

  submitEmergencyRecovery() {
    if (!this.recoveryKey.trim()) {
      this.toast.warning('Key Required', 'कृपया 16-अक्षरों की इमरजेंसी रिकवरी की दर्ज करें।');
      return;
    }
    if (!/^\d{6}$/.test(this.newRecoveryPin.trim())) {
      this.toast.warning('PIN Required', 'नया मास्टर पिन 6 अंकों का संख्यात्मक होना चाहिए।');
      return;
    }
    if (this.newRecoveryPin !== this.confirmRecoveryPin) {
      this.toast.error('Mismatch', 'नया पिन और कन्फर्म पिन मेल नहीं खाते।');
      return;
    }

    this.isRecovering.set(true);
    this.adminSecurity.recoverMasterPin(this.recoveryKey.trim(), this.newRecoveryPin.trim()).subscribe({
      next: (res) => {
        this.isRecovering.set(false);
        if (res.success) {
          this.toast.success('पिन रीसेट सफल', 'आपका नया मास्टर पिन सेट हो गया है!');
          this.isRecoveryMode.set(false);
          this.pinDigits.set([]);
          this.reshuffleKeypad();
          // Auto verify with new pin
          this.adminSecurity.verifyPin(this.newRecoveryPin.trim());
        }
      },
      error: (err) => {
        this.isRecovering.set(false);
        this.toast.error('रिकवरी विफल', err.error?.message || 'अमान्य रिकवरी की!');
      }
    });
  }
}
