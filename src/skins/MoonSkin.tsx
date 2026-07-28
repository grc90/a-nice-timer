import { useMemo } from 'react';
import type { SkinProps } from './types';
import { VIEWBOX, lerp, smoothstep } from './geometry';
import { formatDuration } from '@/utils/time';
import { phaseCaption } from './TimeReadout';

const MOON_R = 46;
const MOON_CX = 100;
const MOON_CY = 88;

/** Paradas del cielo: noche cerrada → primeras luces → amanecer pleno. */
const SKY_TOP: [number, number, number][] = [
  [242, 46, 13],
  [258, 42, 26],
  [208, 72, 58],
];
const SKY_BOTTOM: [number, number, number][] = [
  [252, 34, 20],
  [22, 62, 40],
  [34, 92, 74],
];

function mixHsl(stops: [number, number, number][], t: number): string {
  const scaled = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const index = Math.floor(scaled);
  const from = stops[index] ?? stops[0]!;
  const to = stops[index + 1] ?? from;
  const local = smoothstep(scaled - index);
  return `hsl(${lerp(from[0], to[0], local).toFixed(1)} ${lerp(from[1], to[1], local).toFixed(1)}% ${lerp(from[2], to[2], local).toFixed(1)}%)`;
}

/**
 * Fases lunares y ciclo día-noche.
 *
 * La luna crece de nueva a llena junto con el progreso, y el cielo pasa de noche
 * cerrada a amanecer. Son dos lecturas del mismo dato: una precisa (la fase, que
 * permite estimar cuánto falta) y otra ambiental (el color, que se percibe de
 * reojo sin mirar el número).
 *
 * El terminador es la geometría lunar real: una semielipse cuyo semieje
 * horizontal es r·|1−2k|, con k la fracción iluminada. En k=0.5 el semieje vale
 * cero y queda el cuarto exacto; pasado el medio, la curva invierte su sentido.
 */
export function MoonSkin({ progress, remainingMs, phase, status, reducedMotion }: SkinProps) {
  const k = progress;
  const rx = MOON_R * Math.abs(1 - 2 * k);
  const terminatorSweep = k < 0.5 ? 0 : 1;

  const litPath =
    `M ${MOON_CX} ${MOON_CY - MOON_R} ` +
    `A ${MOON_R} ${MOON_R} 0 0 1 ${MOON_CX} ${MOON_CY + MOON_R} ` +
    `A ${rx} ${MOON_R} 0 0 ${terminatorSweep} ${MOON_CX} ${MOON_CY - MOON_R} Z`;

  const starOpacity = 1 - smoothstep(progress * 1.5);

  const stars = useMemo(
    () =>
      // Secuencia determinista: unas estrellas que se reacomodan en cada render
      // titilarían de forma errática y distraerían, que es lo contrario a lo que
      // busca la app.
      Array.from({ length: 26 }, (_, i) => {
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const b = Math.sin(i * 78.233) * 12345.6789;
        return {
          x: (a - Math.floor(a)) * VIEWBOX,
          y: (b - Math.floor(b)) * 130,
          r: 0.6 + ((a - Math.floor(a)) * 1.1),
          delay: (b - Math.floor(b)) * 3,
        };
      }),
    [],
  );

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border border-line">
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="size-full">
        <defs>
          <linearGradient id="moon-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={mixHsl(SKY_TOP, progress)} />
            <stop offset="100%" stopColor={mixHsl(SKY_BOTTOM, progress)} />
          </linearGradient>
          <radialGradient id="moon-glow">
            <stop offset="0%" stopColor="#fff8e7" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#fff8e7" stopOpacity="0" />
          </radialGradient>
          <clipPath id="moon-lit">
            <path d={litPath} />
          </clipPath>
        </defs>

        <rect width={VIEWBOX} height={VIEWBOX} fill="url(#moon-sky)" />

        <g opacity={starOpacity}>
          {stars.map((star, i) => (
            <circle
              key={i}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#fff"
              opacity={0.85}
              style={
                reducedMotion ? undefined : { animation: `ant-twinkle 3.4s ease-in-out ${star.delay}s infinite` }
              }
            />
          ))}
        </g>

        <circle cx={MOON_CX} cy={MOON_CY} r={MOON_R * 1.9} fill="url(#moon-glow)" opacity={0.3 + k * 0.7} />

        {/* Disco en sombra: siempre visible, define la silueta aunque k sea 0. */}
        <circle cx={MOON_CX} cy={MOON_CY} r={MOON_R} fill="#0d0f18" opacity={0.55} />
        <circle cx={MOON_CX} cy={MOON_CY} r={MOON_R} fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={1} />

        {k > 0.002 && <path d={litPath} fill="#f6f1e4" opacity={status === 'paused' ? 0.55 : 0.97} />}

        {/* Cráteres, recortados a la parte iluminada */}
        {k > 0.02 && (
          <g clipPath="url(#moon-lit)" opacity={0.5}>
            <circle cx={88} cy={74} r={7} fill="#d9d2c0" />
            <circle cx={110} cy={98} r={5} fill="#d9d2c0" />
            <circle cx={96} cy={110} r={3.5} fill="#d9d2c0" />
            <circle cx={116} cy={70} r={3} fill="#d9d2c0" />
          </g>
        )}

        {/* Horizonte: ancla la escena y da escala a la luna. */}
        <path
          d={`M 0 168 Q 46 148 88 165 T 150 158 T 200 170 L 200 200 L 0 200 Z`}
          fill="#0a0b12"
          opacity={0.62 - progress * 0.22}
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-1">
        <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-white/55">
          {phaseCaption(phase, status, remainingMs)}
        </span>
        <span className={`tabular text-3xl font-light leading-none text-white sm:text-4xl ${status === 'paused' ? 'opacity-50' : ''}`}>
          {formatDuration(remainingMs)}
        </span>
      </div>
    </div>
  );
}
