import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { channelName, rowToSnapshot, type RoomRow, type RoomSnapshot } from './types';

/**
 * Transporte de las salas compartidas.
 *
 * Combina dos mecanismos porque ninguno alcanza solo:
 *
 * - **Broadcast** para las actualizaciones. Es instantáneo y no toca la base,
 *   pero sólo llega a quien ya estaba conectado: un invitado que entra en el
 *   minuto 12 de un bloque de foco no vería nada hasta la próxima transición.
 * - **Un snapshot en la tabla** para resolver justo eso. Al entrar, el invitado
 *   lee el estado actual por RPC y arranca sincronizado.
 *
 * Y encima un sondeo lento como red de seguridad: si el WebSocket se cae en
 * silencio —cosa que pasa en redes móviles— el invitado se recupera solo en
 * lugar de quedarse mirando un reloj congelado.
 */

/** Cada cuánto se revalida el snapshot por si el WebSocket murió sin avisar. */
export const POLL_INTERVAL_MS = 25_000;

export async function fetchRoom(roomId: string): Promise<RoomSnapshot | null> {
  const db = await getSupabase();
  const { data, error } = await db.rpc('get_shared_room', { room_id: roomId });
  if (error) throw error;

  const rows = (data ?? []) as RoomRow[];
  const row = rows[0];
  return row ? rowToSnapshot(row) : null;
}

export interface HostRoomInput {
  id: string;
  userId: string;
  hostName: string;
  snapshot: Omit<RoomSnapshot, 'id' | 'hostName' | 'updatedAt'>;
}

/** Crea o reabre la fila de la sala. Idempotente por id. */
export async function upsertRoom({ id, userId, hostName, snapshot }: HostRoomInput): Promise<void> {
  const db = await getSupabase();
  const { error } = await db.from('rooms').upsert(
    {
      id,
      user_id: userId,
      host_name: hostName,
      label: snapshot.label,
      mode: snapshot.mode,
      phase: snapshot.phase,
      status: snapshot.status,
      ends_at: snapshot.endsAt ? new Date(snapshot.endsAt).toISOString() : null,
      remaining_ms: snapshot.remainingMs,
      total_ms: snapshot.totalMs,
      completed_focus: snapshot.completedFocus,
      skin_id: snapshot.skinId,
      closed_at: null,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function closeRoom(roomId: string): Promise<void> {
  const db = await getSupabase();
  const { error } = await db.from('rooms').update({ closed_at: new Date().toISOString() }).eq('id', roomId);
  if (error) throw error;
}

/** Canal de la sala, ya suscrito. */
export async function openChannel(roomId: string): Promise<RealtimeChannel> {
  const db = await getSupabase();
  return db.channel(channelName(roomId), {
    config: {
      // `self: false` evita que el host reciba de vuelta lo que acaba de emitir.
      broadcast: { self: false },
      presence: { key: crypto.randomUUID() },
    },
  });
}

export function publishState(channel: RealtimeChannel, snapshot: RoomSnapshot): void {
  void channel.send({ type: 'broadcast', event: 'state', payload: snapshot });
}
