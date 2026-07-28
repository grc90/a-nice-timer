/** Cómo se comporta un temporizador de principio a fin. */
export type TimerMode =
  /** Cuenta regresiva única. Termina y se detiene. */
  | 'simple'
  /** Ciclos foco → descanso → foco, con descanso largo cada N focos. */
  | 'pomodoro'
  /** Foco prolongado sin fases ni interrupciones. */
  | 'freeFocus';

/** Fase actual dentro de un ciclo Pomodoro. Los modos no-Pomodoro viven siempre en 'focus'. */
export type Phase = 'focus' | 'shortBreak' | 'longBreak';

export type TimerStatus =
  | 'idle'
  /** Corriendo: `endsAt` es la fuente de verdad. */
  | 'running'
  /** Pausado: `remainingMs` es la fuente de verdad, `endsAt` es null. */
  | 'paused'
  /** Llegó a cero y espera acción del usuario. */
  | 'finished';

export interface PomodoroConfig {
  focusMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  /** Cantidad de focos completados antes de disparar un descanso largo. */
  cyclesBeforeLongBreak: number;
  /** Encadenar el descanso automáticamente al terminar el foco. */
  autoStartBreaks: boolean;
  /** Encadenar el foco automáticamente al terminar el descanso. */
  autoStartFocus: boolean;
}

/**
 * Una configuración de timer guardada y reutilizable — lo que el usuario
 * entiende por "sesión". Es plantilla, no estado en curso: iniciarla copia sus
 * valores al runtime y nunca la muta.
 */
export interface SessionPreset {
  id: string;
  name: string;
  mode: TimerMode;
  /** Duración usada por los modos 'simple' y 'freeFocus'. Ignorada en Pomodoro. */
  durationMs: number;
  pomodoro: PomodoroConfig;
  skinId: SkinId;
  alarmId: AlarmId;
  /** Acento propio del preset (oklch/hex). Si es null hereda el de la paleta activa. */
  accentColor: string | null;
  createdAt: number;
  updatedAt: number;
}

export type SkinId = 'ring' | 'digital' | 'analog' | 'hourglass' | 'moon' | 'sundial';

export type AlarmId = 'chime' | 'bell' | 'marimba' | 'pulse' | 'none';

/**
 * Estado del temporizador en curso.
 *
 * Invariante central: cuando `status === 'running'`, el tiempo restante se
 * deriva de `endsAt - Date.now()` y NUNCA de un contador decreciente. Por eso
 * el timer no acumula drift, sobrevive a que el navegador congele la pestaña en
 * segundo plano, y se puede reconstruir exacto tras recargar la página.
 */
export interface TimerRuntime {
  /** Preset del que salió esta sesión. null = timer ad-hoc. */
  presetId: string | null;
  /** Copia del nombre al momento de iniciar, para que renombrar el preset no altere la sesión viva. */
  label: string;
  mode: TimerMode;
  status: TimerStatus;
  phase: Phase;
  pomodoro: PomodoroConfig;
  /** Epoch ms en que la fase actual llega a cero. Sólo válido si status === 'running'. */
  endsAt: number | null;
  /** Restante congelado. Fuente de verdad cuando está pausado, idle o finished. */
  remainingMs: number;
  /** Duración total de la fase actual, para calcular el progreso. */
  totalMs: number;
  /** Focos completados en esta sesión (alimenta el descanso largo y el contador). */
  completedFocus: number;
  /** Epoch ms en que arrancó la sesión, para registrar estadísticas en el paso 7. */
  startedAt: number | null;
}

/** Snapshot que se persiste para poder retomar una sesión tras recargar o cerrar la pestaña. */
export interface PersistedRuntime extends TimerRuntime {
  /** Momento del último guardado, para detectar cuánto estuvo ausente el usuario. */
  savedAt: number;
}
