import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  ChangeDetectionStrategy,
  OnDestroy,
  signal,
  computed,
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
  @Output() reschedule = new EventEmitter<{ docId: string; deltaX: number }>();

  menuOpen = signal(false);
  dropdownTop = signal(0);
  dropdownRight = signal(0);

  tooltipVisible = signal(false);
  tooltipTop = signal(0);
  tooltipLeft = signal(0);

  isDragging = signal(false);
  dragDeltaX = signal(0);
  readonly dragTransform = computed(() =>
    this.isDragging() ? `translateX(${this.dragDeltaX()}px)` : '',
  );

  private _tooltipTimer: ReturnType<typeof setTimeout> | null = null;
  private _dragStartX = 0;
  private _dragPointerId = -1;

  showTooltip(event: MouseEvent): void {
    if (this.isDragging()) return;
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

  onPointerDown(event: PointerEvent): void {
    if (this.barSize === 'xs') return;
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest('.bar__menu-btn')) return;
    event.preventDefault();
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    this._dragStartX = event.clientX;
    this._dragPointerId = event.pointerId;
    this.isDragging.set(true);
    this.dragDeltaX.set(0);
    this.hideTooltip();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging() || event.pointerId !== this._dragPointerId) return;
    this.dragDeltaX.set(event.clientX - this._dragStartX);
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging() || event.pointerId !== this._dragPointerId) return;
    const delta = this.dragDeltaX();
    this.isDragging.set(false);
    this.dragDeltaX.set(0);
    this._dragPointerId = -1;
    if (Math.abs(delta) > 5) {
      this.reschedule.emit({ docId: this.workOrder.docId, deltaX: delta });
    }
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
