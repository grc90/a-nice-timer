import { formatDuration } from '@/utils/time';
import { phaseCaption } from './TimeReadout';
import type { SkinProps } from './types';

/**
 * Digital minimalista.
 *
 * Los dígitos llevan el peso; el progreso se reduce a una línea fina bajo el
 * número. Cada dígito va en su propio span de ancho fijo para que el número no
 * se mueva lateralmente al cambiar de "19" a "20" — con `tabular-nums` sobre
 * todo el bloque los dos puntos igual desplazarían el conjunto.
 */
export function DigitalSkin({ progress, remainingMs, phase, status, reducedMotion }: SkinProps) {
  const text = formatDuration(remainingMs);
  const blink = status === 'running' && !reducedMotion;

  return (
    <div className="flex aspect-square w-full flex-col items-center justify-center gap-6">
      <span className="text-[0.6875rem] font-medium uppercase tracking-[0.22em] text-faint">
        {phaseCaption(phase, status, remainingMs)}
      </span>

      <div
        className={`flex items-baseline font-mono font-extralight leading-none text-ink transition-opacity duration-300 ${
          status === 'paused' ? 'opacity-40' : ''
        }`}
        style={{ fontSize: 'clamp(3rem, 17cqw, 7rem)' }}
      >
        {text.split('').map((char, index) =>
          char === ':' ? (
            <span
              key={index}
              className="px-[0.06em] text-accent"
              style={
                blink
                  ? { animation: 'ant-blink 2s steps(1, end) infinite' }
                  : undefined
              }
            >
              :
            </span>
          ) : (
            <span key={index} className="tabular inline-block text-center" style={{ width: '0.62em' }}>
              {char}
            </span>
          ),
        )}
      </div>

      <div className="h-px w-4/5 overflow-hidden rounded-full bg-[var(--c-border)]">
        <div
          className="h-full rounded-full transition-[width] duration-200 ease-linear"
          style={{
            width: `${(1 - progress) * 100}%`,
            background: 'var(--phase-color)',
            opacity: status === 'paused' ? 0.4 : 1,
          }}
        />
      </div>
    </div>
  );
}
