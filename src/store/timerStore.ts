import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Phase, PomodoroConfig, SessionPreset, TimerMode, TimerRuntime } from '@/types';
import { DEFAULT_POMODORO } from './settingsStore';

/**
 * Overshoot máximo que seguimos considerando "en vivo".
 *
 * Si el tick detecta que la fase venció hace menos de esto, el usuario está
 * mirando y encadenamos la siguiente fase con normalidad. Si venció hace más,
 * la pestaña estuvo congelada o el usuario se fue: encadenar automáticamente
 * ahí sería mentir, porque nadie estuvo trabajando ese rato. En ese caso la
 * sesión se marca como interrumpida y se le ofrece retomarla.
 */
const LIVE_OVERSHOOT_MS = 30_000;

/**
 * Foco mínimo que vale la pena registrar al cortar a mano. Por debajo de un
 * minuto casi siempre es un arranque por error, y ensuciaría el histórico.
 */
const MIN_PARTIAL_FOCUS_MS = 60_000;

export type TimerEventKind =
  /** Una fase llegó a cero sola. Dispara alarma y notificación. */
  | 'phaseComplete'
  /** El usuario cortó la sesión. Se registra el foco hecho, pero en silencio. */
  | 'sessionStopped';

/** Emitido cuando una fase llega a cero o cuando el usuario corta la sesión. */
export interface TimerEvent {
  /** Serial monótono: permite a los efectos de React detectar eventos nuevos sin comparar objetos. */
  id: number;
  kind: TimerEventKind;
  completedPhase: Phase;
  /** Fase que sigue, o null si la sesión terminó. */
  nextPhase: Phase | null;
  mode: TimerMode;
  label: string;
  autoStarted: boolean;
  /** Focos completados en la sesión tras este evento. */
  focusCount: number;
  /** Tiempo de foco que aportó la fase completada. 0 si fue un descanso. Lo consume el paso 7. */
  focusedMs: number;
}

export interface InterruptedSession {
  label: string;
  mode: TimerMode;
  phase: Phase;
  /** Epoch ms en que la fase venció, o en que se pausó la sesión. */
  since: number;
  wasRunning: boolean;
  remainingMs: number;
  totalMs: number;
}

interface TimerState extends TimerRuntime {
  lastEvent: TimerEvent | null;
  /** Sesión encontrada a medias al volver a abrir la app. */
  interrupted: InterruptedSession | null;
  /** Última acción explícita del usuario, para medir ausencias. */
  lastInteractionAt: number;

  // Ciclo de vida
  loadPreset: (preset: SessionPreset, autoStart?: boolean) => void;
  startAdHoc: (durationMs: number, mode?: TimerMode, label?: string) => void;

  // Controles
  start: () => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  reset: () => void;
  stop: () => void;
  /** Salta a la fase siguiente sin esperar (Pomodoro), o termina (otros modos). */
  skipPhase: () => void;
  /** Suma tiempo a la fase actual, esté corriendo o pausada. */
  addTime: (ms: number) => void;

  // Motor
  tick: () => void;

  // Sesión interrumpida
  resumeInterrupted: () => void;
  dismissInterrupted: () => void;

  clearEvent: () => void;
}

let eventSerial = 0;

/** Duración configurada para una fase dada. */
function durationForPhase(phase: Phase, config: PomodoroConfig, fallbackMs: number): number {
  switch (phase) {
    case 'focus':
      return config.focusMs;
    case 'shortBreak':
      return config.shortBreakMs;
    case 'longBreak':
      return config.longBreakMs;
    default:
      return fallbackMs;
  }
}

/** Qué fase sigue a la que acaba de terminar. */
function nextPhaseAfter(phase: Phase, completedFocus: number, config: PomodoroConfig): Phase {
  if (phase !== 'focus') return 'focus';
  const cycles = Math.max(1, config.cyclesBeforeLongBreak);
  return completedFocus % cycles === 0 ? 'longBreak' : 'shortBreak';
}

/** Restante real: derivado de `endsAt` si corre, del valor congelado si no. */
function currentRemaining(state: TimerRuntime): number {
  if (state.status === 'running' && state.endsAt !== null) return Math.max(0, state.endsAt - Date.now());
  return state.remainingMs;
}

/**
 * Evento por foco trabajado que se pierde al cortar la sesión a mano.
 *
 * Sin esto, un bloque de foco libre de 90 minutos que el usuario detiene a los
 * 70 no registraría nada: el histórico sólo premiaría a quien aguanta la fase
 * entera, que no es lo que la app quiere medir. Devuelve null cuando no hay nada
 * que valga la pena guardar.
 */
function partialFocusEvent(state: TimerRuntime): TimerEvent | null {
  if (state.phase !== 'focus' || state.status === 'idle') return null;

  const elapsed = state.totalMs - currentRemaining(state);
  if (elapsed < MIN_PARTIAL_FOCUS_MS) return null;

  return {
    id: ++eventSerial,
    kind: 'sessionStopped',
    completedPhase: 'focus',
    nextPhase: null,
    mode: state.mode,
    label: state.label,
    autoStarted: false,
    focusCount: state.completedFocus,
    focusedMs: elapsed,
  };
}

const idleRuntime: TimerRuntime = {
  presetId: null,
  label: 'Temporizador',
  mode: 'simple',
  status: 'idle',
  phase: 'focus',
  pomodoro: DEFAULT_POMODORO,
  endsAt: null,
  remainingMs: 0,
  totalMs: 0,
  completedFocus: 0,
  startedAt: null,
};

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      ...idleRuntime,
      lastEvent: null,
      interrupted: null,
      lastInteractionAt: Date.now(),

      loadPreset: (preset, autoStart = false) => {
        const phase: Phase = 'focus';
        const totalMs =
          preset.mode === 'pomodoro'
            ? durationForPhase(phase, preset.pomodoro, preset.durationMs)
            : preset.durationMs;

        // Cargar otro preset abandona la sesión en curso: hay que cerrar su
        // registro antes de pisar el estado.
        const abandoned = partialFocusEvent(get());

        set({
          presetId: preset.id,
          label: preset.name,
          mode: preset.mode,
          status: 'idle',
          phase,
          pomodoro: preset.pomodoro,
          endsAt: null,
          remainingMs: totalMs,
          totalMs,
          completedFocus: 0,
          startedAt: null,
          lastEvent: abandoned,
          interrupted: null,
          lastInteractionAt: Date.now(),
        });

        if (autoStart) get().start();
      },

      startAdHoc: (durationMs, mode = 'simple', label = 'Temporizador') => {
        const abandoned = partialFocusEvent(get());

        set({
          presetId: null,
          label,
          mode,
          status: 'idle',
          phase: 'focus',
          pomodoro: DEFAULT_POMODORO,
          endsAt: null,
          remainingMs: durationMs,
          totalMs: durationMs,
          completedFocus: 0,
          startedAt: null,
          lastEvent: abandoned,
          interrupted: null,
          lastInteractionAt: Date.now(),
        });
        get().start();
      },

      start: () => {
        const { status, remainingMs, totalMs, startedAt } = get();
        if (status === 'running') return;

        // Desde 'finished' o con el reloj en cero, iniciar significa empezar la
        // fase de nuevo desde su duración completa.
        const duration = status === 'finished' || remainingMs <= 0 ? totalMs : remainingMs;
        if (duration <= 0) return;

        set({
          status: 'running',
          endsAt: Date.now() + duration,
          remainingMs: duration,
          startedAt: startedAt ?? Date.now(),
          interrupted: null,
          lastInteractionAt: Date.now(),
        });
      },

      pause: () => {
        const { status, endsAt } = get();
        if (status !== 'running' || endsAt === null) return;

        // Congelamos el restante y soltamos endsAt: a partir de acá remainingMs
        // pasa a ser la fuente de verdad.
        set({
          status: 'paused',
          remainingMs: Math.max(0, endsAt - Date.now()),
          endsAt: null,
          lastInteractionAt: Date.now(),
        });
      },

      resume: () => {
        if (get().status !== 'paused') return;
        get().start();
      },

      toggle: () => {
        const { status } = get();
        if (status === 'running') get().pause();
        else get().start();
      },

      reset: () => {
        const state = get();
        // Reiniciar descarta la fase, pero el tiempo ya trabajado existió.
        const abandoned = partialFocusEvent(state);

        set({
          status: 'idle',
          endsAt: null,
          remainingMs: state.totalMs,
          startedAt: null,
          lastEvent: abandoned,
          lastInteractionAt: Date.now(),
        });
      },

      stop: () => {
        const abandoned = partialFocusEvent(get());
        const { presetId, label, mode, pomodoro, totalMs } = get();
        // Vuelve al inicio de la sesión pero conserva qué preset estaba cargado,
        // para que el usuario no tenga que volver a elegirlo.
        const firstPhaseMs = mode === 'pomodoro' ? durationForPhase('focus', pomodoro, totalMs) : totalMs;

        set({
          ...idleRuntime,
          presetId,
          label,
          mode,
          pomodoro,
          remainingMs: firstPhaseMs,
          totalMs: firstPhaseMs,
          lastEvent: abandoned,
          interrupted: null,
          lastInteractionAt: Date.now(),
        });
      },

      skipPhase: () => {
        const state = get();
        if (state.status === 'idle') return;

        if (state.mode !== 'pomodoro') {
          set({ status: 'finished', endsAt: null, remainingMs: 0, lastInteractionAt: Date.now() });
          return;
        }

        // Saltear una fase de foco no cuenta como pomodoro completado: si contara,
        // el histórico de estadísticas del paso 7 dejaría de significar algo.
        const nextPhase = nextPhaseAfter(state.phase, state.completedFocus, state.pomodoro);
        const nextTotal = durationForPhase(nextPhase, state.pomodoro, state.totalMs);

        // Si venía corriendo, la fase nueva arranca sola. Saltear es adelantar
        // la sesión, no interrumpirla: frenar acá obligaría a un segundo click
        // que nadie pidió.
        const keepRunning = state.status === 'running';

        set({
          phase: nextPhase,
          status: keepRunning ? 'running' : 'idle',
          endsAt: keepRunning ? Date.now() + nextTotal : null,
          remainingMs: nextTotal,
          totalMs: nextTotal,
          lastInteractionAt: Date.now(),
        });
      },

      addTime: (ms) => {
        const { status, endsAt, remainingMs, totalMs } = get();
        if (status === 'idle' && remainingMs <= 0) return;

        if (status === 'running' && endsAt !== null) {
          set({ endsAt: endsAt + ms, remainingMs: Math.max(0, endsAt + ms - Date.now()), totalMs: totalMs + ms });
        } else {
          set({ remainingMs: Math.max(0, remainingMs + ms), totalMs: totalMs + ms, status: status === 'finished' ? 'paused' : status });
        }
        set({ lastInteractionAt: Date.now() });
      },

      tick: () => {
        const state = get();
        if (state.status !== 'running' || state.endsAt === null) return;

        const remaining = state.endsAt - Date.now();
        if (remaining > 0) {
          set({ remainingMs: remaining });
          return;
        }

        // ── La fase llegó a cero ──────────────────────────────────────────
        const overshoot = -remaining;
        const isLive = overshoot < LIVE_OVERSHOOT_MS;
        const wasFocus = state.phase === 'focus';
        const focusedMs = wasFocus ? state.totalMs : 0;
        const completedFocus = state.completedFocus + (wasFocus ? 1 : 0);

        if (state.mode !== 'pomodoro') {
          set({
            status: 'finished',
            endsAt: null,
            remainingMs: 0,
            completedFocus,
            lastEvent: {
              id: ++eventSerial,
              kind: 'phaseComplete',
              completedPhase: state.phase,
              nextPhase: null,
              mode: state.mode,
              label: state.label,
              autoStarted: false,
              focusCount: completedFocus,
              focusedMs,
            },
          });
          return;
        }

        const nextPhase = nextPhaseAfter(state.phase, completedFocus, state.pomodoro);
        const nextTotal = durationForPhase(nextPhase, state.pomodoro, state.totalMs);
        const wantsAutoStart = wasFocus ? state.pomodoro.autoStartBreaks : state.pomodoro.autoStartFocus;
        const autoStart = wantsAutoStart && isLive;

        set({
          phase: nextPhase,
          completedFocus,
          totalMs: nextTotal,
          remainingMs: nextTotal,
          status: autoStart ? 'running' : 'finished',
          endsAt: autoStart ? Date.now() + nextTotal : null,
          lastEvent: {
            id: ++eventSerial,
            kind: 'phaseComplete',
            completedPhase: state.phase,
            nextPhase,
            mode: state.mode,
            label: state.label,
            autoStarted: autoStart,
            focusCount: completedFocus,
            focusedMs,
          },
          // Si la fase venció mientras la pestaña estaba congelada, no arrancamos
          // nada solos: se lo ofrecemos al usuario cuando vuelva.
          interrupted: isLive
            ? null
            : {
                label: state.label,
                mode: state.mode,
                phase: nextPhase,
                since: state.endsAt,
                wasRunning: true,
                remainingMs: nextTotal,
                totalMs: nextTotal,
              },
        });
      },

      resumeInterrupted: () => {
        const { interrupted } = get();
        if (!interrupted) return;
        set({
          phase: interrupted.phase,
          remainingMs: interrupted.totalMs,
          totalMs: interrupted.totalMs,
          status: 'idle',
          endsAt: null,
          interrupted: null,
        });
        get().start();
      },

      dismissInterrupted: () => set({ interrupted: null }),

      clearEvent: () => set({ lastEvent: null }),
    }),
    {
      name: 'ant:timer',
      storage: createJSONStorage(() => localStorage),
      version: 1,

      // `lastEvent` queda fuera a propósito: es una notificación efímera y
      // rehidratarla dispararía la alarma de una sesión vieja al abrir la app.
      partialize: (state) => ({
        presetId: state.presetId,
        label: state.label,
        mode: state.mode,
        status: state.status,
        phase: state.phase,
        pomodoro: state.pomodoro,
        endsAt: state.endsAt,
        remainingMs: state.remainingMs,
        totalMs: state.totalMs,
        completedFocus: state.completedFocus,
        startedAt: state.startedAt,
        lastInteractionAt: state.lastInteractionAt,
      }),

      onRehydrateStorage: () => (state) => {
        if (!state) return;
        reconcileAfterReload(state);
      },
    },
  ),
);

/**
 * Reconstruye el estado real tras recargar la página.
 *
 * Este es el pago de haber guardado `endsAt` como timestamp absoluto: no hay
 * nada que estimar. O la fase todavía no venció y el timer sigue exactamente
 * donde estaba, o venció mientras la pestaña estaba cerrada y hay que ofrecer
 * retomar la sesión en lugar de fingir que siguió corriendo.
 */
function reconcileAfterReload(state: TimerState): void {
  const now = Date.now();

  if (state.status === 'running' && state.endsAt !== null) {
    const remaining = state.endsAt - now;

    if (remaining > 0) {
      state.remainingMs = remaining;
      return;
    }

    const expiredAt = state.endsAt;
    state.status = 'finished';
    state.remainingMs = 0;
    state.endsAt = null;
    state.interrupted = {
      label: state.label,
      mode: state.mode,
      phase: state.phase,
      since: expiredAt,
      wasRunning: true,
      remainingMs: 0,
      totalMs: state.totalMs,
    };
    return;
  }

  if (state.status === 'paused' && state.remainingMs > 0) {
    // Una pausa de más de 10 minutos casi siempre significa que el usuario se
    // fue, no que sigue en pausa. Se le ofrece retomar, sin perder el restante.
    const away = now - state.lastInteractionAt;
    if (away > 10 * 60_000) {
      state.interrupted = {
        label: state.label,
        mode: state.mode,
        phase: state.phase,
        since: state.lastInteractionAt,
        wasRunning: false,
        remainingMs: state.remainingMs,
        totalMs: state.totalMs,
      };
    }
  }
}

/** Progreso transcurrido de la fase actual, 0..1. */
export function selectProgress(state: TimerState): number {
  if (state.totalMs <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - state.remainingMs / state.totalMs));
}

export function selectIsActive(state: TimerState): boolean {
  return state.status === 'running' || state.status === 'paused';
}
