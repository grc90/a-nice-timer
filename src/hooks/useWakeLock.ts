import { useEffect, useRef } from 'react';

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  released: boolean;
}

/**
 * Mantiene la pantalla encendida mientras corre una sesión.
 *
 * Sin esto, en mobile la pantalla se apaga a los 30 segundos y el usuario pierde
 * de vista el timer. El lock se libera solo al ocultar la pestaña, así que hay
 * que volver a pedirlo cuando el usuario regresa.
 *
 * La API no existe en Firefox ni en Safari viejo: el fallo es silencioso porque
 * es una mejora, no un requisito.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } })
      .wakeLock;
    if (!wakeLock) return;

    let cancelled = false;

    const acquire = async () => {
      if (!active || cancelled || document.visibilityState !== 'visible') return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        sentinelRef.current = await wakeLock.request('screen');
      } catch {
        // Suele fallar si la pestaña perdió el foco entre el chequeo y el pedido.
      }
    };

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    if (active) void acquire();
    else release();

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, [active]);
}
