import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SoundboxService {
  // Sound Box State
  isSoundBoxEnabled = signal<boolean>(true);
  isAnnouncing = signal<boolean>(false);
  lastAnnouncedAmount = signal<number>(0);

  /**
   * Play Paytm/PhonePe style multi-tone chime + Hindi Voice Announcement
   * e.g. "MKS Billing पर ₹500 का भुगतान प्राप्त हुआ! Payment Successful."
   */
  announcePayment(amount: number, shopName?: string, customerName?: string): void {
    if (!this.isSoundBoxEnabled() || amount <= 0) return;

    this.lastAnnouncedAmount.set(amount);
    this.isAnnouncing.set(true);

    // 1. Play Soundbox Multi-Frequency Chime
    this.playSoundboxChime(() => {
      // 2. Speak Hindi Voice Announcement
      this.speakHindiPayment(amount, shopName);
    });

    setTimeout(() => {
      this.isAnnouncing.set(false);
    }, 4000);
  }

  /**
   * Multi-tone Sound Box Chime using Web Audio API
   */
  private playSoundboxChime(onComplete?: () => void): void {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        if (onComplete) onComplete();
        return;
      }

      const ctx = new AudioCtx();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Classic Sound Box Melody (C5 -> E5 -> G5 -> C6)
      playTone(523.25, 0, 0.12);
      playTone(659.25, 0.1, 0.12);
      playTone(783.99, 0.2, 0.14);
      playTone(1046.50, 0.32, 0.35);

      setTimeout(() => {
        if (onComplete) onComplete();
      }, 450);
    } catch (e) {
      if (onComplete) onComplete();
    }
  }

  /**
   * Speak Announcement using Browser Web Speech Synthesis
   */
  private speakHindiPayment(amount: number, shopName?: string): void {
    try {
      if (!('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel(); // Clear any pending speech

      const rounded = Math.round(amount);
      const text = `${shopName || 'दुकान'} पर ${rounded} रुपये का भुगतान प्राप्त हुआ। Payment Successful!`;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95; // Natural clear pace
      utterance.pitch = 1.05; // Clear soundbox voice tone
      utterance.volume = 1.0;

      // Try finding Hindi voice
      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang === 'hi-IN' || v.lang.includes('hi') || v.name.includes('Hindi') || v.name.includes('India'));
      if (hindiVoice) {
        utterance.voice = hindiVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis not available:', e);
    }
  }
}
