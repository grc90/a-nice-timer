import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { displayName, useAuthStore } from '@/store/authStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTimerStore } from '@/store/timerStore';
import { useRoomStore } from '@/store/roomStore';
import { closeRoom, openChannel, publishState, upsertRoom } from '@/rooms/roomClient';
import type { RoomSnapshot } from '@/rooms/types';
import { createId } from '@/utils/id';

/** Lee el estado publicable desde los stores. */
function buildSnapshot(id: string, hostName: string): RoomSnapshot {
  const t = useTimerStore.getState();
  return {
    id,
    hostName,
    label: t.label,
    mode: t.mode,
    phase: t.phase,
    status: t.status,
    endsAt: t.endsAt,
    remainingMs: t.remainingMs,
    totalMs: t.totalMs,
    completedFocus: t.completedFocus,
    skinId: useSettingsStore.getState().skinId,
    updatedAt: Date.now(),
  };
}

/**
 * Lado host de una sala compartida.
 *
 * Publica **sólo cuando cambia algo estructural** —fase, estado, `endsAt`,
 * duración, skin— y nunca por el paso del tiempo. El invitado recibe `endsAt`
 * absoluto y corre su propia cuenta regresiva, así que emitir cada segundo
 * sería mandar mil mensajes para decir mil veces lo mismo. Una sesión Pomodoro
 * completa se sincroniza con unos diez.
 */
export function useRoomHost() {
  const roomId = useRoomStore((s) => s.roomId);
  const status = useRoomStore((s) => s.status);
  const setRoomId = useRoomStore((s) => s.setRoomId);
  const setStatus = useRoomStore((s) => s.setStatus);
  const setViewers = useRoomStore((s) => s.setViewers);
  const reset = useRoomStore((s) => s.reset);

  const channelRef = useRef<RealtimeChannel | null>(null);
  // Firma del último estado emitido, para no repetir mensajes idénticos.
  const lastSignatureRef = useRef<string>('');

  const stopSharing = useCallback(async () => {
    const channel = channelRef.current;
    channelRef.current = null;
    lastSignatureRef.current = '';

    if (channel) await channel.unsubscribe();

    const id = useRoomStore.getState().roomId;
    if (id) {
      try {
        await closeRoom(id);
      } catch {
        // Si falla el cierre remoto igual soltamos la sala del lado local: el
        // link deja de compartirse y la fila queda huérfana pero inofensiva.
      }
    }

    reset();
  }, [reset]);

  const startSharing = useCallback(async () => {
    const { user } = useAuthStore.getState();
    if (!user) {
      setStatus('error', 'Necesitás una cuenta para compartir una sesión.');
      return;
    }

    setStatus('starting');

    // Reutiliza el id guardado: si el host recarga la página, el link que ya
    // repartió sigue sirviendo.
    const id = useRoomStore.getState().roomId ?? createId();
    const hostName = displayName(user);

    try {
      const snapshot = buildSnapshot(id, hostName);
      await upsertRoom({ id, userId: user.id, hostName, snapshot });

      const channel = await openChannel(id);

      channel.on('presence', { event: 'sync' }, () => {
        // El host también está en el canal, así que no se cuenta a sí mismo.
        const count = Math.max(0, Object.keys(channel.presenceState()).length - 1);
        setViewers(count);
      });

      // Un invitado que entra tarde pide el estado en vez de esperar la próxima
      // transición; sin esto tendría que aguantar hasta 25 minutos de reloj
      // congelado. El snapshot de la tabla ya lo cubre, pero esto lo hace
      // instantáneo.
      channel.on('broadcast', { event: 'request-state' }, () => {
        publishState(channel, buildSnapshot(id, hostName));
      });

      await new Promise<void>((resolve, reject) => {
        channel.subscribe((state) => {
          if (state === 'SUBSCRIBED') resolve();
          else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') reject(new Error('No se pudo abrir el canal'));
        });
      });

      await channel.track({ role: 'host' });

      channelRef.current = channel;
      setRoomId(id);
      setStatus('live');
      publishState(channel, snapshot);
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : 'No se pudo abrir la sala');
    }
  }, [setRoomId, setStatus, setViewers]);

  // Publica ante cada cambio estructural del timer o de la skin.
  useEffect(() => {
    if (status !== 'live' || !roomId) return;

    const hostName = displayName(useAuthStore.getState().user);

    const maybePublish = () => {
      const channel = channelRef.current;
      if (!channel) return;

      const snapshot = buildSnapshot(roomId, hostName);
      // La firma excluye `updatedAt` y `remainingMs` a propósito: el restante
      // cambia cinco veces por segundo y es derivable de `endsAt`, así que
      // incluirlo convertiría esto en un emisor por tick.
      const signature = [
        snapshot.phase,
        snapshot.status,
        snapshot.endsAt,
        snapshot.totalMs,
        snapshot.completedFocus,
        snapshot.label,
        snapshot.skinId,
      ].join('|');

      if (signature === lastSignatureRef.current) return;
      lastSignatureRef.current = signature;

      publishState(channel, snapshot);
      void upsertRoom({
        id: roomId,
        userId: useAuthStore.getState().user!.id,
        hostName,
        snapshot,
      });
    };

    const unsubscribes = [useTimerStore.subscribe(maybePublish), useSettingsStore.subscribe(maybePublish)];
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [status, roomId]);

  // Cierra el canal al desmontar, sin cerrar la sala: desmontar suele ser una
  // recarga, y ahí el link tiene que seguir vivo.
  useEffect(
    () => () => {
      void channelRef.current?.unsubscribe();
      channelRef.current = null;
    },
    [],
  );

  return { startSharing, stopSharing };
}
