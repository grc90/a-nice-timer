import { useEffect, useRef } from 'react';
import { useTimerStore } from '@/store/timerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { usePresetsStore } from '@/store/presetsStore';
import { useStatsStore } from '@/store/statsStore';
import { playAlarm } from '@/audio/alarm';
import { notify } from '@/utils/notifications';
import { formatDuration } from '@/utils/time';
import type { AlarmId, Phase } from '@/types';

/** Cada cuánto se recalcula el restante. 200 ms mantiene el `mm:ss` al día sin costo real. */
const TICK_MS = 200;

const PHASE_COPY: Record<Phase, { title: string; body: string }> = {
  focus: { title: 'Hora de enfocarse', body: 'Empieza un bloque de foco.' },
  shortBreak: { title: 'Descanso corto', body: 'Levantate, estirá, mirá lejos un rato.' },
  longBreak: { title: 'Descanso largo', body: 'Te ganaste una pausa de verdad.' },
};

/**
 * Motor del temporizador. Se monta una sola vez, en la raíz de la app.
 *
 * Hace tres cosas: tickear, reaccionar a los eventos de fin de fase (alarma +
 * notificación), y resincronizar al volver de segundo plano.
 */
export function useTimerEngine(): void {
  const status = useTimerStore((s) => s.status);
  const lastEvent = useTimerStore((s) => s.lastEvent);
  const tick = useTimerStore((s) => s.tick);

  // El id del último evento ya atendido. Evita repetir la alarma si el efecto
  // se vuelve a ejecutar por cualquier otra razón.
  const handledEventId = useRef(0);

  useEffect(() => {
    if (status !== 'running') return;

    // Un tick inmediato al arrancar evita que el display muestre el valor viejo
    // durante los primeros 200 ms.
    tick();
    const interval = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(interval);
  }, [status, tick]);

  /**
   * Resincronización al volver a primer plano.
   *
   * Los navegadores throttlean `setInterval` hasta 1/min en pestañas ocultas, y
   * los mobile directamente lo congelan. Como el restante se deriva de `endsAt`
   * y no de un contador, un solo tick al volver deja todo exacto — no hay nada
   * que recuperar.
   */
  useEffect(() => {
    const resync = () => {
      if (document.visibilityState === 'visible') tick();
    };

    document.addEventListener('visibilitychange', resync);
    window.addEventListener('focus', resync);
    window.addEventListener('pageshow', resync);

    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('focus', resync);
      window.removeEventListener('pageshow', resync);
    };
  }, [tick]);

  // Fin de fase: registro, alarma y notificación del sistema.
  useEffect(() => {
    if (!lastEvent || lastEvent.id === handledEventId.current) return;
    handledEventId.current = lastEvent.id;

    // El registro va primero y sin condiciones: el histórico no debe depender de
    // que el usuario tenga la alarma o las notificaciones activadas.
    if (lastEvent.focusedMs > 0) {
      useStatsStore.getState().recordFocus({
        focusedMs: lastEvent.focusedMs,
        mode: lastEvent.mode,
        presetId: useTimerStore.getState().presetId,
        presetName: lastEvent.label,
        completedPomodoro: lastEvent.kind === 'phaseComplete' && lastEvent.mode === 'pomodoro',
        partial: lastEvent.kind === 'sessionStopped',
      });
    }

    // Cortar a mano no dispara alarma: el usuario ya estaba mirando la pantalla.
    if (lastEvent.kind !== 'phaseComplete') return;

    const { alarmVolume, alarmRepeats, notificationsEnabled } = useSettingsStore.getState();

    playAlarm(currentAlarmId(), alarmVolume, alarmRepeats);

    if (!notificationsEnabled) return;

    if (lastEvent.nextPhase === null) {
      notify(`${lastEvent.label} terminado`, {
        body:
          lastEvent.focusCount > 0
            ? `Completaste ${lastEvent.focusCount} bloque${lastEvent.focusCount === 1 ? '' : 's'} de foco.`
            : 'El temporizador llegó a cero.',
        tag: 'ant-timer',
        requireInteraction: true,
      });
      return;
    }

    const copy = PHASE_COPY[lastEvent.nextPhase];
    notify(copy.title, {
      body: lastEvent.autoStarted ? `${copy.body} Ya arrancó.` : `${copy.body} Tocá para empezar.`,
      tag: 'ant-timer',
      requireInteraction: !lastEvent.autoStarted,
    });
  }, [lastEvent]);
}

/** Alarma del preset activo, con la de ajustes como fallback para timers ad-hoc. */
function currentAlarmId(): AlarmId {
  const { presetId } = useTimerStore.getState();
  const preset = usePresetsStore.getState().getPreset(presetId);
  return preset?.alarmId ?? useSettingsStore.getState().defaultAlarmId;
}

/**
 * Muestra el tiempo restante en el título de la pestaña, para poder controlar
 * la sesión de reojo desde otra pestaña.
 */
export function useDocumentTitle(): void {
  const showTimeInTitle = useSettingsStore((s) => s.showTimeInTitle);
  const status = useTimerStore((s) => s.status);
  const remainingMs = useTimerStore((s) => s.remainingMs);
  const phase = useTimerStore((s) => s.phase);
  const mode = useTimerStore((s) => s.mode);

  useEffect(() => {
    const base = 'A Nice Timer';

    if (!showTimeInTitle || status === 'idle') {
      document.title = base;
      return;
    }

    const icon = status === 'paused' ? '⏸' : phase === 'focus' ? '🎯' : '☕';
    const label = mode === 'pomodoro' ? (phase === 'focus' ? 'Foco' : 'Descanso') : 'Timer';
    document.title = status === 'finished' ? `✓ ${label} · ${base}` : `${icon} ${formatDuration(remainingMs)} · ${label}`;
    // Sin función de limpieza: este efecto corre cada 200 ms y restaurar el
    // título en cada tick sólo agregaría un parpadeo. La rama de arriba ya lo
    // devuelve a su valor base cuando corresponde.
  }, [showTimeInTitle, status, remainingMs, phase, mode]);
}
