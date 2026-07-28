export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;

/**
 * Formatea a `mm:ss`, o `h:mm:ss` cuando pasa la hora.
 *
 * Redondea hacia arriba a propósito: un timer de 25:00 debe mostrar "25:00"
 * durante su primer segundo, no "24:59". Con floor el usuario ve el número
 * bajar apenas presiona iniciar y da la sensación de haber perdido un segundo.
 */
export function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.ceil(clamped / SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Versión compacta y legible para listados: "25 min", "1 h 30 min". */
export function formatDurationLabel(ms: number): string {
  const totalMinutes = Math.round(ms / MINUTE);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** Para el atributo `aria-label` y para el título de la pestaña. */
export function formatSpokenDuration(ms: number): string {
  const totalSeconds = Math.ceil(Math.max(0, ms) / SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} segundos`;
  if (seconds === 0) return `${minutes} minutos`;
  return `${minutes} minutos y ${seconds} segundos`;
}

export function minutesToMs(minutes: number): number {
  return Math.round(minutes * MINUTE);
}

export function msToMinutes(ms: number): number {
  return ms / MINUTE;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clave `YYYY-MM-DD` en hora **local**.
 *
 * Deliberadamente local y no UTC: una sesión de las 22 h en Argentina pertenece a
 * ese día para el usuario, aunque en UTC ya sea el siguiente. Usar toISOString()
 * acá partiría las noches en dos días y rompería las rachas de cualquiera que
 * trabaje tarde.
 */
export function dayKey(date: Date | number = Date.now()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Clave del día desplazado N días respecto de hoy. Negativo = hacia atrás. */
export function dayKeyOffset(offset: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + offset);
  return dayKey(d);
}

/** Convierte una clave de día a Date local a medianoche. */
export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

/** Las últimas `count` claves de día, de la más vieja a hoy. */
export function recentDayKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => dayKeyOffset(i - (count - 1)));
}

/** Clave del lunes de la semana en curso. */
export function startOfWeekKey(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  // getDay() devuelve 0 para domingo; acá la semana arranca el lunes.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return dayKey(d);
}

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** "lun 12" — etiqueta compacta para el eje del gráfico. */
export function formatDayShort(key: string): string {
  const d = parseDayKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`;
}

/** "lunes 12 de mayo" — para tooltips y la vista de tabla. */
export function formatDayLong(key: string): string {
  return parseDayKey(key).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}
