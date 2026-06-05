import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import type { WorkOrderDocument, WorkOrderStatus, PanelMode } from '../../models/types';
import { WorkOrderService } from '../../services/work-order.service';
import { DatetimePickerComponent } from './datetime-picker.component';

const STATUS_OPTIONS: { value: WorkOrderStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'blocked', label: 'Blocked' },
];

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDatetime')?.value as string | null;
  const end = group.get('endDatetime')?.value as string | null;
  if (!start || !end) return null;
  return end <= start ? { endBeforeStart: true } : null;
}

@Component({
  selector: 'app-work-order-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, DatetimePickerComponent],
  templateUrl: './work-order-panel.component.html',
  styleUrl: './work-order-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderPanelComponent implements OnChanges {
  @Input() mode: PanelMode = 'create';
  @Input() workCenterId = '';
  @Input() prefillStartDatetime = '';
  @Input() prefillEndDatetime = '';
  @Input() editTarget: WorkOrderDocument | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly statusOptions = STATUS_OPTIONS;
  overlapError = '';
  saving = signal(false);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onCancel();
  }

  private readonly fb = inject(FormBuilder);
  private readonly woService = inject(WorkOrderService);

  form: FormGroup = this.fb.group(
    {
      name: ['', Validators.required],
      status: ['open', Validators.required],
      startDatetime: [null as string | null, Validators.required],
      endDatetime: [null as string | null, Validators.required],
    },
    { validators: endAfterStart },
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['mode'] ||
      changes['editTarget'] ||
      changes['prefillStartDatetime'] ||
      changes['prefillEndDatetime']
    ) {
      this.overlapError = '';
      this.initForm();
    }
  }

  private initForm(): void {
    if (this.mode === 'edit' && this.editTarget) {
      const d = this.editTarget.data;
      this.form.reset({
        name: d.name,
        status: d.status,
        startDatetime: this.ensureTime(d.startDate, '08:00'),
        endDatetime: this.ensureTime(d.endDate, '17:00'),
      });
    } else {
      this.form.reset({
        name: '',
        status: 'open',
        startDatetime: this.prefillStartDatetime || null,
        endDatetime: this.prefillEndDatetime || null,
      });
    }
  }

  private ensureTime(iso: string, defaultHHMM: string): string {
    return iso.includes('T') ? iso : `${iso}T${defaultHHMM}:00`;
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, status, startDatetime, endDatetime } = this.form.value as {
      name: string;
      status: WorkOrderStatus;
      startDatetime: string;
      endDatetime: string;
    };

    const excludeId = this.mode === 'edit' ? this.editTarget?.docId : undefined;

    const overlap = this.woService.checkOverlap(
      startDatetime,
      endDatetime,
      this.workCenterId,
      excludeId,
    );
    if (overlap) {
      this.overlapError = overlap;
      return;
    }

    this.overlapError = '';
    this.saving.set(true);

    try {
      if (this.mode === 'edit' && this.editTarget) {
        await this.woService.update(this.editTarget.docId, {
          name,
          status,
          startDate: startDatetime,
          endDate: endDatetime,
        });
      } else {
        await this.woService.create({
          name,
          status,
          workCenterId: this.workCenterId,
          startDate: startDatetime,
          endDate: endDatetime,
        });
      }
      this.saved.emit();
    } catch {
      this.overlapError = 'Failed to save. Please try again.';
    } finally {
      this.saving.set(false);
    }
  }

  onCancel(): void {
    this.closed.emit();
  }

  readonly title = 'Work Order Details';

  get submitLabel(): string {
    return this.mode === 'edit' ? 'Save' : 'Create';
  }

  hasError(field: string, error?: string): boolean {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.touched) return false;
    return error ? ctrl.hasError(error) : ctrl.invalid;
  }

  get groupError(): string | null {
    if (this.form.touched && this.form.hasError('endBeforeStart')) {
      return 'End must be after start';
    }
    return null;
  }
}
