import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AlarmId, PaletteId, PomodoroConfig, SkinId, ThemeMode } from '@/types';
import { MINUTE } from '@/utils/time';

export const DEFAULT_POMODORO: PomodoroConfig = {
  focusMs: 25 * MINUTE,
  shortBreakMs: 5 * MINUTE,
  longBreakMs: 15 * MINUTE,
  cyclesBeforeLongBreak: 4,
  autoStartBreaks: true,
  autoStartFocus: false,
};

interface SettingsState {
  themeMode: ThemeMode;
  palette: PaletteId;
  /**
   * Skin en pantalla ahora mismo. Vive acá y no en el runtime del timer: por eso
   * cambiarla nunca puede tocar el estado de una sesión en curso.
   */
  skinId: SkinId;
  /** Fondo de auroras. */
  auroraEnabled: boolean;
  /**
   * Si la aurora se mueve.
   *
   * Vale la pena que sea un ajuste propio y no herencia de
   * `prefers-reduced-motion`: en Windows esa preferencia se activa al apagar los
   * efectos de animación del sistema, algo que mucha gente hace por rendimiento
   * sin querer un fondo congelado. El resto de la interfaz sigue obedeciendo al
   * sistema; sólo este elemento decorativo admite una decisión explícita.
   */
  auroraMotion: boolean;
  /** Multiplicador de opacidad de la aurora, 0..1. */
  auroraIntensity: number;
  alarmVolume: number;
  /** Repeticiones de la alarma al terminar una fase. */
  alarmRepeats: number;
  notificationsEnabled: boolean;
  /** Pedir Wake Lock mientras corre, para que no se apague la pantalla. */
  keepAwake: boolean;
  /** Entrar solo en modo concentración al iniciar una fase de foco. */
  autoFocusMode: boolean;
  /** Mostrar el tiempo restante en el título de la pestaña. */
  showTimeInTitle: boolean;
  /** Valores por defecto al crear un preset Pomodoro nuevo. */
  defaultPomodoro: PomodoroConfig;
  defaultAlarmId: AlarmId;

  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setPalette: (palette: PaletteId) => void;
  setSkin: (skinId: SkinId) => void;
  setAuroraEnabled: (enabled: boolean) => void;
  setAuroraMotion: (motion: boolean) => void;
  setAuroraIntensity: (intensity: number) => void;
  setAlarmVolume: (volume: number) => void;
  setAlarmRepeats: (repeats: number) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setKeepAwake: (enabled: boolean) => void;
  setAutoFocusMode: (enabled: boolean) => void;
  setShowTimeInTitle: (enabled: boolean) => void;
  setDefaultPomodoro: (patch: Partial<PomodoroConfig>) => void;
  setDefaultAlarm: (alarmId: AlarmId) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      themeMode: 'system',
      palette: 'minimal',
      skinId: 'ring',
      auroraEnabled: true,
      auroraMotion: true,
      auroraIntensity: 0.7,
      alarmVolume: 0.8,
      alarmRepeats: 2,
      notificationsEnabled: false,
      keepAwake: true,
      autoFocusMode: false,
      showTimeInTitle: true,
      defaultPomodoro: DEFAULT_POMODORO,
      defaultAlarmId: 'chime',

      setThemeMode: (themeMode) => set({ themeMode }),

      toggleTheme: () => {
        const { themeMode } = get();
        // Desde 'system' saltamos al opuesto de lo que el sistema muestra ahora,
        // así el toggle siempre produce un cambio visible.
        if (themeMode === 'system') {
          const systemIsDark =
            typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
          set({ themeMode: systemIsDark ? 'light' : 'dark' });
          return;
        }
        set({ themeMode: themeMode === 'dark' ? 'light' : 'dark' });
      },

      setPalette: (palette) => set({ palette }),
      setSkin: (skinId) => set({ skinId }),
      setAuroraEnabled: (auroraEnabled) => set({ auroraEnabled }),
      setAuroraMotion: (auroraMotion) => set({ auroraMotion }),
      setAuroraIntensity: (auroraIntensity) => set({ auroraIntensity: Math.min(1, Math.max(0.15, auroraIntensity)) }),
      setAlarmVolume: (alarmVolume) => set({ alarmVolume: Math.min(1, Math.max(0, alarmVolume)) }),
      setAlarmRepeats: (alarmRepeats) => set({ alarmRepeats: Math.min(5, Math.max(1, Math.round(alarmRepeats))) }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setKeepAwake: (keepAwake) => set({ keepAwake }),
      setAutoFocusMode: (autoFocusMode) => set({ autoFocusMode }),
      setShowTimeInTitle: (showTimeInTitle) => set({ showTimeInTitle }),

      setDefaultPomodoro: (patch) => set({ defaultPomodoro: { ...get().defaultPomodoro, ...patch } }),
      setDefaultAlarm: (defaultAlarmId) => set({ defaultAlarmId }),
    }),
    {
      name: 'ant:settings',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // El script inline de index.html lee esta misma clave antes del primer
      // paint para evitar el flash de tema claro. Si cambia el nombre o la forma
      // de `themeMode`/`palette`, hay que actualizarlo allá también.
    },
  ),
);
