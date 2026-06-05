import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  HostListener,
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

const PX_PER_DAY_PRESETS = { hour: 1440, day: 50, week: 20, month: 5 } as const;
type ZoomPreset = keyof typeof PX_PER_DAY_PRESETS;
const INITIAL_DAYS_BEFORE = 90;
const INITIAL_DAYS_AFTER = 270;
const HOUR_DAYS_BEFORE = 1;
const HOUR_DAYS_AFTER = 2;
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

  tooltipX = signal(0);
  tooltipY = signal(0);
  showClickTooltip = signal(false);
  ghostBarX = signal(-1);

  onGridMouseMove(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('app-work-order-bar')) {
      this.showClickTooltip.set(false);
      this.ghostBarX.set(-1);
      return;
    }
    this.tooltipX.set(event.clientX);
    this.tooltipY.set(event.clientY);
    this.showClickTooltip.set(true);

    const el = this.scrollContainer.nativeElement;
    const rect = el.getBoundingClientRect();
    this.ghostBarX.set(el.scrollLeft + event.clientX - rect.left - LEFT_COL_PX);
  }

  onGridMouseLeave(): void {
    this.showClickTooltip.set(false);
    this.ghostBarX.set(-1);
  }

  pixelsPerDay = signal<number>(PX_PER_DAY_PRESETS.month);
  zoomLevelValue: ZoomPreset = 'month';
  private readonly zoomPreset = signal<ZoomPreset>('month');
  zoomOptions: { value: ZoomPreset; label: string }[] = [
    { value: 'hour', label: 'Hour' },
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  // Mutable day counts drive the timeline range so infinite scroll can expand either edge.
  private readonly daysBeforeToday = signal(INITIAL_DAYS_BEFORE);
  private readonly daysAfterToday = signal(INITIAL_DAYS_AFTER);
  /** Prevent concurrent left-edge expansions from fighting each other. */
  private expanding = false;
  private readonly viewportWidth = signal(0);

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
    const vw = this.viewportWidth();
    return computeNotches(
      cols[0].date.getTime(),
      cols[cols.length - 1].date.getTime() + 86_400_000,
      this.totalWidth(),
      vw > 0 ? vw : undefined,
      this.zoomPreset(),
    );
  });

  readonly currentPeriodLabel = computed(() => {
    const labels: Record<ZoomPreset, string> = {
      hour: 'Current hour',
      day: 'Today',
      week: 'Current week',
      month: 'Current month',
    };
    return labels[this.zoomPreset()];
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
    this.updateViewportWidth();
    this.scrollToToday();
  }

  @HostListener('window:resize')
  updateViewportWidth(): void {
    const el = this.scrollContainer?.nativeElement;
    if (el) this.viewportWidth.set(el.clientWidth - LEFT_COL_PX);
  }

  onZoomChange(zoom: ZoomPreset): void {
    this.zoomLevelValue = zoom;
    this.zoomPreset.set(zoom);
    this.pixelsPerDay.set(PX_PER_DAY_PRESETS[zoom]);
    if (zoom === 'hour') {
      this.daysBeforeToday.set(HOUR_DAYS_BEFORE);
      this.daysAfterToday.set(HOUR_DAYS_AFTER);
    } else {
      this.daysBeforeToday.set(INITIAL_DAYS_BEFORE);
      this.daysAfterToday.set(INITIAL_DAYS_AFTER);
    }
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
      const addPx = EXPAND_DAYS * this.pixelsPerDay();
      this.daysBeforeToday.update(v => v + EXPAND_DAYS);
      // Double rAF: first frame lets Angular update the DOM width,
      // second frame compensates scrollLeft after the browser has painted.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollLeft += addPx;
          this.expanding = false;
        });
      });
    }

    const distFromRight = el.scrollWidth - el.scrollLeft - el.clientWidth;
    if (distFromRight < SCROLL_EXPAND_THRESHOLD) {
      this.daysAfterToday.update(v => v + EXPAND_DAYS);
    }
  }

  private syncZoomLabel(p: number): void {
    this.zoomLevelValue = p >= 80 ? 'hour' : p >= 30 ? 'day' : p >= 10 ? 'week' : 'month';
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

  // Returns YYYY-MM-DD in local time (not UTC) so click-to-date is timezone-correct.
  private pxToLocalDateStr(px: number): string {
    const d = this.pxToDate(px);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }

  getBarStyle(wo: WorkOrderDocument): Record<string, string> {
    const ts = this.timelineStart();
    const start = new Date(wo.data.startDate);
    const end = new Date(wo.data.endDate);
    const left = this.dateToPx(start, ts);
    // 36 px: sm padding (4) + gap (4) + menu-button (24) + sm padding (4) — ensures the button always fits
    const width = Math.max(this.dateToPx(end, ts) - left, 36);
    return { left: `${left}px`, width: `${width}px` };
  }

  getBarSizeFor(wo: WorkOrderDocument): BarSize {
    return getBarSize(parseFloat(this.getBarStyle(wo)['width']));
  }

  getOrdersForWc(wcId: string): WorkOrderDocument[] {
    return this.woService.getOrdersForWorkCenter(wcId);
  }

  isCurrentPeriod(notch: TimelineNotch): boolean {
    const now = this.today.getTime();
    const start = notch.date.getTime();
    return now >= start && now < start + notch.spanMs;
  }

  onRowClick(event: Event, wcId: string): void {
    if (!(event instanceof MouseEvent)) return;
    const target = event.target as HTMLElement;
    // Guard 1: direct click on left column (unscrolled state — element is in normal flow)
    if (target.closest('.left-col')) return;
    // Guard 2: bar click — handled by the bar component itself
    if (target.closest('app-work-order-bar')) return;
    const el = this.scrollContainer.nativeElement;
    const rect = el.getBoundingClientRect();
    // Guard 3: sticky left-col visual overlap (scrolled state — sticky element's layout
    // box is off-screen, so browser dispatches clicks to the grid-area behind it)
    const viewportX = event.clientX - rect.left;
    if (viewportX < LEFT_COL_PX) return;
    this.openCreatePanel(wcId, this.pxToLocalDateStr(viewportX - LEFT_COL_PX + el.scrollLeft));
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
          r.totalDelayMinutes > 0
            ? ` Total delay: +${this.humanizeMinutes(r.totalDelayMinutes)}.`
            : '';
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

  private humanizeMinutes(minutes: number): string {
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = Math.round(minutes % 60);
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
    return `${m}min`;
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
