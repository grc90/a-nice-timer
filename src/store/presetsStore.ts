import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SessionPreset } from '@/types';
import { createId } from '@/utils/id';
import { MINUTE } from '@/utils/time';
import { DEFAULT_POMODORO } from './settingsStore';

/** Campos que el usuario define; el resto los completa el store. */
export type PresetDraft = Omit<SessionPreset, 'id' | 'createdAt' | 'updatedAt'>;

function buildPreset(draft: PresetDraft): SessionPreset {
  const now = Date.now();
  return { ...draft, id: createId(), createdAt: now, updatedAt: now };
}

/** Presets de arranque, para que la primera visita no sea una pantalla vacía. */
function seedPresets(): SessionPreset[] {
  const base: Omit<PresetDraft, 'name' | 'mode' | 'durationMs' | 'skinId'> = {
    pomodoro: DEFAULT_POMODORO,
    alarmId: 'chime',
    accentColor: null,
  };

  return [
    buildPreset({ ...base, name: 'Pomodoro clásico', mode: 'pomodoro', durationMs: 25 * MINUTE, skinId: 'ring' }),
    buildPreset({ ...base, name: 'Foco profundo', mode: 'freeFocus', durationMs: 90 * MINUTE, skinId: 'hourglass' }),
    buildPreset({ ...base, name: 'Pausa corta', mode: 'simple', durationMs: 5 * MINUTE, skinId: 'digital', alarmId: 'pulse' }),
  ];
}

interface PresetsState {
  presets: SessionPreset[];
  /**
   * Lápidas de presets borrados, pendientes de propagar a la nube.
   *
   * Sin esto, borrar un preset en la compu y abrir el celular después lo
   * resucitaría: el celular sólo vería una fila remota que le falta y no tendría
   * cómo distinguir "esto se borró" de "esto todavía no lo recibí".
   */
  deletedIds: string[];

  createPreset: (draft: PresetDraft) => SessionPreset;
  updatePreset: (id: string, patch: Partial<PresetDraft>) => void;
  duplicatePreset: (id: string) => SessionPreset | null;
  deletePreset: (id: string) => void;
  getPreset: (id: string | null) => SessionPreset | null;
  reorderPresets: (fromIndex: number, toIndex: number) => void;

  /** Reemplaza la lista entera tras una sincronización. */
  replaceAll: (presets: SessionPreset[]) => void;
  /** Descarta las lápidas ya confirmadas por el servidor. */
  clearTombstones: (ids: string[]) => void;
}

export const usePresetsStore = create<PresetsState>()(
  persist(
    (set, get) => ({
      presets: seedPresets(),
      deletedIds: [],

      createPreset: (draft) => {
        const preset = buildPreset(draft);
        set((state) => ({ presets: [...state.presets, preset] }));
        return preset;
      },

      updatePreset: (id, patch) =>
        set((state) => ({
          presets: state.presets.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
        })),

      duplicatePreset: (id) => {
        const source = get().presets.find((p) => p.id === id);
        if (!source) return null;

        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = source;
        const copy = buildPreset({ ...draft, name: `${source.name} (copia)` });

        // Se inserta junto al original en vez de al final: si tenés 12 presets,
        // encontrar la copia al fondo de la lista es molesto.
        set((state) => {
          const index = state.presets.findIndex((p) => p.id === id);
          const next = [...state.presets];
          next.splice(index + 1, 0, copy);
          return { presets: next };
        });

        return copy;
      },

      deletePreset: (id) =>
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
          deletedIds: state.deletedIds.includes(id) ? state.deletedIds : [...state.deletedIds, id],
        })),

      replaceAll: (presets) => set({ presets }),

      clearTombstones: (ids) =>
        set((state) => ({ deletedIds: state.deletedIds.filter((id) => !ids.includes(id)) })),

      getPreset: (id) => (id ? (get().presets.find((p) => p.id === id) ?? null) : null),

      reorderPresets: (fromIndex, toIndex) =>
        set((state) => {
          const next = [...state.presets];
          const [moved] = next.splice(fromIndex, 1);
          if (!moved) return state;
          next.splice(toIndex, 0, moved);
          return { presets: next };
        }),
    }),
    {
      name: 'ant:presets',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
