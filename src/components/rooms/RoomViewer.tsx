import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isCloudConfigured } from '@/lib/supabase';
import { fetchRoom, openChannel, POLL_INTERVAL_MS } from '@/rooms/roomClient';
import type { RoomSnapshot } from '@/rooms/types';
import { useRemoteClock } from '@/hooks/useRemoteClock';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { useTheme } from '@/hooks/useTheme';
import { AuroraBackground } from '@/components/layout/AuroraBackground';
import { getSkin } from '@/skins/registry';
import { PHASE_LABEL } from '@/skins/TimeReadout';
import { ClockIcon } from '@/components/ui/Icons';
import { Button } from '@/components/ui/Button';
import type { Phase } from '@/types';

const PHASE_COLOR: Record<Phase, string> = {
  focus: 'var(--c-phase-focus)',
  shortBreak: 'var(--c-phase-short)',
  longBreak: 'var(--c-phase-long)',
};

type ViewerState = 'loading' | 'live' | 'notFound' | 'error';

/**
 * Vista de invitado de una sala compartida.
 *
 * Es sólo lectura por construcción, no por convención: este árbol no monta el
 * motor del timer ni ningún store de escritura, así que no existe la ruta de
 * código por la que un invitado podría alterar la sesión del host. Renderiza la
 * skin del host pasándole props calculadas, que es exactamente lo que el
 * contrato `SkinProps` —sin acceso al store— hizo posible desde el paso 3.
 */
export function RoomViewer({ roomId }: { roomId: string }) {
  useTheme();
  const reducedMotion = useReducedMotion();

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [state, setState] = useState<ViewerState>('loading');
  const [message, setMessage] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!isCloudConfigured) {
      setState('error');
      setMessage('Esta copia de la app no tiene la nube configurada.');
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const room = await fetchRoom(roomId);
        if (cancelled) return;

        if (!room) {
          setState('notFound');
          return;
        }

        setSnapshot(room);
        setState('live');
      } catch (error) {
        if (cancelled) return;
        setState('error');
        setMessage(error instanceof Error ? error.message : 'No se pudo abrir la sala');
      }
    };

    void load();

    // Sondeo lento de respaldo: si el WebSocket se cae en silencio —habitual en
    // redes móviles— el invitado se recupera solo en vez de quedarse mirando un
    // reloj que ya no corresponde.
    const poll = window.setInterval(() => void load(), POLL_INTERVAL_MS);

    void (async () => {
      try {
        const channel = await openChannel(roomId);
        if (cancelled) return;

        channel.on('broadcast', { event: 'state' }, ({ payload }) => {
          const incoming = payload as RoomSnapshot;
          // Descarta mensajes viejos que llegan fuera de orden.
          setSnapshot((prev) => (prev && incoming.updatedAt < prev.updatedAt ? prev : incoming));
          setState('live');
        });

        channel.subscribe(async (status) => {
          if (status !== 'SUBSCRIBED' || cancelled) return;
          await channel.track({ role: 'viewer' });
          // Pide el estado al host: más rápido que esperar la próxima transición.
          void channel.send({ type: 'broadcast', event: 'request-state', payload: {} });
        });

        channelRef.current = channel;
      } catch {
        // Sin canal queda el sondeo, que ya alcanza para seguir la sesión.
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId]);

  const clock = useRemoteClock(snapshot);

  if (state !== 'live' || !snapshot) {
    return (
      <Shell>
        <div className="text-center">
          {state === 'loading' && <p className="text-sm text-muted">Conectando con la sesión…</p>}

          {state === 'notFound' && (
            <>
              <p className="text-base font-medium text-ink">Esta sala ya no está activa</p>
              <p className="mt-1.5 text-sm text-muted">
                El link expiró o quien la compartió dejó de transmitir.
              </p>
            </>
          )}

          {state === 'error' && (
            <>
              <p className="text-base font-medium text-ink">No se pudo abrir la sala</p>
              {message && <p className="mt-1.5 text-sm text-muted">{message}</p>}
            </>
          )}

          {state !== 'loading' && (
            <Button variant="secondary" className="mt-5" onClick={() => (window.location.search = '')}>
              Usar mi propio timer
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  const Skin = getSkin(snapshot.skinId).component;

  return (
    <Shell>
      {/* Igual que en la pantalla principal, el ancho se mide también contra el
          alto de la ventana: acá el contenedor de consulta es esta columna, así
          que limitarla es lo que hace que la esfera —y con ella la tipografía de
          las skins que escalan con `cqw`— entre entera en un teléfono. */}
      <div
        className="flex w-full max-w-[min(24rem,50dvh)] flex-col items-center gap-6 sm:max-w-sm sm:gap-7"
        style={{ '--phase-color': PHASE_COLOR[snapshot.phase], containerType: 'inline-size' } as React.CSSProperties}
      >
        <header className="flex flex-col items-center gap-1.5 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[0.6875rem] text-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-[var(--phase-color)]" />
            Acompañando a {snapshot.hostName}
          </span>
          <h1 className="mt-1 text-sm font-medium text-ink">{snapshot.label}</h1>
          <p className="text-xs text-faint">
            {snapshot.mode === 'pomodoro' ? PHASE_LABEL[snapshot.phase] : 'Sesión de foco'}
            {snapshot.status === 'paused' && ' · en pausa'}
            {snapshot.completedFocus > 0 && ` · ${snapshot.completedFocus} completado${snapshot.completedFocus === 1 ? '' : 's'}`}
          </p>
        </header>

        <div className="w-full" role="timer" aria-label={`Sesión de ${snapshot.hostName}`}>
          <Skin
            progress={clock.progress}
            remainingMs={clock.remainingMs}
            totalMs={snapshot.totalMs}
            phase={snapshot.phase}
            status={snapshot.status}
            reducedMotion={reducedMotion}
          />
        </div>

        <p className="max-w-xs text-center text-xs text-faint">
          Estás viendo esta sesión en tiempo real. No hace falta cuenta y no podés modificarla.
        </p>

        <Button variant="ghost" size="sm" onClick={() => (window.location.search = '')}>
          Abrir mi propio timer
        </Button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AuroraBackground />
      <header className="flex items-center gap-2.5 px-4 py-3 sm:px-6 sm:py-4">
        <ClockIcon className="shrink-0 text-accent" style={{ fontSize: '1.15rem' }} />
        <span className="font-serif text-lg tracking-tight text-ink">A Nice Timer</span>
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">{children}</main>
    </div>
  );
}
