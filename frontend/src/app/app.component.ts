import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastService } from './core/services/toast.service';
import { AdminPinModalComponent } from './shared/components/admin-pin-modal/admin-pin-modal.component';
import { AiAssistantModalComponent } from './shared/components/ai-assistant-modal/ai-assistant-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AdminPinModalComponent, AiAssistantModalComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  toastService = inject(ToastService);
  toasts = this.toastService.toasts;

  getIcon(type: string): string {
    switch (type) {
      case 'success': return 'fa-circle-check';
      case 'error': return 'fa-circle-xmark';
      case 'warning': return 'fa-triangle-exclamation';
      default: return 'fa-circle-info';
    }
  }
}
