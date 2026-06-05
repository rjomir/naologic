import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { WorkOrderDocument } from '../../models/types';
import type { BarSize } from '../utils/activity-size.model';

@Component({
  selector: 'app-work-order-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './work-order-bar.component.html',
  styleUrl: './work-order-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderBarComponent {
  @Input({ required: true }) workOrder!: WorkOrderDocument;
  @Input() barSize: BarSize = 'md';
  @Output() editOrder = new EventEmitter<WorkOrderDocument>();
  @Output() deleteOrder = new EventEmitter<string>();

  menuOpen = signal(false);
  dropdownTop = signal(0);
  dropdownRight = signal(0);

  toggleMenu(event: Event): void {
    event.stopPropagation();
    if (!this.menuOpen()) {
      const btn = event.currentTarget as HTMLElement;
      const rect = btn.getBoundingClientRect();
      this.dropdownTop.set(rect.bottom + 4);
      this.dropdownRight.set(window.innerWidth - rect.right);
    }
    this.menuOpen.update(v => !v);
  }

  onEdit(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.editOrder.emit(this.workOrder);
  }

  onDelete(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen.set(false);
    this.deleteOrder.emit(this.workOrder.docId);
  }

  @HostListener('document:click')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  get statusLabel(): string {
    const labels: Record<string, string> = {
      open: 'Open',
      'in-progress': 'In Progress',
      complete: 'Complete',
      blocked: 'Blocked',
    };
    return labels[this.workOrder.data.status] ?? this.workOrder.data.status;
  }

  get tooltipText(): string {
    const { name, status, startDate, endDate } = this.workOrder.data;
    return `${name}\nStatus: ${status}\n${startDate} → ${endDate}`;
  }
}
