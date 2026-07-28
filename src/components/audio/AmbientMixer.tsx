import { useAudioStore, DEFAULT_CHANNEL_VOLUME } from '@/store/audioStore';
import { AMBIENTS } from '@/audio/ambient';
import { unlockAudio } from '@/audio/context';
import { Slider } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { MuteIcon, VolumeIcon } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';

/**
 * Mezclador de sonidos ambiente.
 *
 * Cada canal tiene su propio fader y se pueden combinar todos a la vez — lluvia
 * con fuego, olas con café. Por eso es un mezclador y no una lista de opciones
 * excluyentes: la combinación es el producto.
 */
export function AmbientMixer() {
  const mix = useAudioStore((s) => s.mix);
  const master = useAudioStore((s) => s.ambientMaster);
  const muted = useAudioStore((s) => s.ambientMuted);

  const setChannelVolume = useAudioStore((s) => s.setChannelVolume);
  const setAmbientMaster = useAudioStore((s) => s.setAmbientMaster);
  const setAmbientMuted = useAudioStore((s) => s.setAmbientMuted);
  const clearMix = useAudioStore((s) => s.clearMix);

  const activeCount = AMBIENTS.filter((a) => mix[a.id] > 0).length;

  const handleChannel = (id: (typeof AMBIENTS)[number]['id'], volume: number) => {
    // Cualquier interacción con un fader es un gesto válido para desbloquear el
    // contexto de audio, que puede seguir suspendido si el usuario abrió el
    // panel antes de iniciar el timer.
    void unlockAudio();
    if (muted && volume > 0) setAmbientMuted(false);
    setChannelVolume(id, volume);
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Sonidos ambiente">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">Ambiente</h3>
          {activeCount > 0 && (
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-medium text-accent">
              {activeCount}
            </span>
          )}
        </div>

        {activeCount > 0 && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                void unlockAudio();
                setAmbientMuted(!muted);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              aria-pressed={muted}
            >
              {muted ? <MuteIcon /> : <VolumeIcon />}
              {muted ? 'Reanudar' : 'Silenciar'}
            </button>
            <Button size="sm" variant="ghost" onClick={clearMix}>
              Limpiar
            </Button>
          </div>
        )}
      </header>

      <ul className="flex flex-col gap-1">
        {AMBIENTS.map((ambient) => {
          const volume = mix[ambient.id];
          const active = volume > 0;

          return (
            <li key={ambient.id} className={cn('rounded-xl px-2 py-2 transition-colors', active && 'bg-surface-2/60')}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleChannel(ambient.id, active ? 0 : DEFAULT_CHANNEL_VOLUME)}
                  aria-pressed={active}
                  title={ambient.description}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-2.5 text-left transition-opacity',
                    !active && 'opacity-65 hover:opacity-100',
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full transition-colors',
                      active && !muted ? 'bg-accent' : 'bg-[var(--c-border)]',
                    )}
                  />
                  <span className="truncate text-sm text-ink">{ambient.name}</span>
                </button>

                <span className="tabular w-9 shrink-0 text-right text-[0.6875rem] text-faint">
                  {active ? `${Math.round(volume * 100)}` : '—'}
                </span>
              </div>

              {active && (
                <div className="anim-fade-in mt-2 pl-4 pr-1">
                  <Slider
                    label={`Volumen de ${ambient.name}`}
                    value={volume}
                    onChange={(v) => handleChannel(ambient.id, v)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <span className="w-16 shrink-0 text-xs text-muted">General</span>
        <Slider label="Volumen general del ambiente" value={master} onChange={setAmbientMaster} />
        <span className="tabular w-9 shrink-0 text-right text-[0.6875rem] text-faint">
          {Math.round(master * 100)}
        </span>
      </div>
    </section>
  );
}
