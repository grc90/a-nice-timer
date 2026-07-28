import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { IconButton } from './Button';
import { MinusIcon, PlusIcon } from './Icons';

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, children, className }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-[0.8125rem] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </label>
  );
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
}

export function TextInput({ value, onChange, placeholder, maxLength, autoFocus }: TextInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      className={cn(
        'h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink',
        'placeholder:text-faint transition-colors',
        'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
      )}
    />
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Sufijo mostrado dentro del campo, p. ej. "min". */
  unit?: string;
}

/**
 * Campo numérico con botones de +/-.
 *
 * En mobile los steppers ganan a escribir un número; en desktop el input sigue
 * siendo editable directamente. Por eso conviven los dos.
 */
export function Stepper({ value, onChange, min = 1, max = 999, step = 1, unit }: StepperProps) {
  const id = useId();
  const clampValue = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="flex items-center gap-2">
      <IconButton
        label="Restar"
        size="sm"
        variant="secondary"
        onClick={() => onChange(clampValue(value - step))}
        disabled={value <= min}
      >
        <MinusIcon />
      </IconButton>

      <div className="relative flex-1">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            // Un campo vacío produce NaN mientras el usuario borra para reescribir:
            // ignorarlo evita que el valor salte a `min` en medio de la edición.
            if (!Number.isNaN(parsed)) onChange(clampValue(parsed));
          }}
          className={cn(
            'tabular h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-center text-sm text-ink',
            'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            unit && 'pr-9',
          )}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{unit}</span>
        )}
      </div>

      <IconButton
        label="Sumar"
        size="sm"
        variant="secondary"
        onClick={() => onChange(clampValue(value + step))}
        disabled={value >= max}
      >
        <PlusIcon />
      </IconButton>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center gap-3 rounded-xl py-1.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-faint">{description}</span>}
      </span>
      <span
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-accent' : 'bg-surface-2 border border-line',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-200 ease-out',
            checked ? 'left-[1.375rem]' : 'left-1',
          )}
        />
      </span>
    </button>
  );
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}

export function SegmentedControl<T extends string>({ value, onChange, options, className }: SegmentedControlProps<T>) {
  return (
    <div className={cn('inline-flex rounded-xl border border-line bg-surface-2 p-0.5', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            'flex-1 rounded-[0.6rem] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-150',
            value === option.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}

export function Slider({ value, onChange, min = 0, max = 1, step = 0.01, label }: SliderProps) {
  const percent = ((value - min) / (max - min)) * 100;

  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      // El gradiente pinta la porción recorrida sin necesidad de un track extra.
      style={{
        background: `linear-gradient(to right, var(--c-accent) ${percent}%, var(--c-border) ${percent}%)`,
      }}
      className={cn(
        'h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none',
        '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4',
        '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent',
        '[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--c-surface)]',
        '[&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-transform',
        'active:[&::-webkit-slider-thumb]:scale-110',
        '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2',
        '[&::-moz-range-thumb]:border-[var(--c-surface)] [&::-moz-range-thumb]:bg-accent',
      )}
    />
  );
}

/** Tecla renderizada como tecla física, para el panel de atajos. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line bg-surface-2 px-1.5 font-sans text-[0.6875rem] font-medium text-muted shadow-[0_1px_0_var(--c-border)]">
      {children}
    </kbd>
  );
}
