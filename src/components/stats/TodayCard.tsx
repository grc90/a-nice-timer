import { computeStreak, dayTotal, useStatsStore } from '@/store/statsStore';
import { useUiStore } from '@/store/uiStore';
import { GoalMeter } from './GoalMeter';
import { dayKey, formatDurationLabel } from '@/utils/time';

/**
 * Resumen del día en la pantalla principal.
 *
 * El progreso hacia la meta tiene que estar acá y no sólo en el panel de
 * estadísticas: una meta que hay que ir a buscar a otra pantalla no influye en lo
 * que hacés ahora, que es justo para lo que sirve una meta.
 */
export function TodayCard() {
  const daily = useStatsStore((s) => s.daily);
  const goals = useStatsStore((s) => s.goals);
  const openOverlay = useUiStore((s) => s.openOverlay);

  const today = dayTotal(daily, dayKey());
  const streak = computeStreak(daily);
  const hasGoal = goals.dailyFocusMs > 0;

  return (
    <section className="flex flex-col gap-3" aria-label="Resumen de hoy">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight text-ink">Hoy</h2>
        <button
          type="button"
          onClick={() => openOverlay('stats')}
          className="-mr-2 rounded-lg px-2 py-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink sm:-mr-0 sm:py-1"
        >
          Ver estadísticas
        </button>
      </header>

      <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
        {hasGoal ? (
          <GoalMeter currentMs={today.focusedMs} goalMs={goals.dailyFocusMs} label="Meta de hoy" size={64} />
        ) : (
          <div>
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-faint">Foco de hoy</p>
            <p className="mt-1 text-xl font-semibold leading-none text-ink">
              {formatDurationLabel(today.focusedMs)}
            </p>
          </div>
        )}

        <dl className="mt-3.5 flex items-center gap-5 border-t border-line pt-3 text-xs">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-faint">Racha</dt>
            <dd className="font-medium text-ink">
              {streak.current} d
              {/* Un punto sólo cuando hoy ya suma: distingue la racha extendida
                  de la que sigue viva pero pendiente. */}
              {streak.activeToday && <span className="ml-1 inline-block size-1.5 rounded-full bg-accent align-middle" />}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-faint">Pomodoros</dt>
            <dd className="font-medium text-ink">{today.pomodoros}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
