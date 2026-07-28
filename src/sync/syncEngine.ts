import { getSupabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { usePresetsStore } from '@/store/presetsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useStatsStore } from '@/store/statsStore';
import { useAudioStore } from '@/store/audioStore';
import type { DayTotal, SessionPreset } from '@/types';
import { dayKeyOffset } from '@/utils/time';
import {
  linkToRow,
  presetToRow,
  recordToRow,
  rowToLink,
  rowToPreset,
  rowToRecord,
  type AudioLinkRow,
  type DailyTotalRow,
  type FocusRecordRow,
  type PresetRow,
} from './mappers';

/**
 * Sincronización entre localStorage y Supabase.
 *
 * ## El modelo
 *
 * **localStorage sigue siendo la fuente de verdad de la app corriendo; Supabase
 * es un espejo.** No al revés. Esa es la condición para que el modo invitado sea
 * una función real y no un estado degradado: la app nunca espera a la red para
 * responder, y perder la conexión no cambia nada de lo que se ve.
 *
 * ## Resolución de conflictos, por entidad
 *
 * No hay una regla única porque las entidades no se comportan igual:
 *
 * - **Presets**: última escritura gana, comparando `updatedAt`. Los borrados
 *   viajan como lápidas.
 * - **Registros de foco**: append-only, así que la fusión es una unión por id y
 *   *no puede haber conflicto*. Es la propiedad que hace confiable al histórico.
 * - **Totales diarios**: no se sincronizan, se recalculan en el servidor con SQL.
 * - **Ajustes y metas**: al entrar en un dispositivo gana lo remoto si existe —
 *   iniciar sesión es traer tus preferencias. Si no existe, se sube lo local,
 *   que es el caso de la migración desde invitado.
 */

/** Cuántos días de histórico se traen del servidor. */
const HISTORY_DAYS = 400;

/** Espera tras el último cambio antes de subir. Agrupa ráfagas de ediciones. */
const PUSH_DEBOUNCE_MS = 2500;

// ── Lectura del estado local ────────────────────────────────────────────────

/** Campos de ajustes que viajan a la nube. Las acciones y lo efímero quedan fuera. */
function readSettingsPayload() {
  const s = useSettingsStore.getState();
  return {
    themeMode: s.themeMode,
    palette: s.palette,
    skinId: s.skinId,
    auroraEnabled: s.auroraEnabled,
    auroraMotion: s.auroraMotion,
    auroraIntensity: s.auroraIntensity,
    alarmVolume: s.alarmVolume,
    alarmRepeats: s.alarmRepeats,
    notificationsEnabled: s.notificationsEnabled,
    keepAwake: s.keepAwake,
    autoFocusMode: s.autoFocusMode,
    showTimeInTitle: s.showTimeInTitle,
    defaultPomodoro: s.defaultPomodoro,
    defaultAlarmId: s.defaultAlarmId,
  };
}

type SettingsPayload = ReturnType<typeof readSettingsPayload>;

function applySettingsPayload(data: Partial<SettingsPayload>): void {
  // `setState` parcial en vez de llamar a cada setter: evita catorce
  // notificaciones seguidas a los suscriptores, que dispararían catorce pushes.
  useSettingsStore.setState(data);
}

// ── Bajada ──────────────────────────────────────────────────────────────────

async function pullPresets(userId: string): Promise<void> {
  const db = await getSupabase();
  const { data, error } = await db.from('presets').select('*').eq('user_id', userId);
  if (error) throw error;

  const rows = (data ?? []) as PresetRow[];
  const local = usePresetsStore.getState();
  const byId = new Map(local.presets.map((p) => [p.id, p]));
  const locallyDeleted = new Set(local.deletedIds);

  for (const row of rows) {
    if (row.deleted_at) {
      // La lápida remota sólo gana si es posterior a la última edición local;
      // si no, alguien editó el preset después de borrarlo en otro dispositivo.
      const mine = byId.get(row.id);
      if (!mine || Date.parse(row.deleted_at) >= mine.updatedAt) byId.delete(row.id);
      continue;
    }

    // Lo borrado acá todavía no se subió: no dejar que lo remoto lo reviva.
    if (locallyDeleted.has(row.id)) continue;

    const remote = rowToPreset(row);
    const mine = byId.get(row.id);
    if (!mine || remote.updatedAt > mine.updatedAt) byId.set(row.id, remote);
  }

  usePresetsStore.getState().replaceAll([...byId.values()]);
}

async function pullSettingsAndGoals(userId: string): Promise<void> {
  const db = await getSupabase();

  const [settingsResult, goalsResult] = await Promise.all([
    db.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
    db.from('goals').select('daily_focus_ms, weekly_focus_ms').eq('user_id', userId).maybeSingle(),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (goalsResult.error) throw goalsResult.error;

  if (settingsResult.data?.data) {
    applySettingsPayload(settingsResult.data.data as Partial<SettingsPayload>);
  }

  if (goalsResult.data) {
    useStatsStore.setState({
      goals: {
        dailyFocusMs: Number(goalsResult.data.daily_focus_ms),
        weeklyFocusMs: Number(goalsResult.data.weekly_focus_ms),
      },
    });
  }
}

async function pullStats(userId: string): Promise<void> {
  const db = await getSupabase();
  const since = dayKeyOffset(-HISTORY_DAYS);

  const [recordsResult, totalsResult] = await Promise.all([
    // Sólo los registros recientes: el detalle viejo no se usa en la UI y el
    // histórico completo ya vive en los totales que calcula el servidor.
    db.from('focus_records').select('*').eq('user_id', userId).gte('day', dayKeyOffset(-180)).order('ended_at'),
    db.rpc('daily_focus_totals', { since }),
  ]);

  if (recordsResult.error) throw recordsResult.error;
  if (totalsResult.error) throw totalsResult.error;

  useStatsStore.getState().mergeRecords(((recordsResult.data ?? []) as FocusRecordRow[]).map(rowToRecord));

  const totals: Record<string, DayTotal> = {};
  for (const row of (totalsResult.data ?? []) as DailyTotalRow[]) {
    totals[row.day] = {
      focusedMs: Number(row.focused_ms),
      pomodoros: Number(row.pomodoros),
      blocks: Number(row.blocks),
    };
  }
  useStatsStore.getState().applyRemoteTotals(totals);
}

async function pullFavorites(userId: string): Promise<void> {
  const db = await getSupabase();
  const { data, error } = await db.from('audio_links').select('*').eq('user_id', userId).eq('kind', 'favorite');
  if (error) throw error;

  const rows = (data ?? []) as AudioLinkRow[];
  const local = useAudioStore.getState();
  const byId = new Map(local.favorites.map((f) => [f.id, f]));
  const locallyDeleted = new Set(local.deletedFavoriteIds);

  for (const row of rows) {
    if (row.deleted_at) {
      byId.delete(row.id);
      continue;
    }
    if (locallyDeleted.has(row.id)) continue;
    if (!byId.has(row.id)) byId.set(row.id, rowToLink(row));
  }

  useAudioStore.getState().replaceFavorites([...byId.values()]);
}

// ── Subida ──────────────────────────────────────────────────────────────────

async function pushPresets(userId: string): Promise<void> {
  const db = await getSupabase();
  const { presets, deletedIds } = usePresetsStore.getState();

  if (presets.length > 0) {
    // El orden de la lista es dato del usuario, así que viaja como `sort_order`.
    const rows = presets.map((p: SessionPreset, index: number) => presetToRow(p, userId, index));
    const { error } = await db.from('presets').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  if (deletedIds.length > 0) {
    const { error } = await db
      .from('presets')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', deletedIds)
      .eq('user_id', userId);
    if (error) throw error;
    usePresetsStore.getState().clearTombstones(deletedIds);
  }
}

async function pushSettingsAndGoals(userId: string): Promise<void> {
  const db = await getSupabase();
  const { goals } = useStatsStore.getState();

  const [settingsResult, goalsResult] = await Promise.all([
    db.from('user_settings').upsert({ user_id: userId, data: readSettingsPayload() }, { onConflict: 'user_id' }),
    db.from('goals').upsert(
      { user_id: userId, daily_focus_ms: goals.dailyFocusMs, weekly_focus_ms: goals.weeklyFocusMs },
      { onConflict: 'user_id' },
    ),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (goalsResult.error) throw goalsResult.error;
}

async function pushRecords(userId: string): Promise<void> {
  const db = await getSupabase();
  const { records } = useStatsStore.getState();
  if (records.length === 0) return;

  // Idempotente por id, así que subir de más no rompe nada — pero se acota a los
  // últimos 180 días para no mandar 2000 filas en cada push.
  const cutoff = dayKeyOffset(-180);
  const rows: FocusRecordRow[] = records.filter((r) => r.day >= cutoff).map((r) => recordToRow(r, userId));
  if (rows.length === 0) return;

  const { error } = await db.from('focus_records').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

async function pushFavorites(userId: string): Promise<void> {
  const db = await getSupabase();
  const { favorites, deletedFavoriteIds } = useAudioStore.getState();

  if (favorites.length > 0) {
    const rows = favorites.map((f) => linkToRow(f, userId, 'favorite'));
    const { error } = await db.from('audio_links').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  if (deletedFavoriteIds.length > 0) {
    const { error } = await db
      .from('audio_links')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', deletedFavoriteIds)
      .eq('user_id', userId);
    if (error) throw error;
    useAudioStore.getState().clearFavoriteTombstones(deletedFavoriteIds);
  }
}

// ── Orquestación ────────────────────────────────────────────────────────────

let pushTimer: number | undefined;
let inFlight = false;

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) return String((error as { message: unknown }).message);
  return 'Error desconocido de sincronización';
}

/**
 * Sincronización completa: primero bajar, después subir.
 *
 * Ese orden importa. Bajando primero, la fusión decide qué gana con ambos lados
 * a la vista; subiendo primero pisaríamos lo remoto con lo local antes de
 * haberlo comparado.
 */
export async function runFullSync(userId: string): Promise<void> {
  if (inFlight) return;
  if (!navigator.onLine) {
    useAuthStore.getState().setSyncStatus('offline');
    return;
  }

  inFlight = true;
  useAuthStore.getState().setSyncStatus('syncing');

  try {
    await pullPresets(userId);
    await pullSettingsAndGoals(userId);
    await pullStats(userId);
    await pullFavorites(userId);

    await pushPresets(userId);
    await pushSettingsAndGoals(userId);
    await pushRecords(userId);
    await pushFavorites(userId);

    useAuthStore.getState().markSynced();
  } catch (error) {
    useAuthStore.getState().setSyncStatus('error', describeError(error));
  } finally {
    inFlight = false;
  }
}

/** Sólo subida, para cambios locales durante la sesión. */
export async function pushLocalChanges(userId: string): Promise<void> {
  if (inFlight) return;
  if (!navigator.onLine) {
    useAuthStore.getState().setSyncStatus('offline');
    return;
  }

  inFlight = true;
  useAuthStore.getState().setSyncStatus('syncing');

  try {
    await pushPresets(userId);
    await pushSettingsAndGoals(userId);
    await pushRecords(userId);
    await pushFavorites(userId);
    useAuthStore.getState().markSynced();
  } catch (error) {
    useAuthStore.getState().setSyncStatus('error', describeError(error));
  } finally {
    inFlight = false;
  }
}

/** Agrupa ráfagas de cambios en una sola subida. */
export function schedulePush(userId: string): void {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void pushLocalChanges(userId), PUSH_DEBOUNCE_MS);
}

export function cancelScheduledPush(): void {
  window.clearTimeout(pushTimer);
}
