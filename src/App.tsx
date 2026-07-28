import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useTimerEngine, useDocumentTitle } from '@/hooks/useTimerEngine';
import { useKeyboardShortcuts, type ShortcutHandlers } from '@/hooks/useKeyboardShortcuts';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useAmbientSync } from '@/hooks/useAmbientSync';
import { useAuthListener, useCloudSync } from '@/hooks/useCloudSync';
import { useSettingsStore } from '@/store/settingsStore';
import { useTimerStore } from '@/store/timerStore';
import { useUiStore } from '@/store/uiStore';
import { nextSkinId } from '@/skins/registry';
import { unlockAudio } from '@/audio/alarm';
import { TopBar } from '@/components/layout/TopBar';
import { AuroraBackground } from '@/components/layout/AuroraBackground';
import { TimerStage } from '@/components/timer/TimerStage';
import { SkinSwitcher } from '@/components/timer/SkinSwitcher';
import { TimerControls } from '@/components/timer/TimerControls';
import { PomodoroTracker } from '@/components/timer/PomodoroTracker';
import { InterruptedBanner } from '@/components/timer/InterruptedBanner';
import { PresetList } from '@/components/presets/PresetList';
import { FocusMode } from '@/components/focus/FocusMode';
import { AudioPanel } from '@/components/audio/AudioPanel';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { ShortcutsHelp } from '@/components/settings/ShortcutsHelp';
import { AuthPanel } from '@/components/auth/AuthPanel';
import { ShareDialog } from '@/components/rooms/ShareDialog';
import { StatsPanel } from '@/components/stats/StatsPanel';
import { TodayCard } from '@/components/stats/TodayCard';
import { Button, TOUCH_BUTTON } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Field';
import { cn } from '@/utils/cn';
import { MINUTE, formatDurationLabel } from '@/utils/time';

const QUICK_DURATIONS = [5, 15, 30];
const CUSTOM_MAX_MINUTES = 999;

/**
 * Cuarta casilla del inicio rápido: en vez de una duración fija, un campo para
 * escribir los minutos. Es un `form` para que Enter arranque sin tener que
 * atar el teclado a mano, y el atajo de Espacio queda neutralizado mientras se
 * escribe porque el foco está en el input.
 */
function QuickCustomInput() {
  const startAdHoc = useTimerStore((s) => s.startAdHoc);
  const [value, setValue] = useState('');

  const minutes = Number(value);
  const valid = value !== '' && Number.isFinite(minutes) && minutes >= 1 && minutes <= CUSTOM_MAX_MINUTES;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        void unlockAudio();
        // Redondear: `startAdHoc` espera milisegundos enteros y el input admite
        // decimales al pegar un valor.
        const total = Math.round(minutes * MINUTE);
        startAdHoc(total, 'simple', formatDurationLabel(total));
        setValue('');
      }}
    >
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={CUSTOM_MAX_MINUTES}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="min"
        aria-label="Minutos personalizados (Enter para empezar)"
        title="Escribí los minutos y presioná Enter"
        className={cn(
          // Mismo alto que los botones de al lado en cada breakpoint: cómodo
          // para el pulgar en mobile, compacto donde apunta un mouse.
          'tabular h-10 rounded-xl sm:h-8 sm:rounded-lg',
          'w-full border border-line bg-surface-2 px-2 text-center text-sm text-ink sm:text-[0.8125rem]',
          'placeholder:text-faint transition-colors',
          'hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25',
          '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        )}
      />
    </form>
  );
}

export default function App() {
  const resolvedTheme = useTheme();
  useTimerEngine();
  useDocumentTitle();
  useAmbientSync();
  useAuthListener();
  useCloudSync();

  const status = useTimerStore((s) => s.status);
  const phase = useTimerStore((s) => s.phase);
  const mode = useTimerStore((s) => s.mode);
  const label = useTimerStore((s) => s.label);
  const totalMs = useTimerStore((s) => s.totalMs);
  const startAdHoc = useTimerStore((s) => s.startAdHoc);

  const keepAwake = useSettingsStore((s) => s.keepAwake);
  const autoFocusMode = useSettingsStore((s) => s.autoFocusMode);
  const skinId = useSettingsStore((s) => s.skinId);
  const setSkin = useSettingsStore((s) => s.setSkin);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);

  const overlay = useUiStore((s) => s.overlay);
  const openOverlay = useUiStore((s) => s.openOverlay);
  const closeOverlay = useUiStore((s) => s.closeOverlay);
  const focusMode = useUiStore((s) => s.focusMode);
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const toggleAudioPanel = useUiStore((s) => s.toggleAudioPanel);
  const escape = useUiStore((s) => s.escape);

  useWakeLock(keepAwake && status === 'running');

  // Modo concentración automático: entra al empezar un foco y sale en el
  // descanso, que es cuando el usuario quiere volver a ver la pantalla.
  const previousPhaseRef = useRef(phase);
  useEffect(() => {
    if (!autoFocusMode) return;
    const changed = previousPhaseRef.current !== phase;
    previousPhaseRef.current = phase;

    if (status !== 'running') return;
    if (phase === 'focus') setFocusMode(true);
    else if (changed) setFocusMode(false);
  }, [autoFocusMode, phase, status, setFocusMode]);

  const timerActionsEnabled = overlay === null;

  const handlers: ShortcutHandlers = {
    exit: escape,
    toggleHelp: () => (overlay === 'shortcuts' ? closeOverlay() : openOverlay('shortcuts')),
    ...(timerActionsEnabled
      ? {
          toggleTimer: () => {
            void unlockAudio();
            useTimerStore.getState().toggle();
          },
          reset: () => useTimerStore.getState().reset(),
          stop: () => useTimerStore.getState().stop(),
          skipPhase: () => useTimerStore.getState().skipPhase(),
          addMinute: () => useTimerStore.getState().addTime(MINUTE),
          subtractMinute: () => useTimerStore.getState().addTime(-MINUTE),
          toggleFocusMode,
          toggleAudio: toggleAudioPanel,
          toggleTheme,
          nextSkin: () => setSkin(nextSkinId(skinId)),
        }
      : {}),
  };

  useKeyboardShortcuts(handlers);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* El modo concentración es un overlay opaco que taparía esta capa, así que
          monta la suya. Se alterna en vez de duplicarse: dos auroras animando a
          la vez costarían el doble y sólo una sería visible. */}
      {!focusMode && <AuroraBackground />}

      {/* `inert` saca todo el árbol del orden de tabulación y del árbol de
          accesibilidad. Con sólo `aria-hidden`, Tab seguiría recorriendo botones
          invisibles detrás del modo concentración. */}
      <div inert={focusMode}>
        <TopBar resolvedTheme={resolvedTheme} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10 sm:px-6 sm:pb-16">
          <div className="mb-6 empty:mb-0">
            <InterruptedBanner />
          </div>

          <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_19rem] md:gap-12">
            <section className="flex flex-col items-center gap-5 sm:gap-7">
              <header className="flex flex-col items-center gap-1.5 text-center">
                <h2 className="text-sm font-medium text-ink">{label}</h2>
                <p className="text-xs text-faint">
                  {mode === 'pomodoro' ? 'Pomodoro' : mode === 'freeFocus' ? 'Foco libre' : 'Temporizador'}
                  {totalMs > 0 && ` · ${formatDurationLabel(totalMs)}`}
                </p>
              </header>

              {/* El cambio de skin va acá, pegado a la esfera: el control queda
                  junto a lo que modifica. */}
              <div className="flex w-full flex-col items-center gap-3">
                {/* La esfera se mide contra el alto de la ventana y no sólo
                    contra el ancho. Con `max-w-sm` a secas, en un teléfono la
                    esfera ocupa todo el ancho disponible y empuja el botón de
                    iniciar abajo del pliegue: la primera pantalla mostraba un
                    reloj lindo sin ninguna forma visible de arrancarlo. `dvh`
                    y no `vh` porque en mobile la barra de direcciones del
                    navegador se cuenta, y es justo la diferencia que decide si
                    el botón entra. */}
                <div className="relative w-full max-w-[min(20rem,44dvh)] sm:max-w-[min(24rem,52dvh)] md:max-w-sm">
                  <TimerStage className="w-full" />
                </div>
                <SkinSwitcher />
              </div>

              <PomodoroTracker />
              <TimerControls />

              {/* Vive acá, pegado a los controles, y no en la columna lateral:
                  en mobile esa columna cae debajo del pliegue, y "empezar algo
                  nuevo" es tan primario como pausar o reiniciar la sesión en
                  curso. Mismo orden en mobile y en desktop a propósito —nada de
                  reordenar por breakpoint con `order`/`hidden`, que es
                  justo la clase de regla condicional que ya dio un bug de
                  cascada en la barra superior. */}
              <section className="flex w-full flex-col gap-3">
                <h2 className="text-sm font-medium tracking-tight text-ink">Inicio rápido</h2>
                <div className="grid grid-cols-4 gap-2">
                  {QUICK_DURATIONS.map((minutes) => (
                    <Button
                      key={minutes}
                      variant="secondary"
                      className={TOUCH_BUTTON}
                      onClick={() => {
                        void unlockAudio();
                        startAdHoc(minutes * MINUTE, 'simple', `${minutes} minutos`);
                      }}
                    >
                      {minutes}m
                    </Button>
                  ))}
                  <QuickCustomInput />
                </div>
              </section>

              <p className="hidden items-center gap-1.5 text-xs text-faint md:flex">
                <Kbd>Espacio</Kbd> pausar · <Kbd>F</Kbd> concentración · <Kbd>?</Kbd> atajos
              </p>
            </section>

            <aside className="flex flex-col gap-8">
              <TodayCard />
              <PresetList />
            </aside>
          </div>
        </main>
      </div>

      <FocusMode />
      <AudioPanel />
      <SettingsPanel open={overlay === 'settings'} onClose={closeOverlay} />
      <ShortcutsHelp open={overlay === 'shortcuts'} onClose={closeOverlay} />
      <StatsPanel open={overlay === 'stats'} onClose={closeOverlay} />
      <AuthPanel open={overlay === 'auth'} onClose={closeOverlay} />
      <ShareDialog open={overlay === 'share'} onClose={closeOverlay} />
    </div>
  );
}
