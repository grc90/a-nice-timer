import { useEffect, useRef } from 'react';
import { useTimerStore } from '@/store/timerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Button } from '@/components/ui/Button';
import { PHASE_LABEL } from '@/skins/TimeReadout';
import { notify } from '@/utils/notifications';
import { formatDurationLabel } from '@/utils/time';

function relativeSince(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

/**
 * Invitación a retomar una sesión que quedó a medias.
 *
 * Aparece cuando la app se reabre con una sesión en curso, o cuando una fase
 * venció con la pestaña congelada. Es la contracara de no encadenar fases
 * automáticamente mientras el usuario no estaba: en vez de mentirle sobre lo que
 * pasó, se le ofrece retomar.
 */
export function InterruptedBanner() {
  const interrupted = useTimerStore((s) => s.interrupted);
  const resumeInterrupted = useTimerStore((s) => s.resumeInterrupted);
  const dismissInterrupted = useTimerStore((s) => s.dismissInterrupted);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);

  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!interrupted || notifiedRef.current || !notificationsEnabled) return;
    notifiedRef.current = true;
    notify('¿Retomamos?', {
      body: `Dejaste "${interrupted.label}" a medias ${relativeSince(interrupted.since)}.`,
      tag: 'ant-resume',
    });
  }, [interrupted, notificationsEnabled]);

  if (!interrupted) return null;

  return (
    <div className="anim-fade-in flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">Tenías una sesión en curso</p>
        <p className="mt-0.5 text-xs text-muted">
          «{interrupted.label}» · {PHASE_LABEL[interrupted.phase]} de {formatDurationLabel(interrupted.totalMs)} ·{' '}
          {interrupted.wasRunning ? 'terminó' : 'en pausa'} {relativeSince(interrupted.since)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="ghost" onClick={dismissInterrupted}>
          Descartar
        </Button>
        <Button size="sm" variant="primary" onClick={resumeInterrupted}>
          Retomar
        </Button>
      </div>
    </div>
  );
}
