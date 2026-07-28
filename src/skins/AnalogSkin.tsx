import type { SkinProps } from './types';
import { CENTER, VIEWBOX, arcPath, polar } from './geometry';
import { formatDuration } from '@/utils/time';
import { phaseCaption } from './TimeReadout';

const FACE_RADIUS = 88;
const WEDGE_RADIUS = 74;

/**
 * Reloj analógico, con la lógica de un timer de cocina y no la de un reloj de
 * pared: la cuña marca cuánto falta y se cierra sola, la aguja larga cuenta los
 * minutos restantes y la fina los segundos. Las tres se derivan del mismo
 * `remainingMs`, así que nunca se desincronizan entre sí.
 */
export function AnalogSkin({ progress, remainingMs, phase, status }: SkinProps) {
  const remainingSeconds = remainingMs / 1000;
  const secondAngle = (remainingSeconds % 60) * 6;
  const minuteAngle = ((remainingSeconds / 60) % 60) * 6;
  const remainingSweep = Math.max(0, (1 - progress) * 360);

  const paused = status === 'paused';

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="size-full">
        <circle cx={CENTER} cy={CENTER} r={FACE_RADIUS} fill="var(--c-surface)" stroke="var(--c-border)" strokeWidth={1.5} />

        {/* Cuña de tiempo restante */}
        {remainingSweep > 0.5 && (
          <path
            d={`M ${CENTER} ${CENTER} L ${polar(CENTER, CENTER, WEDGE_RADIUS, 0).x} ${polar(CENTER, CENTER, WEDGE_RADIUS, 0).y} ${arcPath(CENTER, CENTER, WEDGE_RADIUS, 0, remainingSweep).replace(/^M[^A]*/, '')} Z`}
            fill="var(--phase-color)"
            opacity={paused ? 0.1 : 0.16}
          />
        )}

        {/* Marcas: cada 5 minutos más largas y gruesas */}
        {Array.from({ length: 60 }, (_, i) => {
          const major = i % 5 === 0;
          const outer = polar(CENTER, CENTER, FACE_RADIUS - 6, i * 6);
          const inner = polar(CENTER, CENTER, FACE_RADIUS - (major ? 15 : 10), i * 6);
          return (
            <line
              key={i}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={major ? 'var(--c-text-muted)' : 'var(--c-border)'}
              strokeWidth={major ? 2 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {[0, 15, 30, 45].map((minute) => {
          const p = polar(CENTER, CENTER, FACE_RADIUS - 27, minute * 6);
          return (
            <text
              key={minute}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={11}
              fontWeight={500}
              fill="var(--c-text-faint)"
              fontFamily="var(--font-sans)"
            >
              {minute === 0 ? 60 : minute}
            </text>
          );
        })}

        <g opacity={paused ? 0.45 : 1} className="transition-opacity duration-300">
          {/* Aguja de minutos */}
          <line
            x1={polar(CENTER, CENTER, -12, minuteAngle).x}
            y1={polar(CENTER, CENTER, -12, minuteAngle).y}
            x2={polar(CENTER, CENTER, 56, minuteAngle).x}
            y2={polar(CENTER, CENTER, 56, minuteAngle).y}
            stroke="var(--c-text)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* Aguja de segundos */}
          <line
            x1={polar(CENTER, CENTER, -14, secondAngle).x}
            y1={polar(CENTER, CENTER, -14, secondAngle).y}
            x2={polar(CENTER, CENTER, 72, secondAngle).x}
            y2={polar(CENTER, CENTER, 72, secondAngle).y}
            stroke="var(--phase-color)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <circle cx={CENTER} cy={CENTER} r={4.5} fill="var(--c-text)" />
          <circle cx={CENTER} cy={CENTER} r={1.8} fill="var(--c-surface)" />
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-[16%] flex flex-col items-center gap-0.5">
        <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-faint">
          {phaseCaption(phase, status, remainingMs)}
        </span>
        <span className={`tabular text-sm font-medium text-muted ${paused ? 'opacity-50' : ''}`}>
          {formatDuration(remainingMs)}
        </span>
      </div>
    </div>
  );
}
