import { useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '@/rooms/types';
import { useReducedMotion } from './useMediaQuery';
import { clamp } from '@/utils/time';

export interface RemoteClock {
  progress: number;
  remainingMs: number;
}

function derive(snapshot: RoomSnapshot | null): RemoteClock {
  if (!snapshot) return { progress: 0, remainingMs: 0 };

  const remaining =
    snapshot.status === 'running' && snapshot.endsAt !== null
      ? Math.max(0, snapshot.endsAt - Date.now())
      : snapshot.remainingMs;

  return {
    progress: snapshot.totalMs > 0 ? clamp(1 - remaining / snapshot.totalMs, 0, 1) : 0,
    remainingMs: remaining,
  };
}

/**
 * Cuenta regresiva del lado del invitado.
 *
 * El invitado **no recibe el tiempo restante**: recibe `endsAt` y lo calcula.
 * Por eso el reloj corre fluido con un mensaje cada varios minutos, y sigue
 * corriendo correctamente incluso si el canal se cae — porque no depende del
 * canal para avanzar, sólo para enterarse de un cambio de fase.
 *
 * La contracara es que un reloj de sistema desfasado desfasa la cuenta. Para
 * body doubling eso es irrelevante: importa acompañar el ritmo, no coincidir al
 * milisegundo.
 */
export function useRemoteClock(snapshot: RoomSnapshot | null): RemoteClock {
  const reducedMotion = useReducedMotion();
  const [clock, setClock] = useState<RemoteClock>(() => derive(snapshot));
  const lastEmitRef = useRef(0);

  const running = snapshot?.status === 'running' && snapshot.endsAt !== null;

  useEffect(() => {
    if (!running) {
      setClock(derive(snapshot));
      return;
    }

    const minFrameMs = reducedMotion ? 250 : 0;
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - lastEmitRef.current < minFrameMs) return;
      lastEmitRef.current = now;

      const next = derive(snapshot);
      setClock((prev) => (Math.abs(prev.progress - next.progress) < 0.00005 ? prev : next));
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, snapshot, reducedMotion]);

  return running ? clock : derive(snapshot);
}
