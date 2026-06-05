import {
  Component,
  forwardRef,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ViewEncapsulation,
  inject,
  Input,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import {
  NgbDatepickerModule,
  NgbDateStruct,
  NgbPopoverModule,
  NgbPopover,
} from '@ng-bootstrap/ng-bootstrap';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

@Component({
  selector: 'app-datetime-picker',
  standalone: true,
  imports: [FormsModule, NgbDatepickerModule, NgbPopoverModule],
  templateUrl: './datetime-picker.component.html',
  styleUrl: './datetime-picker.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatetimePickerComponent),
      multi: true,
    },
  ],
})
export class DatetimePickerComponent implements ControlValueAccessor {
  @ViewChild('pop') pop!: NgbPopover;
  @Input() inputId = '';
  @Input() placeholder = 'MM.DD.YYYY, HH:MM';
  @Input() hasError = false;

  private readonly cdr = inject(ChangeDetectorRef);

  selectedDate: NgbDateStruct | null = null;
  selectedHour = 8;
  selectedMinute = 0;
  isDisabled = false;

  readonly hours: { value: number; label: string }[] = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: pad2(i),
  }));
  readonly minutes: { value: number; label: string }[] = [
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
  ].map(m => ({ value: m, label: pad2(m) }));

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private _onChange: (v: string | null) => void = () => {};
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private _onTouched: () => void = () => {};

  get displayValue(): string {
    if (!this.selectedDate) return '';
    const { year, month, day } = this.selectedDate;
    return `${pad2(month)}.${pad2(day)}.${year}, ${pad2(this.selectedHour)}:${pad2(this.selectedMinute)}`;
  }

  writeValue(value: string | null): void {
    if (!value) {
      this.selectedDate = null;
      this.selectedHour = 8;
      this.selectedMinute = 0;
    } else {
      const [year, month, day] = value.slice(0, 10).split('-').map(Number);
      this.selectedDate = { year, month, day };
      this.selectedHour = value.length >= 16 ? Number(value.slice(11, 13)) : 8;
      const rawMin = value.length >= 16 ? Number(value.slice(14, 16)) : 0;
      this.selectedMinute = (Math.round(rawMin / 5) * 5) % 60;
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.cdr.markForCheck();
  }

  onDateSelect(date: NgbDateStruct): void {
    this.selectedDate = date;
    this.emit();
    this.cdr.markForCheck();
  }

  onHourChange(event: Event): void {
    this.selectedHour = Number((event.target as HTMLSelectElement).value);
    this.emit();
  }

  onMinuteChange(event: Event): void {
    this.selectedMinute = Number((event.target as HTMLSelectElement).value);
    this.emit();
  }

  onDone(): void {
    this.pop.close();
  }

  onPopoverHidden(): void {
    this._onTouched();
  }

  private emit(): void {
    if (!this.selectedDate) {
      this._onChange(null);
      return;
    }
    const { year, month, day } = this.selectedDate;
    this._onChange(
      `${year}-${pad2(month)}-${pad2(day)}T${pad2(this.selectedHour)}:${pad2(this.selectedMinute)}:00`,
    );
  }
}
