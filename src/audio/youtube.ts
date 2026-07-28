/**
 * Integración con la IFrame Player API de YouTube.
 *
 * Se declaran sólo los tipos que usamos en vez de traer `@types/youtube`: son
 * ocho métodos, y la dependencia completa describe una superficie enorme que no
 * tocamos.
 */

export interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  nextVideo: () => void;
  previousVideo: () => void;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  loadPlaylist: (options: { list: string; listType: string }) => void;
  getVideoData: () => { title?: string; video_id?: string };
  getPlayerState: () => number;
  destroy: () => void;
}

/** Estados que devuelve `getPlayerState`. */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

interface YouTubeApi {
  Player: new (
    element: HTMLElement | string,
    options: {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeApi> | null = null;

/**
 * Carga el script de la IFrame API una sola vez.
 *
 * La API avisa que está lista llamando a un callback global, no con un evento
 * `load`: el script existe antes de que `window.YT.Player` sea usable. La
 * promesa cacheada evita inyectar el script dos veces si el panel se abre y
 * cierra, lo que dejaría a `onYouTubeIframeAPIReady` pisado.
 */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }

    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      if (window.YT) resolve(window.YT);
      else reject(new Error('La API de YouTube cargó sin exponer YT.Player'));
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('No se pudo cargar la API de YouTube'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

export interface ParsedYouTubeLink {
  videoId: string | null;
  playlistId: string | null;
}

/**
 * Extrae ids de video y de lista de una URL de YouTube.
 *
 * Acepta las formas que la gente realmente pega: `watch?v=`, `youtu.be/`,
 * `/embed/`, `/shorts/`, `/live/`, `/playlist?list=`, y también un id pelado.
 * Devuelve ambos campos porque un link de video dentro de una playlist trae los
 * dos, y ahí conviene reproducir la lista entera empezando por ese video.
 */
export function parseYouTubeLink(input: string): ParsedYouTubeLink | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Un id de video pelado: 11 caracteres del alfabeto base64url.
  if (/^[\w-]{11}$/.test(trimmed)) return { videoId: trimmed, playlistId: null };

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  if (!/^(youtube\.com|m\.youtube\.com|music\.youtube\.com|youtu\.be)$/.test(host)) return null;

  const playlistId = url.searchParams.get('list');
  let videoId = url.searchParams.get('v');

  if (!videoId) {
    if (host === 'youtu.be') {
      videoId = url.pathname.slice(1);
    } else {
      const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/);
      videoId = match?.[1] ?? null;
    }
  }

  if (videoId && !/^[\w-]{11}$/.test(videoId)) videoId = null;
  if (!videoId && !playlistId) return null;

  return { videoId, playlistId };
}

/** Miniatura sin llamar a la API de datos: la sirve el CDN de imágenes. */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}
