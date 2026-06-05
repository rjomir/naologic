import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ChangeDetectionStrategy,
  OnDestroy,
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
export class WorkOrderBarComponent implements OnDestroy {
  @Input({ required: true }) workOrder!: WorkOrderDocument;
  @Input() barSize: BarSize = 'md';
  @Output() editOrder = new EventEmitter<WorkOrderDocument>();
  @Output() deleteOrder = new EventEmitter<string>();

  menuOpen = signal(false);
  dropdownTop = signal(0);
  dropdownRight = signal(0);

  tooltipVisible = signal(false);
  tooltipTop = signal(0);
  tooltipLeft = signal(0);

  private _tooltipTimer: ReturnType<typeof setTimeout> | null = null;

  showTooltip(event: MouseEvent): void {
    const x = event.clientX;
    const y = event.clientY;
    this._tooltipTimer = setTimeout(() => {
      this.tooltipTop.set(y);
      this.tooltipLeft.set(x + 12);
      this.tooltipVisible.set(true);
    }, 200);
  }

  hideTooltip(): void {
    if (this._tooltipTimer !== null) {
      clearTimeout(this._tooltipTimer);
      this._tooltipTimer = null;
    }
    this.tooltipVisible.set(false);
  }

  ngOnDestroy(): void {
    this.hideTooltip();
  }

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
}
