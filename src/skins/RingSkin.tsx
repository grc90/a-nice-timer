import type { SkinProps } from './types';
import { CENTER, VIEWBOX, polar } from './geometry';
import { TimeReadout } from './TimeReadout';

const RADIUS = 84;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Anillo de tiempo.
 *
 * El arco se vacía en sentido horario a medida que avanza la cuenta regresiva:
 * lo que queda de trazo es literalmente lo que queda de tiempo. Es la lectura
 * más directa de las seis skins, por eso es la de arranque.
 */
export function RingSkin({ progress, remainingMs, phase, status, reducedMotion }: SkinProps) {
  const remainingFraction = 1 - progress;
  const head = polar(CENTER, CENTER, RADIUS, remainingFraction * 360);
  const running = status === 'running';

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="size-full -rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--phase-color)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--phase-color)" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="var(--c-border)" strokeWidth={5} opacity={0.55} />

        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={6.5}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          // El offset positivo recorta el trazo desde el final: el anillo se
          // consume en lugar de llenarse.
          strokeDashoffset={CIRCUMFERENCE * progress}
          className={status === 'paused' ? 'opacity-40 transition-opacity' : 'transition-opacity'}
        />
      </svg>

      {/* Punta luminosa en el extremo del arco. Fuera del SVG rotado para poder
          usar la animación de pulso de CSS sin heredar la rotación. */}
      {remainingFraction > 0.002 && (
        <div
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${(head.x / VIEWBOX) * 100}%`,
            top: `${(head.y / VIEWBOX) * 100}%`,
            background: 'var(--phase-color)',
            boxShadow: running ? '0 0 12px 2px var(--phase-color)' : 'none',
            opacity: status === 'paused' ? 0.4 : 1,
          }}
        >
          {running && !reducedMotion && (
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: 'var(--phase-color)', animation: 'ant-pulse-ring 2.4s ease-out infinite' }}
            />
          )}
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        <TimeReadout remainingMs={remainingMs} phase={phase} status={status} size="md" />
      </div>
    </div>
  );
}
