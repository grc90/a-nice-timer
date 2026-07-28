import { useMemo, useState } from 'react';
import {
  computeStreak,
  dayTotal,
  distributionByMode,
  distributionByPreset,
  focusSeries,
  rangeTotal,
  useStatsStore,
  weekToDateTotal,
} from '@/store/statsStore';
import type { DistributionSlice } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, SegmentedControl, Stepper } from '@/components/ui/Field';
import { FocusChart } from './FocusChart';
import { GoalMeter } from './GoalMeter';
import { HOUR, MINUTE, dayKey, formatDurationLabel } from '@/utils/time';
import { cn } from '@/utils/cn';

type Range = '7' | '30';

const RANGE_OPTIONS: readonly { value: Range; label: string }[] = [
  { value: '7', label: '7 días' },
  { value: '30', label: '30 días' },
];

export function StatsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const daily = useStatsStore((s) => s.daily);
  const records = useStatsStore((s) => s.records);
  const goals = useStatsStore((s) => s.goals);
  const setGoals = useStatsStore((s) => s.setGoals);
  const clearHistory = useStatsStore((s) => s.clearHistory);

  const [range, setRange] = useState<Range>('7');
  const [confirmClear, setConfirmClear] = useState(false);

  const days = Number(range);

  // Los agregados recorren todos los registros: recalcularlos en cada render del
  // modal (que se re-renderiza al mover un stepper de metas) sería gratuito hoy y
  // caro con dos años de historia.
  const stats = useMemo(() => {
    const today = dayTotal(daily, dayKey());
    return {
      today,
      week: weekToDateTotal(daily),
      month: rangeTotal(daily, 30),
      streak: computeStreak(daily),
      series: focusSeries(daily, days),
      byMode: distributionByMode(records, days),
      byPreset: distributionByPreset(records, days),
    };
  }, [daily, records, days]);

  const hasAnyData = Object.keys(daily).length > 0;

  return (
    <Modal open={open} onClose={onClose} title="Estadísticas" size="lg">
      <div className="flex flex-col gap-7">
        {!hasAnyData ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-faint">
            Todavía no completaste ningún bloque de foco.
            <br />
            Cuando termines el primero, acá vas a ver tu historial.
          </p>
        ) : (
          <>
            {goals.dailyFocusMs > 0 && (
              <div className="grid gap-4 rounded-2xl border border-line bg-surface-2/40 p-4 sm:grid-cols-2">
                <GoalMeter currentMs={stats.today.focusedMs} goalMs={goals.dailyFocusMs} label="Meta de hoy" />
                {goals.weeklyFocusMs > 0 && (
                  <GoalMeter
                    currentMs={stats.week.focusedMs}
                    goalMs={goals.weeklyFocusMs}
                    label="Meta semanal"
                  />
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Hoy" value={formatDurationLabel(stats.today.focusedMs)} />
              <StatTile label="Esta semana" value={formatDurationLabel(stats.week.focusedMs)} />
              <StatTile label="Últimos 30 días" value={formatDurationLabel(stats.month.focusedMs)} />
              <StatTile
                label="Racha"
                value={`${stats.streak.current} d`}
                hint={
                  stats.streak.current === 0
                    ? 'Empezá hoy'
                    : stats.streak.activeToday
                      ? `Récord: ${stats.streak.best} d`
                      : 'Sumá foco hoy para extenderla'
                }
              />
            </div>

            <div className="flex flex-col gap-4">
              <SegmentedControl value={range} onChange={setRange} options={RANGE_OPTIONS} className="self-start" />
              <FocusChart series={stats.series} goalMs={goals.dailyFocusMs} />
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Distribution title="Por tipo de sesión" slices={stats.byMode} />
              <Distribution title="Por sesión guardada" slices={stats.byPreset} />
            </div>
          </>
        )}

        <section className="flex flex-col gap-4 border-t border-line pt-6">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">Metas</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meta diaria" hint="0 desactiva el medidor.">
              <Stepper
                value={Math.round(goals.dailyFocusMs / MINUTE)}
                onChange={(v) => setGoals({ dailyFocusMs: v * MINUTE })}
                min={0}
                max={16 * 60}
                step={15}
                unit="min"
              />
            </Field>
            <Field label="Meta semanal">
              <Stepper
                value={Math.round(goals.weeklyFocusMs / HOUR)}
                onChange={(v) => setGoals({ weeklyFocusMs: v * HOUR })}
                min={0}
                max={100}
                unit="h"
              />
            </Field>
          </div>
        </section>

        {hasAnyData && (
          <section className="flex items-center justify-between gap-3 border-t border-line pt-6">
            <div className="min-w-0">
              <p className="text-sm text-ink">Borrar historial</p>
              <p className="mt-0.5 text-xs text-faint">Elimina todos los registros. No se puede deshacer.</p>
            </div>
            {confirmClear ? (
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    clearHistory();
                    setConfirmClear(false);
                  }}
                >
                  Confirmar
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="danger" className="shrink-0" onClick={() => setConfirmClear(true)}>
                Borrar
              </Button>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 px-3 py-2.5">
      <p className="text-[0.625rem] font-medium uppercase tracking-[0.12em] text-faint">{label}</p>
      {/* Cifras proporcionales, no tabulares: en un valor grande y aislado el
          ancho fijo del 0 hace que el número se vea suelto. */}
      <p className="mt-1 text-lg font-semibold leading-none text-ink">{value}</p>
      {hint && <p className="mt-1 text-[0.625rem] leading-tight text-faint">{hint}</p>}
    </div>
  );
}

/**
 * Reparto de foco.
 *
 * Todas las barras van del mismo color. Teñir cada una según su valor duplicaría
 * en el tono lo que el largo ya dice, y estas categorías —tipos de sesión,
 * presets— no tienen orden natural que justifique una rampa.
 */
function Distribution({ title, slices }: { title: string; slices: DistributionSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.focusedMs, 0);

  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">{title}</h3>

      {slices.length === 0 ? (
        <p className="text-xs text-faint">Sin datos en este período.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {slices.map((slice) => {
            const share = total > 0 ? slice.focusedMs / total : 0;
            return (
              <li key={slice.key} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate text-muted" title={slice.label}>
                    {slice.label}
                  </span>
                  <span className="tabular shrink-0 text-ink">{formatDurationLabel(slice.focusedMs)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--c-accent-soft)]">
                  <div
                    className={cn('h-full rounded-full transition-[width] duration-500')}
                    style={{ width: `${Math.max(share * 100, 1.5)}%`, background: 'var(--c-accent)' }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
