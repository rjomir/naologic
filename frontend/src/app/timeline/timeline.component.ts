import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgSelectModule } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
import { WorkOrderService } from '../services/work-order.service';
import { WorkOrderBarComponent } from './work-order-bar/work-order-bar.component';
import { WorkOrderPanelComponent } from './work-order-panel/work-order-panel.component';
import { computeNotches, type TimelineNotch } from './utils/compute-notches';
import { anchorZoom, pxToMs } from './utils/viewport.utils';
import { getBarSize, type BarSize } from './utils/activity-size.model';
import type { PanelMode, WorkOrderDocument, TimelineColumn } from '../models/types';

const PX_PER_DAY_PRESETS = { day: 50, week: 20, month: 6 } as const;
type ZoomPreset = keyof typeof PX_PER_DAY_PRESETS;
const INITIAL_DAYS_BEFORE = 30;
const INITIAL_DAYS_AFTER = 90;
const LEFT_COL_PX = 220;
/** How far from the edge (px) before we expand the timeline. */
const SCROLL_EXPAND_THRESHOLD = 300;
/** Days to add on each expansion. */
const EXPAND_DAYS = 30;

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [
    CommonModule,
    NgSelectModule,
    FormsModule,
    WorkOrderBarComponent,
    WorkOrderPanelComponent,
  ],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineComponent implements AfterViewInit {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLDivElement>;
  readonly woService = inject(WorkOrderService);
  readonly workCenters = this.woService.workCenters;
  readonly workOrders = this.woService.workOrders;

  today = new Date();
  hoveredRow: string | null = null;

  pixelsPerDay = signal<number>(PX_PER_DAY_PRESETS.day);
  zoomLevelValue: ZoomPreset = 'day';
  zoomOptions: { value: ZoomPreset; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  // Mutable day counts drive the timeline range so infinite scroll can expand either edge.
  private readonly daysBeforeToday = signal(INITIAL_DAYS_BEFORE);
  private readonly daysAfterToday = signal(INITIAL_DAYS_AFTER);
  /** Prevent concurrent left-edge expansions from fighting each other. */
  private expanding = false;

  readonly totalDays = computed(() => this.daysBeforeToday() + this.daysAfterToday());

  readonly timelineStart = computed<Date>(() => {
    const d = new Date(this.today);
    d.setDate(d.getDate() - this.daysBeforeToday());
    d.setHours(0, 0, 0, 0);
    return d;
  });

  readonly columns = computed<TimelineColumn[]>(() => {
    const origin = this.timelineStart();
    return Array.from({ length: this.totalDays() }, (_, i) => {
      const date = new Date(origin.getTime() + i * 86_400_000);
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date,
      };
    });
  });

  readonly totalWidth = computed(() => this.totalDays() * this.pixelsPerDay());
  readonly todayOffset = computed(() => this.dateToPx(this.today, this.timelineStart()));

  readonly majorNotches = computed<TimelineNotch[]>(() => {
    const cols = this.columns();
    if (!cols.length) return [];
    return computeNotches(
      cols[0].date.getTime(),
      cols[cols.length - 1].date.getTime() + 86_400_000,
      this.totalWidth(),
    );
  });

  getNotchLeft(notch: TimelineNotch): number {
    return this.dateToPx(notch.date, this.timelineStart());
  }

  panelVisible = signal(false);
  panelMode = signal<PanelMode>('create');
  panelWorkCenterId = signal('');
  panelPrefillDate = signal('');
  panelEditTarget = signal<WorkOrderDocument | null>(null);
  reflowing = signal(false);
  reflowResult = signal<string | null>(null);

  ngAfterViewInit(): void {
    this.scrollToToday();
  }

  onZoomChange(zoom: ZoomPreset): void {
    this.zoomLevelValue = zoom;
    this.pixelsPerDay.set(PX_PER_DAY_PRESETS[zoom]);
    setTimeout(() => this.scrollToToday(), 0);
  }

  onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const el = this.scrollContainer.nativeElement;
    const rect = el.getBoundingClientRect();
    const ts = this.timelineStart();
    const cursorContentX = event.clientX - rect.left - LEFT_COL_PX + el.scrollLeft;
    const cursorDateMs = ts.getTime() + (cursorContentX / this.pixelsPerDay()) * 86_400_000;
    const visibleDurationMs = ((el.clientWidth - LEFT_COL_PX) / this.pixelsPerDay()) * 86_400_000;
    const viewportFrom = cursorDateMs - (cursorContentX / el.scrollWidth) * visibleDurationMs;
    const viewportTo = viewportFrom + visibleDurationMs;
    const newDurationMs = (viewportTo - viewportFrom) * (event.deltaY < 0 ? 0.8 : 1.25);
    const anchorRatio = Math.max(
      0,
      Math.min(1, (event.clientX - rect.left - LEFT_COL_PX) / (rect.width - LEFT_COL_PX)),
    );
    const nv = anchorZoom(
      { from: viewportFrom, to: viewportTo },
      newDurationMs - visibleDurationMs,
      anchorRatio,
    );
    const newPxPerDay = Math.max(
      2,
      Math.min(300, (el.clientWidth - LEFT_COL_PX) / ((nv.to - nv.from) / 86_400_000)),
    );
    this.pixelsPerDay.set(newPxPerDay);
    this.syncZoomLabel(newPxPerDay);
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(
        0,
        ((cursorDateMs - this.timelineStart().getTime()) / 86_400_000) * newPxPerDay -
          (event.clientX - rect.left - LEFT_COL_PX),
      );
    });
  }

  /**
   * Called on the scroll container's (scroll) event.
   * Prepends columns when near the left edge, appends when near the right edge.
   * When prepending, the scroll position is shifted right by the added pixel width
   * so the visible content does not jump.
   */
  onScrollTimeline(event: Event): void {
    const el = event.target as HTMLDivElement;

    if (el.scrollLeft < SCROLL_EXPAND_THRESHOLD && !this.expanding) {
      this.expanding = true;
      this.daysBeforeToday.update(v => v + EXPAND_DAYS);
      // After Angular re-renders the wider grid, compensate scrollLeft so the
      // currently-visible content stays in place.
      setTimeout(() => {
        el.scrollLeft += EXPAND_DAYS * this.pixelsPerDay();
        this.expanding = false;
      }, 0);
    }

    const distFromRight = el.scrollWidth - el.scrollLeft - el.clientWidth;
    if (distFromRight < SCROLL_EXPAND_THRESHOLD) {
      this.daysAfterToday.update(v => v + EXPAND_DAYS);
    }
  }

  private syncZoomLabel(p: number): void {
    this.zoomLevelValue = p >= 30 ? 'day' : p >= 10 ? 'week' : 'month';
  }

  dateToPx(date: Date, from: Date): number {
    return ((date.getTime() - from.getTime()) / 86_400_000) * this.pixelsPerDay();
  }

  private pxToDate(px: number): Date {
    const ts = this.timelineStart();
    const ms = pxToMs(px, this.totalWidth(), {
      from: ts.getTime(),
      to: ts.getTime() + this.totalDays() * 86_400_000,
    });
    return new Date(ms);
  }

  getBarStyle(wo: WorkOrderDocument): Record<string, string> {
    const ts = this.timelineStart();
    const start = new Date(wo.data.startDate);
    const end = new Date(wo.data.endDate);
    const left = this.dateToPx(start, ts);
    const width = Math.max(this.dateToPx(end, ts) - left, this.pixelsPerDay() * 0.5);
    return { left: `${left}px`, width: `${width}px` };
  }

  getBarSizeFor(wo: WorkOrderDocument): BarSize {
    return getBarSize(parseFloat(this.getBarStyle(wo)['width']), this.totalWidth());
  }

  getOrdersForWc(wcId: string): WorkOrderDocument[] {
    return this.woService.getOrdersForWorkCenter(wcId);
  }

  onRowClick(event: Event, wcId: string): void {
    if ((event.target as HTMLElement).closest('app-work-order-bar')) return;
    if (!(event instanceof MouseEvent)) return;
    const el = this.scrollContainer.nativeElement;
    const rect = el.getBoundingClientRect();
    this.openCreatePanel(
      wcId,
      this.pxToDate(event.clientX - rect.left - LEFT_COL_PX + el.scrollLeft)
        .toISOString()
        .slice(0, 10),
    );
  }

  openCreatePanel(wcId: string, d: string): void {
    this.panelMode.set('create');
    this.panelWorkCenterId.set(wcId);
    this.panelPrefillDate.set(d);
    this.panelEditTarget.set(null);
    this.panelVisible.set(true);
  }

  openEditPanel(wo: WorkOrderDocument): void {
    this.panelMode.set('edit');
    this.panelWorkCenterId.set(wo.data.workCenterId);
    this.panelPrefillDate.set('');
    this.panelEditTarget.set(wo);
    this.panelVisible.set(true);
  }

  closePanel(): void {
    this.panelVisible.set(false);
  }
  onPanelSaved(): void {
    this.closePanel();
  }
  onEditOrder(wo: WorkOrderDocument): void {
    this.openEditPanel(wo);
  }
  onDeleteOrder(docId: string): void {
    void this.woService.delete(docId);
  }

  async onReflow(): Promise<void> {
    this.reflowing.set(true);
    this.reflowResult.set(null);
    try {
      const r = await this.woService.runReflow();
      if (r.updatedCount === 0) {
        this.reflowResult.set('Schedule is already valid — no changes needed.');
      } else {
        const delayStr =
          r.totalDelayMinutes > 0 ? ` Total delay: +${r.totalDelayMinutes} min.` : '';
        this.reflowResult.set(
          `Reflow complete: ${r.updatedCount} order(s) rescheduled.${delayStr}`,
        );
      }
    } catch {
      this.reflowResult.set('Reflow failed. Check server logs.');
    } finally {
      this.reflowing.set(false);
    }
  }

  goToToday(): void {
    this.scrollToToday();
  }

  scrollToToday(): void {
    const el = this.scrollContainer?.nativeElement;
    if (!el) return;
    el.scrollLeft = Math.max(0, this.todayOffset() - (el.clientWidth - LEFT_COL_PX) / 2);
  }
}
