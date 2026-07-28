import type { TimerMode } from './timer';

/**
 * Un bloque de foco terminado.
 *
 * La unidad de registro es el **bloque**, no la sesión: un Pomodoro de cuatro
 * ciclos deja cuatro registros. Así cada entrada es atómica —no hay filas "en
 * curso" que actualizar— y una sesión abandonada a la mitad conserva lo que sí
 * se trabajó en vez de perderse entera.
 */
export interface FocusRecord {
  id: string;
  /** Clave local `YYYY-MM-DD`. Se guarda calculada para no rehacerla al agrupar. */
  day: string;
  endedAt: number;
  focusedMs: number;
  mode: TimerMode;
  presetId: string | null;
  /** Nombre al momento del registro: renombrar un preset no debe reescribir el pasado. */
  presetName: string;
  /** Cuenta como pomodoro para el contador. Sólo los focos completos de modo Pomodoro. */
  completedPomodoro: boolean;
  /** El usuario cortó antes de que la fase llegara a cero. */
  partial: boolean;
}

/** Agregado por día. Es lo que sobrevive a la poda de registros crudos. */
export interface DayTotal {
  focusedMs: number;
  pomodoros: number;
  blocks: number;
}

export interface Goals {
  /** 0 significa "sin meta": el medidor desaparece en vez de mostrar 0 %. */
  dailyFocusMs: number;
  weeklyFocusMs: number;
}

export interface StreakInfo {
  /** Días consecutivos con foco registrado, contando hasta hoy o hasta ayer. */
  current: number;
  /** Racha más larga alcanzada. */
  best: number;
  /** Si hoy ya suma. Distingue "racha viva sin extender" de "racha extendida". */
  activeToday: boolean;
}

export interface DistributionSlice {
  key: string;
  label: string;
  focusedMs: number;
}
