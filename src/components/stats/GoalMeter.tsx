import { formatDurationLabel } from '@/utils/time';
import { cn } from '@/utils/cn';

interface GoalMeterProps {
  currentMs: number;
  goalMs: number;
  label: string;
  size?: number;
  className?: string;
}

/**
 * Anillo de progreso hacia una meta.
 *
 * La pista sin llenar es un paso más claro **del mismo tono** que el relleno, no
 * un gris neutro: así el estado se lee a lo largo de todo el anillo y no sólo en
 * el arco pintado. Al superar la meta el anillo se completa y cambia el rótulo en
 * vez de seguir creciendo, porque un medidor que pasa del 100 % deja de tener
 * escala.
 */
export function GoalMeter({ currentMs, goalMs, label, size = 76, className }: GoalMeterProps) {
  const ratio = goalMs > 0 ? Math.min(1, currentMs / goalMs) : 0;
  const reached = goalMs > 0 && currentMs >= goalMs;

  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(ratio * 100);

  return (
    <div
      className={cn('flex items-center gap-3.5', className)}
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${formatDurationLabel(currentMs)} de ${formatDurationLabel(goalMs)}`}
    >
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--c-accent-soft)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--c-accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>

        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-ink">
          {percent}
          <span className="text-[0.625rem] font-normal text-faint">%</span>
        </span>
      </div>

      <div className="min-w-0">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-faint">{label}</p>
        <p className="mt-0.5 text-sm text-ink">
          {formatDurationLabel(currentMs)}
          <span className="text-faint"> de {formatDurationLabel(goalMs)}</span>
        </p>
        {reached && <p className="mt-0.5 text-xs font-medium text-accent">Meta cumplida</p>}
      </div>
    </div>
  );
}
