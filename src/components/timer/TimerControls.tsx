import { useTimerStore } from '@/store/timerStore';
import { unlockAudio } from '@/audio/alarm';
import { Button, IconButton } from '@/components/ui/Button';
import { PauseIcon, PlayIcon, ResetIcon, SkipIcon, StopIcon } from '@/components/ui/Icons';
import { MINUTE } from '@/utils/time';
import { cn } from '@/utils/cn';

interface TimerControlsProps {
  /** Variante reducida para el modo concentración. */
  minimal?: boolean;
  className?: string;
}

export function TimerControls({ minimal = false, className }: TimerControlsProps) {
  const status = useTimerStore((s) => s.status);
  const mode = useTimerStore((s) => s.mode);
  const remainingMs = useTimerStore((s) => s.remainingMs);
  const totalMs = useTimerStore((s) => s.totalMs);

  const toggle = useTimerStore((s) => s.toggle);
  const reset = useTimerStore((s) => s.reset);
  const stop = useTimerStore((s) => s.stop);
  const skipPhase = useTimerStore((s) => s.skipPhase);
  const addTime = useTimerStore((s) => s.addTime);

  const running = status === 'running';
  const idle = status === 'idle';
  const finished = status === 'finished';

  const handleToggle = () => {
    // Es el único punto donde tenemos garantizado un gesto del usuario. Sin
    // desbloquear acá, la alarma de dentro de 25 minutos suena en el vacío.
    void unlockAudio();
    toggle();
  };

  const primaryLabel = running ? 'Pausar' : finished ? 'Empezar de nuevo' : idle ? 'Iniciar' : 'Reanudar';

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="flex items-center gap-3">
        {!minimal && (
          <IconButton
            label="Restar un minuto"
            variant="secondary"
            onClick={() => addTime(-MINUTE)}
            disabled={remainingMs <= MINUTE}
          >
            <span className="text-xs font-medium">−1m</span>
          </IconButton>
        )}

        <Button
          variant="primary"
          size="lg"
          onClick={handleToggle}
          className="min-w-36 shadow-[0_8px_24px_-12px_var(--phase-color)]"
          icon={running ? <PauseIcon /> : <PlayIcon />}
        >
          {primaryLabel}
        </Button>

        {!minimal && (
          <IconButton label="Sumar un minuto" variant="secondary" onClick={() => addTime(MINUTE)}>
            <span className="text-xs font-medium">+1m</span>
          </IconButton>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton label="Reiniciar la fase" onClick={reset} disabled={idle && remainingMs === totalMs} size="sm">
          <ResetIcon />
        </IconButton>

        {mode === 'pomodoro' && (
          <IconButton label="Saltar a la fase siguiente" onClick={skipPhase} disabled={idle} size="sm">
            <SkipIcon />
          </IconButton>
        )}

        <IconButton label="Detener la sesión" onClick={stop} disabled={idle} size="sm">
          <StopIcon />
        </IconButton>
      </div>
    </div>
  );
}
