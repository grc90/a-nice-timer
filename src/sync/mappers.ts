import type { FocusRecord, SessionPreset, TimerMode } from '@/types';
import type { SavedLink } from '@/store/audioStore';

/**
 * Traducción entre las filas de Postgres y los tipos del cliente.
 *
 * Vive en un archivo propio para que la convención `snake_case` de la base no se
 * filtre a los stores ni a los componentes. Si mañana cambia una columna, el
 * cambio muere acá.
 */

// ── presets ─────────────────────────────────────────────────────────────────

export interface PresetRow {
  id: string;
  user_id: string;
  name: string;
  mode: TimerMode;
  duration_ms: number;
  pomodoro: SessionPreset['pomodoro'];
  skin_id: SessionPreset['skinId'];
  alarm_id: SessionPreset['alarmId'];
  accent_color: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export function presetToRow(preset: SessionPreset, userId: string, sortOrder: number): Omit<PresetRow, 'deleted_at'> {
  return {
    id: preset.id,
    user_id: userId,
    name: preset.name,
    mode: preset.mode,
    duration_ms: preset.durationMs,
    pomodoro: preset.pomodoro,
    skin_id: preset.skinId,
    alarm_id: preset.alarmId,
    accent_color: preset.accentColor,
    sort_order: sortOrder,
    created_at: new Date(preset.createdAt).toISOString(),
    updated_at: new Date(preset.updatedAt).toISOString(),
  };
}

export function rowToPreset(row: PresetRow): SessionPreset {
  return {
    id: row.id,
    name: row.name,
    mode: row.mode,
    durationMs: Number(row.duration_ms),
    pomodoro: row.pomodoro,
    skinId: row.skin_id,
    alarmId: row.alarm_id,
    accentColor: row.accent_color,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  };
}

// ── registros de foco ───────────────────────────────────────────────────────

export interface FocusRecordRow {
  id: string;
  user_id: string;
  day: string;
  ended_at: string;
  focused_ms: number;
  mode: TimerMode;
  preset_id: string | null;
  preset_name: string;
  completed_pomodoro: boolean;
  partial: boolean;
}

export function recordToRow(record: FocusRecord, userId: string): FocusRecordRow {
  return {
    id: record.id,
    user_id: userId,
    day: record.day,
    ended_at: new Date(record.endedAt).toISOString(),
    focused_ms: record.focusedMs,
    mode: record.mode,
    preset_id: record.presetId,
    preset_name: record.presetName,
    completed_pomodoro: record.completedPomodoro,
    partial: record.partial,
  };
}

export function rowToRecord(row: FocusRecordRow): FocusRecord {
  return {
    id: row.id,
    day: row.day,
    endedAt: Date.parse(row.ended_at),
    focusedMs: row.focused_ms,
    mode: row.mode,
    presetId: row.preset_id,
    presetName: row.preset_name,
    completedPomodoro: row.completed_pomodoro,
    partial: row.partial,
  };
}

// ── links de audio ──────────────────────────────────────────────────────────

export type LinkKind = 'favorite' | 'recent';

export interface AudioLinkRow {
  id: string;
  user_id: string;
  url: string;
  title: string;
  video_id: string | null;
  playlist_id: string | null;
  kind: LinkKind;
  played_at: string | null;
  deleted_at: string | null;
}

export function linkToRow(link: SavedLink, userId: string, kind: LinkKind, playedAt?: number): Omit<AudioLinkRow, 'deleted_at'> {
  return {
    id: link.id,
    user_id: userId,
    url: link.url,
    title: link.title,
    video_id: link.videoId,
    playlist_id: link.playlistId,
    kind,
    played_at: playedAt ? new Date(playedAt).toISOString() : null,
  };
}

export function rowToLink(row: AudioLinkRow): SavedLink {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    videoId: row.video_id,
    playlistId: row.playlist_id,
  };
}

// ── agregados diarios ───────────────────────────────────────────────────────

export interface DailyTotalRow {
  day: string;
  focused_ms: number;
  pomodoros: number;
  blocks: number;
}
