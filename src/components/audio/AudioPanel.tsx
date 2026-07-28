import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useAudioStore } from '@/store/audioStore';
import { AmbientMixer } from './AmbientMixer';
import { YouTubePanel } from './YouTubePanel';
import { IconButton } from '@/components/ui/Button';
import { CloseIcon } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';

/**
 * Panel de audio.
 *
 * Convive con el timer en lugar de reemplazarlo: en desktop entra como cajón
 * lateral y en mobile como bottom sheet, pero en ningún caso tapa el reloj ni
 * corta la sesión. Ambiente y YouTube viven en el mismo panel porque la
 * decisión del usuario no es "cuál de los dos" sino "cómo los mezclo".
 *
 * No usa `Modal`: un modal bloquea el scroll del fondo y atrapa el foco, y este
 * panel está pensado para dejarse abierto mientras se trabaja.
 */
export function AudioPanel() {
  const open = useUiStore((s) => s.audioPanelOpen);
  const setOpen = useUiStore((s) => s.setAudioPanelOpen);

  const mix = useAudioStore((s) => s.mix);
  const currentLink = useAudioStore((s) => s.currentLink);

  const activeAmbients = Object.values(mix).filter((v) => v > 0).length;

  // El panel nunca se desmonta —cerrarlo no debe cortar lo que está sonando—,
  // pero el reproductor de YouTube sí espera a la primera apertura para no
  // bajar su script en visitas donde nadie lo usa.
  const [youtubeArmed, setYoutubeArmed] = useState(false);
  useEffect(() => {
    if (open) setYoutubeArmed(true);
  }, [open]);

  return (
    <>
      {/* Telón sólo en mobile: en desktop el panel es un cajón y la app sigue
          siendo usable con él abierto. */}
      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] anim-fade-in md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Cerrar el panel de audio"
          tabIndex={-1}
        />
      )}

      <aside
        aria-label="Panel de audio"
        inert={!open}
        className={cn(
          'fixed z-40 flex flex-col border-line bg-surface shadow-[var(--shadow-lift)]',
          'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          // Mobile: bottom sheet.
          'inset-x-0 bottom-0 max-h-[82dvh] rounded-t-3xl border-t',
          open ? 'translate-y-0' : 'translate-y-full',
          // Desktop: cajón lateral de altura completa.
          'md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:w-[22rem] md:rounded-none md:rounded-l-3xl md:border-l md:border-t-0',
          open ? 'md:translate-x-0' : 'md:translate-x-full md:translate-y-0',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-medium tracking-tight text-ink">Audio</h2>
            <p className="mt-0.5 truncate text-xs text-faint">
              {activeAmbients === 0 && !currentLink
                ? 'Nada sonando'
                : [
                    activeAmbients > 0 && `${activeAmbients} ambiente${activeAmbients === 1 ? '' : 's'}`,
                    currentLink && 'YouTube',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
          </div>
          <IconButton label="Cerrar el panel de audio" size="sm" onClick={() => setOpen(false)}>
            <CloseIcon />
          </IconButton>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-7 overflow-y-auto px-5 py-5 safe-bottom">
          <AmbientMixer />
          <div className="border-t border-line pt-6">
            <YouTubePanel enabled={youtubeArmed} />
          </div>
        </div>
      </aside>
    </>
  );
}
