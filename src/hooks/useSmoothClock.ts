import { useEffect, useRef, useState } from 'react';
import { useTimerStore } from '@/store/timerStore';
import { useReducedMotion } from './useMediaQuery';
import { clamp } from '@/utils/time';

export interface SmoothClock {
  /** Fracción transcurrida de la fase actual, 0..1. */
  progress: number;
  remainingMs: number;
}

/**
 * Reloj de alta frecuencia para las skins animadas.
 *
 * El store tickea a 200 ms, suficiente para el texto `mm:ss` pero no para una
 * aguja de segundos o arena cayendo. En vez de subir la frecuencia del store
 * —lo que re-renderizaría la app entera 60 veces por segundo— este hook lee
 * `endsAt` con requestAnimationFrame y mantiene el estado local. Sólo se
 * re-renderiza el componente que lo llama.
 *
 * Cuando el timer no está corriendo no hay nada que animar, así que el rAF ni
 * siquiera arranca y los valores salen directo del store.
 */
export function useSmoothClock(): SmoothClock {
  const status = useTimerStore((s) => s.status);
  const storeRemaining = useTimerStore((s) => s.remainingMs);
  const totalMs = useTimerStore((s) => s.totalMs);
  const reducedMotion = useReducedMotion();

  const [smooth, setSmooth] = useState<SmoothClock>(() => ({
    progress: totalMs > 0 ? clamp(1 - storeRemaining / totalMs, 0, 1) : 0,
    remainingMs: storeRemaining,
  }));

  const lastEmitRef = useRef(0);

  useEffect(() => {
    if (status !== 'running') return;

    // Con movimiento reducido bajamos a ~4 fps: sigue actualizando el segundo,
    // pero sin animación continua.
    const minFrameMs = reducedMotion ? 250 : 0;
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastEmitRef.current < minFrameMs) return;
      lastEmitRef.current = now;

      const state = useTimerStore.getState();
      const remaining = state.endsAt !== null ? Math.max(0, state.endsAt - Date.now()) : state.remainingMs;
      const progress = state.totalMs > 0 ? clamp(1 - remaining / state.totalMs, 0, 1) : 0;

      setSmooth((prev) =>
        // Umbral por debajo de medio píxel en cualquier skin: evita re-renders
        // que no cambiarían nada en pantalla.
        Math.abs(prev.progress - progress) < 0.00005 ? prev : { progress, remainingMs: remaining },
      );
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [status, reducedMotion]);

  if (status === 'running') return smooth;

  return {
    progress: totalMs > 0 ? clamp(1 - storeRemaining / totalMs, 0, 1) : 0,
    remainingMs: storeRemaining,
  };
}
