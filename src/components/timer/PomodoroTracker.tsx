import { useTimerStore } from '@/store/timerStore';
import { cn } from '@/utils/cn';

/**
 * Progreso dentro del ciclo Pomodoro.
 *
 * Muestra los focos del ciclo actual, no el total histórico: la pregunta que
 * responde es "cuánto falta para el descanso largo". El total acumulado de la
 * sesión va al costado, en texto.
 */
export function PomodoroTracker({ className }: { className?: string }) {
  const mode = useTimerStore((s) => s.mode);
  const phase = useTimerStore((s) => s.phase);
  const status = useTimerStore((s) => s.status);
  const completedFocus = useTimerStore((s) => s.completedFocus);
  const cyclesBeforeLongBreak = useTimerStore((s) => s.pomodoro.cyclesBeforeLongBreak);

  if (mode !== 'pomodoro') return null;

  const cycleLength = Math.max(1, cyclesBeforeLongBreak);
  const doneInCycle = completedFocus % cycleLength;
  // Tras completar el último foco del ciclo, el módulo vuelve a 0 pero visualmente
  // corresponde mostrar el ciclo lleno hasta que empiece el próximo foco.
  const filled = doneInCycle === 0 && completedFocus > 0 && phase !== 'focus' ? cycleLength : doneInCycle;
  const activeIndex = phase === 'focus' && status !== 'idle' ? filled : -1;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex items-center gap-1.5" role="img" aria-label={`${filled} de ${cycleLength} focos del ciclo`}>
        {Array.from({ length: cycleLength }, (_, i) => (
          <span
            key={i}
            className={cn('size-2 rounded-full transition-all duration-300', {
              'bg-[var(--phase-color)]': i < filled,
              'bg-[var(--c-border)]': i >= filled && i !== activeIndex,
              'bg-[var(--phase-color)]/40 ring-2 ring-[var(--phase-color)]/30 scale-125': i === activeIndex,
            })}
          />
        ))}
      </div>

      {completedFocus > 0 && (
        <span className="text-xs text-faint">
          {completedFocus} completado{completedFocus === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
