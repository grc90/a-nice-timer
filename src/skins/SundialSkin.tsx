import type { SkinProps } from './types';
import { VIEWBOX, lerp, polar, smoothstep } from './geometry';
import { formatDuration } from '@/utils/time';
import { phaseCaption } from './TimeReadout';

const DIAL_CX = 100;
const DIAL_CY = 150;
const DIAL_R = 78;
const GNOMON_H = 74;

/**
 * Reloj de sol.
 *
 * La sombra barre 180° de izquierda a derecha, como el sol yendo de este a
 * oeste. Su largo también reacciona: larga al amanecer, corta al mediodía y
 * larga otra vez al atardecer, siguiendo la cotangente de la altura solar —
 * simplificada, pero con el comportamiento correcto. Eso da una segunda señal
 * del progreso además del ángulo: al llegar al mediodía visual se sabe que va
 * por la mitad sin leer el número.
 */
export function SundialSkin({ progress, remainingMs, phase, status }: SkinProps) {
  // 0 → sol al este (sombra al oeste). 1 → sol al oeste.
  const sunAngle = lerp(-90, 90, progress);
  const shadowAngle = sunAngle + 180;

  // Altura solar: 0 en los extremos, máxima al mediodía.
  const elevation = Math.sin(progress * Math.PI);
  const shadowLength = lerp(DIAL_R * 0.95, DIAL_R * 0.32, smoothstep(elevation));

  const shadowTip = polar(DIAL_CX, DIAL_CY, shadowLength, shadowAngle);
  const sunPos = polar(DIAL_CX, DIAL_CY, DIAL_R * 0.86, sunAngle);
  const paused = status === 'paused';

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="size-full">
        <defs>
          <linearGradient id="sundial-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--phase-color)" stopOpacity={0.16} />
            <stop offset="100%" stopColor="var(--phase-color)" stopOpacity={0.02} />
          </linearGradient>
          <radialGradient id="sundial-sun">
            <stop offset="0%" stopColor="var(--phase-color)" stopOpacity="0.9" />
            <stop offset="60%" stopColor="var(--phase-color)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--phase-color)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Bóveda: sólo el semicírculo superior, es donde vive el sol. */}
        <path
          d={`M ${DIAL_CX - DIAL_R} ${DIAL_CY} A ${DIAL_R} ${DIAL_R} 0 0 1 ${DIAL_CX + DIAL_R} ${DIAL_CY} Z`}
          fill="url(#sundial-sky)"
        />

        {/* Marcas horarias sobre el arco */}
        {Array.from({ length: 13 }, (_, i) => {
          const angle = lerp(-90, 90, i / 12);
          const outer = polar(DIAL_CX, DIAL_CY, DIAL_R, angle);
          const inner = polar(DIAL_CX, DIAL_CY, DIAL_R - (i % 3 === 0 ? 11 : 6), angle);
          const passed = i / 12 <= progress;
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={passed ? 'var(--phase-color)' : 'var(--c-border)'}
              strokeWidth={i % 3 === 0 ? 2 : 1.2}
              strokeLinecap="round"
              opacity={passed ? 0.85 : 0.6}
            />
          );
        })}

        {/* Base */}
        <line x1={DIAL_CX - DIAL_R} y1={DIAL_CY} x2={DIAL_CX + DIAL_R} y2={DIAL_CY} stroke="var(--c-border)" strokeWidth={1.5} />

        <circle cx={sunPos.x} cy={sunPos.y} r={26} fill="url(#sundial-sun)" opacity={paused ? 0.35 : 1} />
        <circle cx={sunPos.x} cy={sunPos.y} r={7} fill="var(--phase-color)" opacity={paused ? 0.4 : 1} />

        <g opacity={paused ? 0.45 : 1} className="transition-opacity duration-300">
          {/* Sombra: se afina hacia la punta, como una sombra real. */}
          <path
            d={`M ${DIAL_CX - 5} ${DIAL_CY} L ${DIAL_CX + 5} ${DIAL_CY} L ${shadowTip.x + 1.5} ${shadowTip.y} L ${shadowTip.x - 1.5} ${shadowTip.y} Z`}
            fill="var(--c-text)"
            opacity={0.16 + elevation * 0.1}
          />

          {/* Gnomon */}
          <path
            d={`M ${DIAL_CX - 6} ${DIAL_CY} L ${DIAL_CX + 6} ${DIAL_CY} L ${DIAL_CX + 2} ${DIAL_CY - GNOMON_H} L ${DIAL_CX - 2} ${DIAL_CY - GNOMON_H} Z`}
            fill="var(--c-text)"
            opacity={0.82}
          />
          <ellipse cx={DIAL_CX} cy={DIAL_CY} rx={9} ry={3} fill="var(--c-text)" opacity={0.28} />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 top-[8%] flex flex-col items-center gap-1">
        <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-faint">
          {phaseCaption(phase, status, remainingMs)}
        </span>
        <span className={`tabular text-3xl font-light leading-none text-ink sm:text-4xl ${paused ? 'opacity-50' : ''}`}>
          {formatDuration(remainingMs)}
        </span>
      </div>
    </div>
  );
}
