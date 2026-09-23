import { Component, inject, signal, ElementRef, ViewChild, AfterViewChecked, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiAssistantService, AiMessage, QuickPrompt } from '../../../core/services/ai-assistant.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-ai-assistant-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-assistant-modal.component.html',
  styleUrls: ['./ai-assistant-modal.component.css']
})
export class AiAssistantModalComponent implements AfterViewChecked {
  protected ai = inject(AiAssistantService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private ngZone = inject(NgZone);

  @ViewChild('chatScrollContainer') chatScrollContainer!: ElementRef;

  userInput = signal<string>('');
  isListening = signal<boolean>(false);
  isSpeaking = signal<boolean>(false);
  isExpanded = signal<boolean>(false);
  copiedId = signal<string>('');

  private speechRecognition: any = null;
  private shouldScrollToBottom = false;

  constructor() {
    this.initSpeechRecognition();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  scrollToBottom() {
    try {
      if (this.chatScrollContainer) {
        this.chatScrollContainer.nativeElement.scrollTop = this.chatScrollContainer.nativeElement.scrollHeight;
      }
    } catch (e) {}
  }

  sendMessage() {
    const text = this.userInput().trim();
    if (!text) return;
    this.ai.askQuestion(text);
    this.userInput.set('');
    this.shouldScrollToBottom = true;
  }

  selectPrompt(prompt: QuickPrompt) {
    this.ai.askQuestion(prompt.query);
    this.shouldScrollToBottom = true;
  }

  filterCategory(cat: 'ALL' | 'BILLING' | 'CREDIT' | 'GROWTH' | 'GST' | 'STOCK') {
    this.ai.selectedCategory.set(cat);
  }

  getFilteredPrompts(): QuickPrompt[] {
    const cat = this.ai.selectedCategory();
    if (cat === 'ALL') return this.ai.quickPrompts;
    return this.ai.quickPrompts.filter(p => p.category === cat);
  }

  navigateAction(action: any) {
    if (action.route) {
      this.ai.closeChat();
      this.router.navigate([action.route], { queryParams: action.queryParams || {} });
    }
  }

  copyText(msgId: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedId.set(msgId);
      this.toast.success('Copied! 📋', 'समाधान क्लिपबोर्ड में कॉपी हो गया!');
      setTimeout(() => this.copiedId.set(''), 2000);
    });
  }

  shareOnWhatsApp(text: string) {
    const cleanText = text.replace(/[*_~`]/g, '');
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(cleanText)}`;
    window.open(url, '_blank');
  }

  // 🎙️ Voice Speech Recognition & Live Audio Visualizer Engine
  audioLevel = signal<number>(0);
  selectedVoiceLang = signal<'hi-IN' | 'en-IN'>('hi-IN');
  private audioContext: AudioContext | null = null;
  private audioStream: MediaStream | null = null;
  private animFrameId: any = null;

  initSpeechRecognition() {
    // Verified on demand during toggleVoiceInput
  }

  async toggleVoiceInput() {
    if (this.isListening()) {
      this.stopListeningAndSend();
      return;
    }

    const windowObj = window as any;
    const SpeechRecognitionClass = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition || windowObj.mozSpeechRecognition;

    if (!SpeechRecognitionClass) {
      this.toast.warning('Browser Not Supported', 'आपका ब्राउज़र वॉइस इनपुट सपोर्ट नहीं करता। कृपया Google Chrome या Edge का उपयोग करें।');
      return;
    }

    try {
      // 1. Request hardware microphone permission explicitly
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.startAudioVisualizer(this.audioStream);
        } catch (micErr: any) {
          console.warn('Microphone permission warning:', micErr);
          if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
            this.toast.error('माइक की अनुमति दें', 'कृपया ब्राउज़र एड्रेस बार में लॉक आइकॉन 🔒 पर क्लिक करके Microphone: Allow करें।');
            return;
          }
        }
      }

      // 2. Instantiate fresh SpeechRecognition instance
      this.speechRecognition = new SpeechRecognitionClass();
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = true;
      this.speechRecognition.lang = this.selectedVoiceLang();
      this.speechRecognition.maxAlternatives = 1;

      this.speechRecognition.onstart = () => {
        this.ngZone.run(() => {
          this.isListening.set(true);
          this.toast.info('🎙️ माइक चालू है...', 'कृपया बोलें (जैसे: "उधार कैसे वसूलें?")...');
        });
      };

      this.speechRecognition.onresult = (event: any) => {
        this.ngZone.run(() => {
          let text = '';
          for (let i = 0; i < event.results.length; i++) {
            text += event.results[i][0].transcript;
          }
          if (text) {
            this.userInput.set(text);
          }
        });
      };

      this.speechRecognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        this.ngZone.run(() => {
          if (event.error === 'not-allowed') {
            this.toast.error('माइक अनुमति आवश्यक', 'कृपया ब्राउज़र में माइक की अनुमति (Allow) दें।');
          } else if (event.error === 'no-speech') {
            this.toast.info('कोई आवाज़ नहीं मिली', 'कृपया माइक के पास आकर दोबारा बोलें या टाइप करें।');
          } else if (event.error === 'network') {
            this.toast.warning('इंटरनेट जरूरी', 'वॉइस इनपुट के लिए इंटरनेट चालू होना चाहिए।');
          }
          this.cleanupAudio();
        });
      };

      this.speechRecognition.onend = () => {
        this.ngZone.run(() => {
          this.cleanupAudio();
          // If we captured words, automatically send
          if (this.userInput().trim()) {
            setTimeout(() => {
              this.sendMessage();
            }, 300);
          }
        });
      };

      this.speechRecognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      this.cleanupAudio();
      this.toast.warning('माइक एरर', 'माइक शुरू नहीं हो सका। कृपया दोबारा क्लिक करें।');
    }
  }

  startAudioVisualizer(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(stream);
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!this.isListening()) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const level = Math.min(100, Math.round((avg / 128) * 100));
        this.ngZone.run(() => {
          this.audioLevel.set(level);
        });
        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('Audio visualizer init error:', e);
    }
  }

  stopListeningAndSend() {
    if (this.speechRecognition) {
      try {
        this.speechRecognition.stop();
      } catch (e) {}
    }
    this.cleanupAudio();
    if (this.userInput().trim()) {
      this.sendMessage();
    }
  }

  cleanupAudio() {
    this.isListening.set(false);
    this.audioLevel.set(0);
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach(t => t.stop());
      this.audioStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
  }

  toggleVoiceLanguage() {
    const next = this.selectedVoiceLang() === 'hi-IN' ? 'en-IN' : 'hi-IN';
    this.selectedVoiceLang.set(next);
    this.toast.info('Language Changed', next === 'hi-IN' ? '🇮🇳 हिन्दी वॉइस मोड' : '🇬🇧 English Voice Mode');
  }

  // Text to Speech (आवाज़ में जवाब सुनें)
  speakText(text: string) {
    if (!('speechSynthesis' in window)) return;
    if (this.isSpeaking()) {
      window.speechSynthesis.cancel();
      this.isSpeaking.set(false);
      return;
    }

    const cleanText = text.replace(/[*_~`#•]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95;

    utterance.onend = () => this.isSpeaking.set(false);
    utterance.onerror = () => this.isSpeaking.set(false);

    this.isSpeaking.set(true);
    window.speechSynthesis.speak(utterance);
  }

  formatMessageText(text: string): string {
    if (!text) return '';
    // Format bold markdown **text**
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Format italic *text*
    formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Format newlines
    formatted = formatted.replace(/\n/g, '<br/>');
    return formatted;
  }
}
