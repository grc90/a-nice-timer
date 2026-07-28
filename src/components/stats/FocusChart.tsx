import { useId, useState } from 'react';
import type { DayTotal } from '@/types';
import { MINUTE, formatDayLong, formatDayShort, formatDurationLabel } from '@/utils/time';
import { cn } from '@/utils/cn';

interface FocusChartProps {
  series: { day: string; total: DayTotal }[];
  /** Meta diaria en ms. Si es > 0 se dibuja como línea de referencia. */
  goalMs: number;
}

/** Techo redondeado a una cifra limpia, para que las guías caigan en valores legibles. */
function niceCeiling(maxMs: number): number {
  const minutes = maxMs / MINUTE;
  if (minutes <= 0) return 60 * MINUTE;
  const steps = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480, 600, 720];
  const chosen = steps.find((s) => s >= minutes) ?? Math.ceil(minutes / 120) * 120;
  return chosen * MINUTE;
}

/**
 * Foco por día.
 *
 * Una sola serie, así que un solo color y sin leyenda: el título ya dice qué se
 * está midiendo, y una caja con un swatch único no agregaría nada. Tampoco hay
 * degradado por valor — la altura de la columna ya codifica la magnitud, y
 * teñirla además por tamaño gastaría el canal de color en información duplicada.
 *
 * El único valor rotulado directamente es el máximo. Un número sobre cada
 * columna se vuelve ruido y nadie lo lee; el resto vive en el hover y en la
 * tabla, que además es la ruta accesible.
 */
export function FocusChart({ series, goalMs }: FocusChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  const maxValue = Math.max(...series.map((d) => d.total.focusedMs), 0);
  const ceiling = niceCeiling(Math.max(maxValue, goalMs));
  const maxIndex = maxValue > 0 ? series.findIndex((d) => d.total.focusedMs === maxValue) : -1;
  const hasData = maxValue > 0;
  const first = series[0];
  const last = series[series.length - 1];

  const gridLines = [0, 0.5, 1];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">
          Foco por día · últimos {series.length}
        </h3>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          aria-expanded={showTable}
          aria-controls={tableId}
          className="rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          {showTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {showTable ? (
        <div id={tableId} className="max-h-64 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface-2">
              <tr className="text-faint">
                <th scope="col" className="px-3 py-2 font-medium">Día</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Foco</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Pomodoros</th>
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map(({ day, total }) => (
                <tr key={day} className="border-t border-line/60">
                  <th scope="row" className="px-3 py-1.5 font-normal text-muted">{formatDayLong(day)}</th>
                  <td className="tabular px-3 py-1.5 text-right text-ink">
                    {total.focusedMs > 0 ? formatDurationLabel(total.focusedMs) : '—'}
                  </td>
                  <td className="tabular px-3 py-1.5 text-right text-muted">{total.pomodoros || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="relative h-40 pl-11">
            {/* Guías: hairline, sólidas y a un paso del fondo, para que queden detrás del dato. */}
            {gridLines.map((fraction) => (
              <div
                key={fraction}
                // `left-11` + `right-0` explícitos y no `inset-x-0`: dos utilidades
                // que fijan la misma propiedad dependen del orden en la hoja de
                // estilos, que Tailwind no garantiza.
                className="pointer-events-none absolute left-11 right-0 flex items-center"
                style={{ bottom: `${fraction * 100}%` }}
              >
                <span className="tabular absolute -left-11 w-10 -translate-y-1/2 text-right text-[0.625rem] text-faint">
                  {fraction === 0 ? '0' : formatDurationLabel(ceiling * fraction)}
                </span>
                <span className="h-px w-full bg-[var(--c-border)]" />
              </div>
            ))}

            {/* Meta diaria: referencia punteada, distinta de las guías para que no se confunda con una. */}
            {goalMs > 0 && goalMs <= ceiling && (
              <div
                className="pointer-events-none absolute left-11 right-0 border-t border-dashed border-accent/60"
                style={{ bottom: `${(goalMs / ceiling) * 100}%` }}
              >
                <span className="absolute -top-4 right-0 text-[0.625rem] font-medium text-accent">meta</span>
              </div>
            )}

            <div className="relative flex h-full items-end gap-[2px]">
              {series.map(({ day, total }, index) => {
                const heightPercent = ceiling > 0 ? (total.focusedMs / ceiling) * 100 : 0;
                const active = hovered === index;

                return (
                  <button
                    key={day}
                    type="button"
                    // Todo el alto de la columna es zona de hover, no sólo la barra
                    // pintada: apuntar a una barra de 3 px sería imposible.
                    className="group relative flex h-full flex-1 items-end justify-center outline-none"
                    onPointerEnter={() => setHovered(index)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(index)}
                    onBlur={() => setHovered(null)}
                    aria-label={`${formatDayLong(day)}: ${
                      total.focusedMs > 0 ? formatDurationLabel(total.focusedMs) : 'sin foco'
                    }`}
                  >
                    <span
                      className={cn(
                        'w-full max-w-6 rounded-t-[4px] transition-[height,opacity] duration-300',
                        active ? 'opacity-100' : 'opacity-85',
                      )}
                      style={{
                        height: `${Math.max(heightPercent, total.focusedMs > 0 ? 2 : 0)}%`,
                        background: 'var(--c-accent)',
                      }}
                    />
                    {/* Día sin datos: un punto tenue en la base, para que la
                        ausencia se lea como cero y no como un fallo del gráfico. */}
                    {total.focusedMs === 0 && (
                      <span className="absolute bottom-0 size-1 rounded-full bg-[var(--c-border)]" />
                    )}

                    {active && (
                      <span className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg border border-line bg-surface px-2 py-1 text-left shadow-[var(--shadow-lift)]">
                        <span className="tabular block text-xs font-semibold text-ink">
                          {total.focusedMs > 0 ? formatDurationLabel(total.focusedMs) : 'Sin foco'}
                        </span>
                        <span className="block text-[0.625rem] text-faint">{formatDayLong(day)}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Etiqueta directa del máximo, el único valor que se rotula. */}
            {maxIndex >= 0 && hovered === null && (
              <span
                className="tabular pointer-events-none absolute text-[0.625rem] font-medium text-muted"
                style={{
                  left: `calc(2.75rem + ${((maxIndex + 0.5) / series.length) * 100}% - 1.5rem)`,
                  bottom: `calc(${(maxValue / ceiling) * 100}% + 4px)`,
                  width: '3rem',
                  textAlign: 'center',
                }}
              >
                {formatDurationLabel(maxValue)}
              </span>
            )}
          </div>

          <div className="flex justify-between pl-11 text-[0.625rem] text-faint">
            <span>{first ? formatDayShort(first.day) : ''}</span>
            <span>{last ? formatDayShort(last.day) : ''}</span>
          </div>

          {!hasData && (
            <p className="pl-11 text-xs text-faint">Todavía no hay foco registrado en este período.</p>
          )}
        </>
      )}
    </div>
  );
}
