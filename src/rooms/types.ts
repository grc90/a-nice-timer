import type { Phase, SkinId, TimerMode, TimerStatus } from '@/types';

/**
 * Estado compartido de una sala.
 *
 * Es exactamente lo que ve un invitado: nada de identidad del host más allá del
 * nombre que eligió mostrar, y nada de sus presets, ajustes ni estadísticas.
 *
 * `endsAt` es la pieza clave. Al viajar como timestamp absoluto, el invitado
 * calcula su propia cuenta regresiva localmente y el host no necesita emitir un
 * mensaje por segundo: alcanza con avisar en cada transición de fase. Una sesión
 * Pomodoro de dos horas se sincroniza con unos diez mensajes en total.
 */
export interface RoomSnapshot {
  id: string;
  hostName: string;
  label: string;
  mode: TimerMode;
  phase: Phase;
  status: TimerStatus;
  /** Epoch ms. null si está pausado o detenido. */
  endsAt: number | null;
  remainingMs: number;
  totalMs: number;
  completedFocus: number;
  skinId: SkinId;
  updatedAt: number;
}

/** Fila tal como la devuelve `get_shared_room`. */
export interface RoomRow {
  id: string;
  host_name: string;
  label: string;
  mode: TimerMode;
  phase: Phase;
  status: TimerStatus;
  ends_at: string | null;
  remaining_ms: number;
  total_ms: number;
  completed_focus: number;
  skin_id: SkinId;
  updated_at: string;
}

export function rowToSnapshot(row: RoomRow): RoomSnapshot {
  return {
    id: row.id,
    hostName: row.host_name,
    label: row.label,
    mode: row.mode,
    phase: row.phase,
    status: row.status,
    endsAt: row.ends_at ? Date.parse(row.ends_at) : null,
    remainingMs: Number(row.remaining_ms),
    totalMs: Number(row.total_ms),
    completedFocus: row.completed_focus,
    skinId: row.skin_id,
    updatedAt: Date.parse(row.updated_at),
  };
}

export function channelName(roomId: string): string {
  return `room:${roomId}`;
}
