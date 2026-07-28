/** Helpers geométricos compartidos por las skins. Todas trabajan en un viewBox 200×200. */

export const VIEWBOX = 200;
export const CENTER = VIEWBOX / 2;

/**
 * Punto sobre una circunferencia.
 *
 * El ángulo 0 apunta hacia arriba (las 12) y crece en sentido horario, que es
 * como se piensa un reloj — no como los ejes de SVG.
 */
export function polar(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/** Path de un arco desde `startAngle` hasta `endAngle`, en sentido horario. */
export function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return '';

  // Un arco SVG no puede describir 360°: el punto inicial y final coinciden y el
  // navegador no dibuja nada. Se parte en dos mitades.
  if (sweep >= 359.999) {
    const half = arcPath(cx, cy, radius, startAngle, startAngle + 180);
    const rest = arcPath(cx, cy, radius, startAngle + 180, startAngle + 359.99);
    return `${half} ${rest.replace(/^M[^A]*/, '')}`;
  }

  const start = polar(cx, cy, radius, startAngle);
  const end = polar(cx, cy, radius, endAngle);
  const largeArc = sweep > 180 ? 1 : 0;

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

/** Interpolación lineal. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Suavizado ease-in-out para transiciones de color y posición. */
export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
