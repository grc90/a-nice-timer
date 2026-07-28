import { create } from 'zustand';

export type OverlayId = 'settings' | 'shortcuts' | 'stats' | 'auth' | 'share' | null;

interface UiState {
  /** Modo concentración: la UI desaparece salvo el timer. */
  focusMode: boolean;
  /** Modal abierto. Sólo uno a la vez, y por eso Escape tiene una regla única. */
  overlay: OverlayId;
  /** Cajón de audio. No es un modal: se deja abierto mientras se trabaja. */
  audioPanelOpen: boolean;

  setFocusMode: (value: boolean) => void;
  toggleFocusMode: () => void;
  openOverlay: (id: Exclude<OverlayId, null>) => void;
  closeOverlay: () => void;
  setAudioPanelOpen: (value: boolean) => void;
  toggleAudioPanel: () => void;
  /** Escape: cierra lo más superficial que esté abierto, de a una capa por vez. */
  escape: () => void;
}

/**
 * Estado de interfaz efímero. No se persiste a propósito: abrir la app en
 * pantalla completa con un modal abierto porque así quedó la última vez sería
 * desconcertante.
 */
export const useUiStore = create<UiState>()((set, get) => ({
  focusMode: false,
  overlay: null,
  audioPanelOpen: false,

  setFocusMode: (focusMode) => set({ focusMode }),
  toggleFocusMode: () => set({ focusMode: !get().focusMode }),
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: null }),
  setAudioPanelOpen: (audioPanelOpen) => set({ audioPanelOpen }),
  toggleAudioPanel: () => set({ audioPanelOpen: !get().audioPanelOpen }),

  // Una capa por pulsación, de la más superficial a la más profunda. Salir del
  // modo concentración de golpe porque había un modal encima sería perder dos
  // cosas con una tecla.
  escape: () => {
    const { overlay, audioPanelOpen, focusMode } = get();
    if (overlay !== null) set({ overlay: null });
    else if (audioPanelOpen) set({ audioPanelOpen: false });
    else if (focusMode) set({ focusMode: false });
  },
}));
