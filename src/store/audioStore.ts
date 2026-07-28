import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AMBIENT_IDS, type AmbientId } from '@/audio/ambient';
import { createId } from '@/utils/id';

export interface SavedLink {
  id: string;
  url: string;
  /** Título resuelto por el reproductor, o la URL si todavía no cargó. */
  title: string;
  videoId: string | null;
  playlistId: string | null;
}

export interface RecentLink extends SavedLink {
  playedAt: number;
}

const MAX_RECENTS = 8;

type AmbientMix = Record<AmbientId, number>;

function emptyMix(): AmbientMix {
  return Object.fromEntries(AMBIENT_IDS.map((id) => [id, 0])) as AmbientMix;
}

interface AudioState {
  /** Volumen general de los sonidos ambiente. No afecta a YouTube ni a la alarma. */
  ambientMaster: number;
  /** Volumen por sonido, 0..1. Un 0 significa apagado. */
  mix: AmbientMix;
  /** Silencio temporal que conserva la mezcla para poder restaurarla igual. */
  ambientMuted: boolean;

  youtubeVolume: number;
  /** Link cargado en el reproductor. */
  currentLink: SavedLink | null;
  favorites: SavedLink[];
  recents: RecentLink[];

  setAmbientMaster: (volume: number) => void;
  setChannelVolume: (id: AmbientId, volume: number) => void;
  toggleChannel: (id: AmbientId) => void;
  setAmbientMuted: (muted: boolean) => void;
  clearMix: () => void;

  setYoutubeVolume: (volume: number) => void;
  setCurrentLink: (link: SavedLink | null) => void;
  /** Completa el título una vez que el reproductor lo resuelve. */
  resolveTitle: (url: string, title: string) => void;
  pushRecent: (link: SavedLink) => void;
  toggleFavorite: (link: SavedLink) => void;
  removeFavorite: (id: string) => void;
}

/** Volumen inicial de un canal al encenderlo desde apagado. */
export const DEFAULT_CHANNEL_VOLUME = 0.5;

export function makeLink(url: string, videoId: string | null, playlistId: string | null, title?: string): SavedLink {
  return { id: createId(), url, title: title ?? url, videoId, playlistId };
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set, get) => ({
      ambientMaster: 0.7,
      mix: emptyMix(),
      ambientMuted: false,

      youtubeVolume: 0.6,
      currentLink: null,
      favorites: [],
      recents: [],

      setAmbientMaster: (volume) => set({ ambientMaster: Math.min(1, Math.max(0, volume)) }),

      setChannelVolume: (id, volume) =>
        set((state) => ({ mix: { ...state.mix, [id]: Math.min(1, Math.max(0, volume)) } })),

      toggleChannel: (id) =>
        set((state) => ({
          mix: { ...state.mix, [id]: state.mix[id] > 0 ? 0 : DEFAULT_CHANNEL_VOLUME },
        })),

      setAmbientMuted: (ambientMuted) => set({ ambientMuted }),
      clearMix: () => set({ mix: emptyMix() }),

      setYoutubeVolume: (volume) => set({ youtubeVolume: Math.min(1, Math.max(0, volume)) }),
      setCurrentLink: (currentLink) => set({ currentLink }),

      resolveTitle: (url, title) =>
        set((state) => ({
          // El título llega asincrónico desde el reproductor, así que se aplica
          // en los tres lugares donde ese link puede estar guardado.
          currentLink: state.currentLink?.url === url ? { ...state.currentLink, title } : state.currentLink,
          favorites: state.favorites.map((f) => (f.url === url ? { ...f, title } : f)),
          recents: state.recents.map((r) => (r.url === url ? { ...r, title } : r)),
        })),

      pushRecent: (link) =>
        set((state) => ({
          recents: [
            { ...link, playedAt: Date.now() },
            ...state.recents.filter((r) => r.url !== link.url),
          ].slice(0, MAX_RECENTS),
        })),

      toggleFavorite: (link) => {
        const existing = get().favorites.find((f) => f.url === link.url);
        if (existing) {
          set((state) => ({ favorites: state.favorites.filter((f) => f.id !== existing.id) }));
          return;
        }
        set((state) => ({ favorites: [...state.favorites, { ...link, id: createId() }] }));
      },

      removeFavorite: (id) => set((state) => ({ favorites: state.favorites.filter((f) => f.id !== id) })),
    }),
    {
      name: 'ant:audio',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      merge: (persisted, current) => {
        // Una mezcla guardada de una versión con menos ambientes dejaría canales
        // sin clave y el mixer los leería como undefined.
        const saved = persisted as Partial<AudioState> | undefined;
        return {
          ...current,
          ...saved,
          mix: { ...emptyMix(), ...(saved?.mix ?? {}) },
        };
      },
    },
  ),
);
