import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DayTotal, DistributionSlice, FocusRecord, Goals, StreakInfo, TimerMode } from '@/types';
import { createId } from '@/utils/id';
import { HOUR, dayKey, dayKeyOffset, recentDayKeys, startOfWeekKey } from '@/utils/time';

/**
 * Tope de registros crudos que se conservan.
 *
 * Un usuario intenso deja ~12 bloques por día; 2000 son unos seis meses de
 * detalle. Pasado eso se podan los más viejos, pero el rollup diario —que ocupa
 * unos 40 bytes por día y nunca se poda— conserva la historia completa. Así el
 * gráfico y la racha siguen siendo exactos para siempre y sólo se pierde el
 * desglose por preset de hace medio año, que es lo que menos se mira.
 */
const MAX_RECORDS = 2000;

export const DEFAULT_GOALS: Goals = {
  dailyFocusMs: 2 * HOUR,
  weeklyFocusMs: 10 * HOUR,
};

export interface RecordFocusInput {
  focusedMs: number;
  mode: TimerMode;
  presetId: string | null;
  presetName: string;
  completedPomodoro: boolean;
  partial: boolean;
}

interface StatsState {
  records: FocusRecord[];
  /** Agregado por día. Fuente de verdad para gráficos y rachas. */
  daily: Record<string, DayTotal>;
  goals: Goals;

  recordFocus: (input: RecordFocusInput) => void;
  setGoals: (patch: Partial<Goals>) => void;
  clearHistory: () => void;
}

export const useStatsStore = create<StatsState>()(
  persist(
    (set) => ({
      records: [],
      daily: {},
      goals: DEFAULT_GOALS,

      recordFocus: (input) =>
        set((state) => {
          if (input.focusedMs <= 0) return state;

          const day = dayKey();
          const record: FocusRecord = {
            id: createId(),
            day,
            endedAt: Date.now(),
            focusedMs: Math.round(input.focusedMs),
            mode: input.mode,
            presetId: input.presetId,
            presetName: input.presetName,
            completedPomodoro: input.completedPomodoro,
            partial: input.partial,
          };

          const previous = state.daily[day] ?? { focusedMs: 0, pomodoros: 0, blocks: 0 };

          return {
            records: [...state.records, record].slice(-MAX_RECORDS),
            daily: {
              ...state.daily,
              [day]: {
                focusedMs: previous.focusedMs + record.focusedMs,
                pomodoros: previous.pomodoros + (record.completedPomodoro ? 1 : 0),
                blocks: previous.blocks + 1,
              },
            },
          };
        }),

      setGoals: (patch) => set((state) => ({ goals: { ...state.goals, ...patch } })),

      clearHistory: () => set({ records: [], daily: {} }),
    }),
    {
      name: 'ant:stats',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

// ── Selectores ──────────────────────────────────────────────────────────────
// Funciones puras sobre el estado, no hooks: se pueden testear sin React y no
// recalculan en cada render por accidente.

const EMPTY_DAY: DayTotal = { focusedMs: 0, pomodoros: 0, blocks: 0 };

export function dayTotal(daily: Record<string, DayTotal>, key: string): DayTotal {
  return daily[key] ?? EMPTY_DAY;
}

/** Serie de los últimos `days` días, de la más vieja a hoy. Rellena los vacíos con cero. */
export function focusSeries(daily: Record<string, DayTotal>, days: number): { day: string; total: DayTotal }[] {
  return recentDayKeys(days).map((day) => ({ day, total: dayTotal(daily, day) }));
}

export function rangeTotal(daily: Record<string, DayTotal>, days: number): DayTotal {
  return focusSeries(daily, days).reduce(
    (acc, { total }) => ({
      focusedMs: acc.focusedMs + total.focusedMs,
      pomodoros: acc.pomodoros + total.pomodoros,
      blocks: acc.blocks + total.blocks,
    }),
    { ...EMPTY_DAY },
  );
}

/** Total desde el lunes de esta semana hasta hoy. */
export function weekToDateTotal(daily: Record<string, DayTotal>): DayTotal {
  const monday = startOfWeekKey();
  let acc = { ...EMPTY_DAY };

  for (let i = 0; i < 7; i++) {
    const key = dayKeyOffset(-i);
    if (key < monday) break;
    const total = dayTotal(daily, key);
    acc = {
      focusedMs: acc.focusedMs + total.focusedMs,
      pomodoros: acc.pomodoros + total.pomodoros,
      blocks: acc.blocks + total.blocks,
    };
  }

  return acc;
}

/**
 * Racha de días consecutivos con foco.
 *
 * El detalle que importa: si hoy todavía no hay nada registrado, la racha **no**
 * se corta — se cuenta desde ayer. Romperla a las 00:01 castigaría al usuario por
 * no haber empezado aún, que es el error clásico de este cálculo. `activeToday`
 * distingue "viva pero sin extender" de "ya extendida hoy".
 */
export function computeStreak(daily: Record<string, DayTotal>): StreakInfo {
  const today = dayKey();
  const activeToday = dayTotal(daily, today).focusedMs > 0;

  let current = 0;
  let offset = activeToday ? 0 : -1;
  while (dayTotal(daily, dayKeyOffset(offset)).focusedMs > 0) {
    current++;
    offset--;
  }

  // Mejor racha histórica: recorre los días con actividad en orden y mide las
  // corridas consecutivas.
  const activeDays = Object.entries(daily)
    .filter(([, total]) => total.focusedMs > 0)
    .map(([key]) => key)
    .sort();

  let best = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of activeDays) {
    run = previous !== null && nextDayKey(previous) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return { current, best: Math.max(best, current), activeToday };
}

function nextDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const d = new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + 1);
  return dayKey(d);
}

const MODE_LABEL: Record<TimerMode, string> = {
  pomodoro: 'Pomodoro',
  freeFocus: 'Foco libre',
  simple: 'Timer simple',
};

/** Reparto de foco por tipo de sesión, en los últimos `days` días. */
export function distributionByMode(records: FocusRecord[], days: number): DistributionSlice[] {
  const since = dayKeyOffset(-(days - 1));
  const totals = new Map<TimerMode, number>();

  for (const record of records) {
    if (record.day < since) continue;
    totals.set(record.mode, (totals.get(record.mode) ?? 0) + record.focusedMs);
  }

  return [...totals.entries()]
    .map(([mode, focusedMs]) => ({ key: mode, label: MODE_LABEL[mode], focusedMs }))
    .sort((a, b) => b.focusedMs - a.focusedMs);
}

/**
 * Reparto de foco por sesión guardada, en los últimos `days` días.
 *
 * Agrupa por `presetId` y no por nombre, así renombrar una sesión no parte su
 * historia en dos. Los timers sin preset caen en una entrada propia.
 */
export function distributionByPreset(records: FocusRecord[], days: number, limit = 5): DistributionSlice[] {
  const since = dayKeyOffset(-(days - 1));
  const totals = new Map<string, DistributionSlice>();

  for (const record of records) {
    if (record.day < since) continue;
    const key = record.presetId ?? '__adhoc__';
    const existing = totals.get(key);
    if (existing) existing.focusedMs += record.focusedMs;
    else
      totals.set(key, {
        key,
        label: record.presetId ? record.presetName : 'Sin sesión guardada',
        focusedMs: record.focusedMs,
      });
  }

  const sorted = [...totals.values()].sort((a, b) => b.focusedMs - a.focusedMs);
  if (sorted.length <= limit) return sorted;

  // La cola se pliega en "Otras" en vez de generar más categorías: pasadas ~7
  // clases, cada una nueva resta legibilidad en lugar de sumar información.
  const head = sorted.slice(0, limit);
  const tail = sorted.slice(limit);
  return [
    ...head,
    { key: '__other__', label: `Otras (${tail.length})`, focusedMs: tail.reduce((s, x) => s + x.focusedMs, 0) },
  ];
}
