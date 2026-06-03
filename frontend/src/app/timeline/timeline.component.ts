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
const TOTAL_DAYS_BEFORE = 30;
const TOTAL_DAYS_AFTER = 90;
const TOTAL_DAYS = TOTAL_DAYS_BEFORE + TOTAL_DAYS_AFTER;
const LEFT_COL_PX = 220;

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

  private readonly timelineStart: Date = (() => {
    const d = new Date(this.today);
    d.setDate(d.getDate() - TOTAL_DAYS_BEFORE);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  readonly columns = computed<TimelineColumn[]>(() => {
    const origin = this.timelineStart;
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const date = new Date(origin.getTime() + i * 86_400_000);
      return {
        key: date.toISOString().slice(0, 10),
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        date,
      };
    });
  });

  readonly totalWidth = computed(() => TOTAL_DAYS * this.pixelsPerDay());
  readonly todayOffset = computed(() => this.dateToPx(this.today, this.timelineStart));

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
    return this.dateToPx(notch.date, this.timelineStart);
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
    const cursorContentX = event.clientX - rect.left - LEFT_COL_PX + el.scrollLeft;
    const cursorDateMs =
      this.timelineStart.getTime() + (cursorContentX / this.pixelsPerDay()) * 86_400_000;
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
        ((cursorDateMs - this.timelineStart.getTime()) / 86_400_000) * newPxPerDay -
          (event.clientX - rect.left - LEFT_COL_PX),
      );
    });
  }

  private syncZoomLabel(p: number): void {
    this.zoomLevelValue = p >= 30 ? 'day' : p >= 10 ? 'week' : 'month';
  }

  dateToPx(date: Date, from: Date): number {
    return ((date.getTime() - from.getTime()) / 86_400_000) * this.pixelsPerDay();
  }

  private pxToDate(px: number): Date {
    const ms = pxToMs(px, this.totalWidth(), {
      from: this.timelineStart.getTime(),
      to: this.timelineStart.getTime() + TOTAL_DAYS * 86_400_000,
    });
    return new Date(ms);
  }

  getBarStyle(wo: WorkOrderDocument): Record<string, string> {
    const start = new Date(wo.data.startDate);
    const end = new Date(wo.data.endDate);
    const left = this.dateToPx(start, this.timelineStart);
    const width = Math.max(
      this.dateToPx(end, this.timelineStart) - left,
      this.pixelsPerDay() * 0.5,
    );
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
      this.reflowResult.set(
        r.updatedCount === 0
          ? 'Schedule is already valid — no changes needed.'
          : `Reflow complete: ${r.updatedCount} order(s) rescheduled.`,
      );
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
