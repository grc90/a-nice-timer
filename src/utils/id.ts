/**
 * ID único. Se usará como clave primaria también en Supabase (paso 6), por eso
 * conviene un UUID real y no un contador local: permite generar el id en el
 * cliente y sincronizar sin colisiones ni round-trip al servidor.
 */
export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback para contextos no seguros (http:// en LAN, WebView viejo).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
