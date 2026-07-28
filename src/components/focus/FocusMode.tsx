import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useTimerStore } from '@/store/timerStore';
import { TimerStage } from '@/components/timer/TimerStage';
import { TimerControls } from '@/components/timer/TimerControls';
import { PomodoroTracker } from '@/components/timer/PomodoroTracker';
import { AuroraBackground } from '@/components/layout/AuroraBackground';
import { IconButton } from '@/components/ui/Button';
import { CollapseIcon } from '@/components/ui/Icons';
import { Kbd } from '@/components/ui/Field';
import { cn } from '@/utils/cn';

/** Inactividad tras la cual se esconden los controles. */
const IDLE_MS = 2600;

/**
 * Modo concentración (Do Not Disturb).
 *
 * Oculta todo salvo el timer y pide pantalla completa al navegador. Los
 * controles se desvanecen tras unos segundos sin actividad y vuelven con
 * cualquier movimiento: quedan disponibles sin ser un elemento más al que
 * mirar mientras se trabaja.
 */
export function FocusMode() {
  const focusMode = useUiStore((s) => s.focusMode);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const label = useTimerStore((s) => s.label);

  const [controlsVisible, setControlsVisible] = useState(true);
  const idleTimerRef = useRef<number | undefined>(undefined);

  // Pantalla completa del navegador. Es un extra: si el usuario la rechaza o el
  // navegador la bloquea, el overlay igual cubre toda la ventana.
  useEffect(() => {
    if (!focusMode) return;

    void document.documentElement.requestFullscreen?.().catch(() => {});

    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    };
  }, [focusMode]);

  // Salir de pantalla completa con la tecla del navegador debe salir del modo.
  useEffect(() => {
    if (!focusMode) return;

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFocusMode(false);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [focusMode, setFocusMode]);

  // Auto-ocultado de controles.
  useEffect(() => {
    if (!focusMode) return;

    const wake = () => {
      setControlsVisible(true);
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => setControlsVisible(false), IDLE_MS);
    };

    wake();
    window.addEventListener('mousemove', wake);
    window.addEventListener('touchstart', wake);
    window.addEventListener('keydown', wake);

    return () => {
      window.clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('touchstart', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [focusMode]);

  if (!focusMode) return null;

  return (
    <div className="anim-fade-in fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-bg px-6">
      {/* `z-0` en vez del `-z-10` por defecto: acá tiene que quedar por encima
          del fondo opaco de este overlay, no detrás de él. */}
      <AuroraBackground className="!z-0" />

      {/* `relative z-10` en los tres bloques: la aurora quedó en un contexto de
          apilado con z-index 0, y el contenido sin posicionar se pinta por debajo
          de los elementos posicionados. Sin esto, los controles quedarían detrás. */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 py-4 transition-opacity duration-500',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <span className="truncate text-sm text-faint">{label}</span>
        <IconButton label="Salir del modo concentración" onClick={() => setFocusMode(false)}>
          <CollapseIcon />
        </IconButton>
      </div>

      {/* `dvh` y no `vh`: en mobile la pantalla completa del navegador puede no
          concederse, y ahí `vh` incluye la barra de direcciones y deja los
          controles fuera de la ventana. */}
      <TimerStage className="relative z-10 w-full max-w-[min(78vw,52dvh)] sm:max-w-[min(78vw,60dvh)]" />

      <div
        className={cn(
          'relative z-10 flex flex-col items-center gap-6 transition-opacity duration-500',
          controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <PomodoroTracker />
        <TimerControls minimal />
        <p className="hidden items-center gap-1.5 text-xs text-faint md:flex">
          <Kbd>Esc</Kbd> para salir · <Kbd>Espacio</Kbd> para pausar
        </p>
      </div>
    </div>
  );
}
