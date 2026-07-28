import { cn } from '@/utils/cn';
import { formatDuration, formatSpokenDuration } from '@/utils/time';
import type { Phase, TimerStatus } from '@/types';

export const PHASE_LABEL: Record<Phase, string> = {
  focus: 'Foco',
  shortBreak: 'Descanso corto',
  longBreak: 'Descanso largo',
};

/**
 * Texto de la fase.
 *
 * `finished` no siempre significa "se terminó todo": en Pomodoro sin encadenado
 * automático, el timer queda en `finished` mostrando la fase SIGUIENTE ya
 * cargada y esperando que el usuario la arranque. Decirle "Completado" a un
 * descanso de 5:00 que todavía no empezó sería mentira, así que el cartel
 * depende del reloj y no sólo del estado.
 */
export function phaseCaption(phase: Phase, status: TimerStatus, remainingMs: number): string {
  if (status === 'finished' && remainingMs <= 0) return 'Completado';
  if (status === 'finished') return `${PHASE_LABEL[phase]} · listo`;
  return PHASE_LABEL[phase];
}

interface TimeReadoutProps {
  remainingMs: number;
  phase: Phase;
  status: TimerStatus;
  className?: string;
  /** Ocultar la etiqueta de fase en skins que ya la comunican visualmente. */
  showPhase?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'text-2xl sm:text-3xl',
  md: 'text-4xl sm:text-5xl',
  lg: 'text-6xl sm:text-7xl',
} as const;

/**
 * Lectura del tiempo, compartida por las skins.
 *
 * `aria-live="off"` es deliberado: un valor que cambia cada segundo anunciado
 * por un lector de pantalla sería insoportable. El tiempo restante se comunica
 * bajo demanda vía `aria-label` sobre el contenedor del timer.
 */
export function TimeReadout({ remainingMs, phase, status, className, showPhase = true, size = 'md' }: TimeReadoutProps) {
  return (
    <div className={cn('flex flex-col items-center gap-1 select-none', className)}>
      {showPhase && (
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-faint">
          {phaseCaption(phase, status, remainingMs)}
        </span>
      )}
      <span
        className={cn('tabular font-light leading-none tracking-tight text-ink transition-opacity', SIZES[size], {
          'opacity-45': status === 'paused',
        })}
        aria-live="off"
        title={formatSpokenDuration(remainingMs)}
      >
        {formatDuration(remainingMs)}
      </span>
    </div>
  );
}
