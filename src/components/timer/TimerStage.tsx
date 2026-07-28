import { useSettingsStore } from '@/store/settingsStore';
import { useTimerStore } from '@/store/timerStore';
import { useSmoothClock } from '@/hooks/useSmoothClock';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { getSkin } from '@/skins/registry';
import { PHASE_LABEL } from '@/skins/TimeReadout';
import { formatSpokenDuration } from '@/utils/time';
import { cn } from '@/utils/cn';
import type { Phase } from '@/types';

const PHASE_COLOR: Record<Phase, string> = {
  focus: 'var(--c-phase-focus)',
  shortBreak: 'var(--c-phase-short)',
  longBreak: 'var(--c-phase-long)',
};

/**
 * Contenedor de la skin activa.
 *
 * Publica `--phase-color` y define el contenedor de consulta que usan las skins
 * para escalar la tipografía. Es la única capa que conoce a la vez el store y el
 * registro de skins: las skins reciben datos planos y nada más.
 */
export function TimerStage({ className }: { className?: string }) {
  const { progress, remainingMs } = useSmoothClock();
  const phase = useTimerStore((s) => s.phase);
  const status = useTimerStore((s) => s.status);
  const totalMs = useTimerStore((s) => s.totalMs);
  const skinId = useSettingsStore((s) => s.skinId);
  const reducedMotion = useReducedMotion();

  const Skin = getSkin(skinId).component;

  return (
    <div
      className={cn('relative w-full', className)}
      style={{ '--phase-color': PHASE_COLOR[phase], containerType: 'inline-size' } as React.CSSProperties}
      role="timer"
      // El label completo va acá y no en los dígitos: un lector de pantalla lo
      // lee bajo demanda en vez de anunciarlo cada segundo.
      aria-label={`${PHASE_LABEL[phase]}. ${
        status === 'finished' ? 'Completado' : `Quedan ${formatSpokenDuration(remainingMs)}`
      }`}
    >
      <Skin
        progress={progress}
        remainingMs={remainingMs}
        totalMs={totalMs}
        phase={phase}
        status={status}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
