import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
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
import { NgbDatepickerModule, NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import type { WorkOrderDocument, WorkOrderStatus, PanelMode } from '../../models/types';
import { WorkOrderService } from '../../services/work-order.service';

const STATUS_OPTIONS: { value: WorkOrderStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
  { value: 'blocked', label: 'Blocked' },
];

function dateToNgb(iso: string): NgbDateStruct {
  const d = new Date(iso);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function ngbToIso(s: NgbDateStruct): string {
  return `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
}

function endAfterStart(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startDate')?.value as NgbDateStruct | null;
  const end = group.get('endDate')?.value as NgbDateStruct | null;
  if (!start || !end) return null;
  return ngbToIso(end) <= ngbToIso(start) ? { endBeforeStart: true } : null;
}

@Component({
  selector: 'app-work-order-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, NgbDatepickerModule],
  templateUrl: './work-order-panel.component.html',
  styleUrl: './work-order-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkOrderPanelComponent implements OnChanges {
  @Input() mode: PanelMode = 'create';
  @Input() workCenterId = '';
  @Input() prefillStartDate = '';
  @Input() editTarget: WorkOrderDocument | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly statusOptions = STATUS_OPTIONS;
  overlapError = '';

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private woService: WorkOrderService,
  ) {
    this.form = this.fb.group(
      {
        name: ['', Validators.required],
        status: ['open', Validators.required],
        startDate: [null as NgbDateStruct | null, Validators.required],
        endDate: [null as NgbDateStruct | null, Validators.required],
      },
      { validators: endAfterStart },
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mode'] || changes['editTarget'] || changes['prefillStartDate']) {
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
        startDate: dateToNgb(d.startDate),
        endDate: dateToNgb(d.endDate),
      });
    } else {
      const startNgb = this.prefillStartDate ? dateToNgb(this.prefillStartDate) : null;
      const endNgb = this.prefillStartDate
        ? dateToNgb(this.addDays(this.prefillStartDate, 7))
        : null;
      this.form.reset({
        name: '',
        status: 'open',
        startDate: startNgb,
        endDate: endNgb,
      });
    }
  }

  private addDays(iso: string, n: number): string {
    const d = new Date(iso);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, status, startDate, endDate } = this.form.value as {
      name: string;
      status: WorkOrderStatus;
      startDate: NgbDateStruct;
      endDate: NgbDateStruct;
    };

    const startIso = ngbToIso(startDate);
    const endIso = ngbToIso(endDate);
    const excludeId = this.mode === 'edit' ? this.editTarget?.docId : undefined;

    const overlap = this.woService.checkOverlap(startIso, endIso, this.workCenterId, excludeId);
    if (overlap) {
      this.overlapError = overlap;
      return;
    }

    this.overlapError = '';

    if (this.mode === 'edit' && this.editTarget) {
      this.woService.update(this.editTarget.docId, {
        name,
        status,
        startDate: startIso,
        endDate: endIso,
      });
    } else {
      this.woService.create({
        docType: 'workOrder',
        data: {
          name,
          status,
          workCenterId: this.workCenterId,
          startDate: startIso,
          endDate: endIso,
        },
      });
    }

    this.saved.emit();
  }

  onCancel(): void {
    this.closed.emit();
  }

  get title(): string {
    return 'Work Order Details';
  }

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
      return 'End date must be after start date';
    }
    return null;
  }
}
