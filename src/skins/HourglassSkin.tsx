import { useMemo } from 'react';
import type { SkinProps } from './types';
import { VIEWBOX } from './geometry';
import { formatDuration } from '@/utils/time';
import { phaseCaption } from './TimeReadout';

// Silueta. El cuello va arriba del centro para dejar sitio a la lectura abajo.
const TOP_Y = 22;
const NECK_Y = 88;
const BOTTOM_Y = 154;
const HALF_W = 46;
const NECK_HW = 3.5;

const TOP_SPAN = NECK_Y - TOP_Y;
const BOT_SPAN = BOTTOM_Y - NECK_Y;

/** Perfil del bulbo superior: del borde al cuello, cóncavo hacia adentro. */
const TOP_BULB = `M ${100 - HALF_W} ${TOP_Y} C ${100 - HALF_W} 48, ${100 - 32} 72, ${100 - NECK_HW} ${NECK_Y} L ${100 + NECK_HW} ${NECK_Y} C ${100 + 32} 72, ${100 + HALF_W} 48, ${100 + HALF_W} ${TOP_Y} Z`;

/** Bulbo inferior: el espejo exacto del superior. */
const BOT_BULB = `M ${100 - NECK_HW} ${NECK_Y} C ${100 - 32} 104, ${100 - HALF_W} 128, ${100 - HALF_W} ${BOTTOM_Y} L ${100 + HALF_W} ${BOTTOM_Y} C ${100 + HALF_W} 128, ${100 + 32} 104, ${100 + NECK_HW} ${NECK_Y} Z`;

/** Marcas de cuarto de volumen grabadas en el vidrio del bulbo superior. */
const VOLUME_TICKS = [0.25, 0.5, 0.75];

/**
 * Reloj de arena.
 *
 * La clave está en que **altura de arena y volumen de arena no son lo mismo**,
 * porque los bulbos son cónicos. Cada bulbo tiene su propia relación:
 *
 * - Arriba la arena ocupa un cono apoyado en el cuello, semejante al bulbo
 *   entero. Su volumen va con el cubo de la altura en 3D y con el cuadrado en la
 *   silueta 2D que dibujamos, así que la altura restante es √(1−p).
 * - Abajo la arena llena desde la base y lo que queda vacío es un cono invertido
 *   de volumen ∝ (1−h)². Despejando, la altura acumulada es 1−√(1−p).
 *
 * Que sean fórmulas distintas es justo el punto: en la mitad de la sesión el
 * bulbo de arriba se ve lleno al 71 % de su altura y el de abajo apenas al 29 %,
 * y sin embargo cada uno contiene exactamente la mitad de la arena. Con la misma
 * fórmula para los dos —o peor, con altura lineal— el reloj mentiría sobre
 * cuánto tiempo pasó.
 *
 * Las dos alturas suman siempre 1, que es la comprobación de que no se pierde ni
 * se inventa arena en el camino.
 */
export function HourglassSkin({ progress, remainingMs, phase, status, reducedMotion }: SkinProps) {
  const p = Math.min(1, Math.max(0, progress));
  const topLevel = Math.sqrt(1 - p);
  const botLevel = 1 - Math.sqrt(1 - p);

  const topSandH = TOP_SPAN * topLevel;
  const botSandH = BOT_SPAN * botLevel;
  const topSurfaceY = NECK_Y - topSandH;
  const botSurfaceY = BOTTOM_Y - botSandH;

  // El embudo de arriba y el montículo de abajo son cosméticos, pero se
  // compensan: lo que el embudo hunde en el centro, el montículo lo levanta.
  // Así la deformación no altera la lectura de proporciones.
  const dip = 9 * Math.min(1, topSandH / 26);
  const mound = 11 * Math.min(1, botSandH / 10) * (1 - botLevel * 0.5);
  const impactY = botSurfaceY - mound;

  const running = status === 'running';
  const paused = status === 'paused';
  const flowing = running && topSandH > 0.5;

  // Offsets fijos por grano: recalcularlos en cada frame haría vibrar el chorro.
  const grains = useMemo(
    () => Array.from({ length: 9 }, (_, i) => ({ delay: i * 0.13, offset: ((i * 7) % 5) - 2, size: 1.1 + (i % 3) * 0.3 })),
    [],
  );

  return (
    <div className="relative aspect-square w-full">
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="size-full">
        <defs>
          <clipPath id="hg-top">
            <path d={TOP_BULB} />
          </clipPath>
          <clipPath id="hg-bottom">
            <path d={BOT_BULB} />
          </clipPath>

          <linearGradient id="hg-sand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--phase-color)" stopOpacity="0.72" />
            <stop offset="55%" stopColor="var(--phase-color)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--phase-color)" stopOpacity="1" />
          </linearGradient>

          {/* Tinte del vidrio: apenas perceptible, sólo lo suficiente para que
              el cristal se lea como volumen y no como contorno vacío. */}
          <linearGradient id="hg-glass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--c-text)" stopOpacity="0.06" />
            <stop offset="42%" stopColor="var(--c-text)" stopOpacity="0.015" />
            <stop offset="100%" stopColor="var(--c-text)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Sombra de apoyo */}
        <ellipse cx={100} cy={168} rx={40} ry={4} fill="var(--c-text)" opacity={0.07} />

        <g opacity={paused ? 0.55 : 1} className="transition-opacity duration-300">
          <path d={TOP_BULB} fill="url(#hg-glass)" />
          <path d={BOT_BULB} fill="url(#hg-glass)" />

          {/* ── Arena del bulbo superior ─────────────────────────────────── */}
          {topSandH > 0.3 && (
            <g clipPath="url(#hg-top)">
              <path
                d={`M ${100 - HALF_W - 6} ${topSurfaceY} Q 100 ${topSurfaceY + dip * 2} ${100 + HALF_W + 6} ${topSurfaceY} L ${100 + HALF_W + 6} ${NECK_Y + 2} L ${100 - HALF_W - 6} ${NECK_Y + 2} Z`}
                fill="url(#hg-sand)"
              />
              {/* Filo claro en la superficie: le da relieve al embudo. */}
              <path
                d={`M ${100 - HALF_W - 6} ${topSurfaceY} Q 100 ${topSurfaceY + dip * 2} ${100 + HALF_W + 6} ${topSurfaceY}`}
                fill="none"
                stroke="#fff"
                strokeOpacity={0.22}
                strokeWidth={1.2}
              />
            </g>
          )}

          {/* ── Arena acumulada abajo ────────────────────────────────────── */}
          {botSandH > 0.3 && (
            <g clipPath="url(#hg-bottom)">
              <path
                d={`M ${100 - HALF_W - 6} ${botSurfaceY} Q 100 ${botSurfaceY - mound * 2} ${100 + HALF_W + 6} ${botSurfaceY} L ${100 + HALF_W + 6} ${BOTTOM_Y + 2} L ${100 - HALF_W - 6} ${BOTTOM_Y + 2} Z`}
                fill="url(#hg-sand)"
              />
              <path
                d={`M ${100 - HALF_W - 6} ${botSurfaceY} Q 100 ${botSurfaceY - mound * 2} ${100 + HALF_W + 6} ${botSurfaceY}`}
                fill="none"
                stroke="#fff"
                strokeOpacity={0.2}
                strokeWidth={1.2}
              />
            </g>
          )}

          {/* ── Chorro ───────────────────────────────────────────────────── */}
          {flowing && (
            <g clipPath="url(#hg-bottom)">
              <path
                d={`M 98.6 ${NECK_Y} L 101.4 ${NECK_Y} L 100.7 ${impactY} L 99.3 ${impactY} Z`}
                fill="var(--phase-color)"
                opacity={0.55}
              />
              {!reducedMotion &&
                grains.map((grain, i) => (
                  <circle
                    key={i}
                    cx={100 + grain.offset * 0.7}
                    cy={NECK_Y}
                    r={grain.size}
                    fill="var(--phase-color)"
                    style={{
                      animation: `ant-sand-fall 0.85s linear ${grain.delay}s infinite`,
                      // El recorrido se acorta a medida que sube el montículo.
                      ['--fall-distance' as string]: `${Math.max(4, impactY - NECK_Y)}px`,
                    }}
                  />
                ))}
              {/* Impacto: delata que la arena sigue cayendo aunque el nivel
                  todavía no se mueva visiblemente. */}
              {!reducedMotion && (
                <ellipse
                  cx={100}
                  cy={impactY}
                  rx={7}
                  ry={2.2}
                  fill="var(--phase-color)"
                  style={{
                    animation: 'ant-sand-impact 0.85s ease-out infinite',
                    // Sin fill-box el scaleX toma como origen la esquina del
                    // viewBox y la elipse se desplaza en vez de ensancharse.
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  }}
                />
              )}
            </g>
          )}

          {/* ── Vidrio ───────────────────────────────────────────────────── */}
          {/* Graduaciones de cuarto de volumen, ubicadas por la raíz y no por
              alturas iguales: la marca del 50 % cae al 71 % de la altura. */}
          <g clipPath="url(#hg-top)" opacity={0.32}>
            {VOLUME_TICKS.map((volume) => {
              const y = NECK_Y - TOP_SPAN * Math.sqrt(volume);
              return (
                <line
                  key={volume}
                  x1={100 - HALF_W}
                  y1={y}
                  x2={100 + HALF_W}
                  y2={y}
                  stroke="var(--c-text)"
                  strokeWidth={0.7}
                  strokeDasharray="2 4"
                />
              );
            })}
          </g>

          <path d={TOP_BULB} fill="none" stroke="var(--c-border)" strokeWidth={2} strokeLinejoin="round" />
          <path d={BOT_BULB} fill="none" stroke="var(--c-border)" strokeWidth={2} strokeLinejoin="round" />

          {/* Reflejo especular sobre la pared izquierda. */}
          <path
            d={`M ${100 - HALF_W + 9} ${TOP_Y + 8} C ${100 - HALF_W + 7} 46, ${100 - 27} 68, ${100 - 9} ${NECK_Y - 6}`}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.17}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <path
            d={`M ${100 - 9} ${NECK_Y + 8} C ${100 - 27} 108, ${100 - HALF_W + 7} 130, ${100 - HALF_W + 9} ${BOTTOM_Y - 8}`}
            fill="none"
            stroke="#fff"
            strokeOpacity={0.12}
            strokeWidth={2.4}
            strokeLinecap="round"
          />

          {/* ── Montura ──────────────────────────────────────────────────── */}
          <rect x={34} y={12} width={132} height={11} rx={4} fill="var(--c-text-faint)" opacity={0.42} />
          <rect x={34} y={BOTTOM_Y} width={132} height={11} rx={4} fill="var(--c-text-faint)" opacity={0.42} />
          <rect x={38} y={14} width={4.5} height={BOTTOM_Y - 5} rx={2.2} fill="var(--c-text-faint)" opacity={0.3} />
          <rect x={157.5} y={14} width={4.5} height={BOTTOM_Y - 5} rx={2.2} fill="var(--c-text-faint)" opacity={0.3} />
        </g>
      </svg>

      {/* La lectura va fuera del vidrio: encima del cuello taparía el chorro,
          que es donde se ve que el tiempo corre. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5">
        <span className={`tabular text-3xl font-light leading-none text-ink sm:text-4xl ${paused ? 'opacity-50' : ''}`}>
          {formatDuration(remainingMs)}
        </span>
        <span className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-faint">
          {phaseCaption(phase, status, remainingMs)}
        </span>
      </div>
    </div>
  );
}
