import { useCallback, useEffect, useRef, useState } from 'react';
import { useAudioStore, makeLink, type SavedLink } from '@/store/audioStore';
import { loadYouTubeApi, parseYouTubeLink, YT_STATE, type YouTubePlayer } from '@/audio/youtube';
import { Button, IconButton } from '@/components/ui/Button';
import { Slider, TextInput } from '@/components/ui/Field';
import { PauseIcon, PlayIcon, SkipIcon, StarIcon, TrashIcon } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';

interface YouTubePanelProps {
  /** Difiere la carga del script de YouTube hasta el primer uso real del panel. */
  enabled: boolean;
}

export function YouTubePanel({ enabled }: YouTubePanelProps) {
  const currentLink = useAudioStore((s) => s.currentLink);
  const favorites = useAudioStore((s) => s.favorites);
  const recents = useAudioStore((s) => s.recents);
  const volume = useAudioStore((s) => s.youtubeVolume);

  const setCurrentLink = useAudioStore((s) => s.setCurrentLink);
  const setYoutubeVolume = useAudioStore((s) => s.setYoutubeVolume);
  const resolveTitle = useAudioStore((s) => s.resolveTitle);
  const pushRecent = useAudioStore((s) => s.pushRecent);
  const toggleFavorite = useAudioStore((s) => s.toggleFavorite);
  const removeFavorite = useAudioStore((s) => s.removeFavorite);

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  // El link que hay que cargar cuando el reproductor termine de inicializar.
  const pendingRef = useRef<SavedLink | null>(null);

  const loadIntoPlayer = useCallback(
    (player: YouTubePlayer, link: SavedLink) => {
      // Un link con lista y video a la vez reproduce la lista entera: es lo que
      // espera alguien que pegó un track dentro de una playlist de estudio.
      if (link.playlistId) player.loadPlaylist({ list: link.playlistId, listType: 'playlist' });
      else if (link.videoId) player.loadVideoById(link.videoId);

      // El título recién existe cuando el reproductor bajó los metadatos.
      window.setTimeout(() => {
        const title = player.getVideoData?.().title;
        if (title) resolveTitle(link.url, title);
      }, 1200);
    },
    [resolveTitle],
  );

  // El reproductor se crea una sola vez y vive mientras el panel esté montado.
  // `enabled` difiere la carga del script de YouTube hasta que el usuario abre
  // el panel: son ~100 kB de terceros que no tiene sentido bajar en cada visita
  // para una función que puede no usarse nunca.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    loadYouTubeApi()
      .then((api) => {
        if (cancelled || !mountRef.current) return;

        // YouTube **reemplaza** el elemento que recibe por un iframe. Si le
        // pasáramos un nodo renderizado por React, al desmontar el componente
        // React intentaría quitar un hijo que ya no existe y tiraría
        // `removeChild`. Este host lo crea el DOM a mano, así React nunca lo ve.
        const host = document.createElement('div');
        host.style.width = '100%';
        host.style.height = '100%';
        mountRef.current.appendChild(host);

        playerRef.current = new api.Player(host, {
          height: '100%',
          width: '100%',
          playerVars: {
            // `playsinline` es lo que evita que iOS abra el video a pantalla
            // completa y saque al usuario de la app en medio de una sesión.
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setReady(true);
              event.target.setVolume(Math.round(useAudioStore.getState().youtubeVolume * 100));
              const pending = pendingRef.current ?? useAudioStore.getState().currentLink;
              if (pending) loadIntoPlayer(event.target, pending);
              pendingRef.current = null;
            },
            onStateChange: (event) => {
              if (cancelled) return;
              setPlaying(event.data === YT_STATE.PLAYING);
              if (event.data === YT_STATE.PLAYING) {
                const title = event.target.getVideoData?.().title;
                const link = useAudioStore.getState().currentLink;
                if (title && link) resolveTitle(link.url, title);
              }
            },
            onError: () => setError('YouTube no pudo reproducir ese link.'),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setApiFailed(true);
      });

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      // El iframe que dejó YouTube no lo conoce React: hay que barrerlo a mano.
      if (mountRef.current) mountRef.current.textContent = '';
    };
  }, [enabled, loadIntoPlayer, resolveTitle]);

  // El volumen del store manda sobre el del reproductor.
  useEffect(() => {
    playerRef.current?.setVolume(Math.round(volume * 100));
  }, [volume, ready]);

  const play = (link: SavedLink) => {
    setError(null);
    setCurrentLink(link);
    pushRecent(link);

    const player = playerRef.current;
    if (player && ready) loadIntoPlayer(player, link);
    else pendingRef.current = link;
  };

  const handleSubmit = () => {
    const parsed = parseYouTubeLink(input);
    if (!parsed) {
      setError('No reconozco ese link. Pegá una URL de video o de playlist de YouTube.');
      return;
    }
    play(makeLink(input.trim(), parsed.videoId, parsed.playlistId));
    setInput('');
  };

  const isFavorite = currentLink ? favorites.some((f) => f.url === currentLink.url) : false;

  if (apiFailed) {
    return (
      <section className="flex flex-col gap-3" aria-label="YouTube">
        <SectionHeader>YouTube</SectionHeader>
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-xs text-faint">
          No se pudo cargar el reproductor de YouTube. Puede ser falta de conexión o un bloqueador. Los sonidos
          ambiente siguen funcionando sin internet.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3" aria-label="YouTube">
      <SectionHeader>YouTube</SectionHeader>

      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <TextInput
            value={input}
            onChange={(v) => {
              setInput(v);
              setError(null);
            }}
            placeholder="Pegá un link de video o playlist"
          />
        </div>
        <Button variant="secondary" onClick={handleSubmit} disabled={!input.trim()}>
          Cargar
        </Button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      {/* El iframe queda visible pero chico: además de dar contexto de qué suena,
          YouTube penaliza a los reproductores ocultos y puede negarse a
          reproducir. */}
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-line bg-black/80 transition-all duration-300',
          currentLink ? 'aspect-video' : 'h-0 border-0',
        )}
      >
        <div ref={mountRef} className="size-full" />
      </div>

      {currentLink && (
        <>
          <p className="truncate text-xs text-muted" title={currentLink.title}>
            {currentLink.title}
          </p>

          <div className="flex items-center gap-1.5">
            <IconButton
              label={playing ? 'Pausar' : 'Reproducir'}
              variant="secondary"
              size="sm"
              onClick={() => (playing ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo())}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </IconButton>

            <IconButton
              label="Siguiente de la lista"
              size="sm"
              onClick={() => playerRef.current?.nextVideo()}
              disabled={!currentLink.playlistId}
            >
              <SkipIcon />
            </IconButton>

            <IconButton
              label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              size="sm"
              active={isFavorite}
              onClick={() => toggleFavorite(currentLink)}
            >
              <StarIcon filled={isFavorite} />
            </IconButton>

            <div className="ml-1 flex min-w-0 flex-1 items-center gap-2">
              <Slider label="Volumen de YouTube" value={volume} onChange={setYoutubeVolume} />
              <span className="tabular w-8 shrink-0 text-right text-[0.6875rem] text-faint">
                {Math.round(volume * 100)}
              </span>
            </div>
          </div>
        </>
      )}

      <LinkList
        title="Favoritos"
        links={favorites}
        currentUrl={currentLink?.url}
        onPlay={play}
        onRemove={removeFavorite}
        emptyHint="Guardá un link con la estrella para tenerlo a mano."
      />

      {recents.length > 0 && (
        <LinkList title="Recientes" links={recents} currentUrl={currentLink?.url} onPlay={play} />
      )}
    </section>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">{children}</h3>;
}

interface LinkListProps {
  title: string;
  links: SavedLink[];
  currentUrl: string | undefined;
  onPlay: (link: SavedLink) => void;
  onRemove?: (id: string) => void;
  emptyHint?: string;
}

function LinkList({ title, links, currentUrl, onPlay, onRemove, emptyHint }: LinkListProps) {
  if (links.length === 0 && !emptyHint) return null;

  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <h4 className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-faint">{title}</h4>

      {links.length === 0 ? (
        <p className="text-xs text-faint">{emptyHint}</p>
      ) : (
        <ul className="flex flex-col">
          {links.map((link) => (
            <li key={link.id} className="group flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPlay(link)}
                className={cn(
                  'min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                  link.url === currentUrl ? 'text-accent' : 'text-muted hover:bg-surface-2 hover:text-ink',
                )}
                title={link.title}
              >
                {link.title}
              </button>
              {onRemove && (
                <IconButton
                  label={`Quitar ${link.title}`}
                  size="sm"
                  className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  onClick={() => onRemove(link.id)}
                >
                  <TrashIcon />
                </IconButton>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
