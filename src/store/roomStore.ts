import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ShareStatus = 'off' | 'starting' | 'live' | 'error';

interface RoomState {
  /**
   * Id de la sala del host. Se persiste para que recargar la página no invalide
   * un link que ya se compartió: la sala se retoma con el mismo id.
   */
  roomId: string | null;
  status: ShareStatus;
  error: string | null;
  /** Espectadores conectados, vía presencia de Realtime. */
  viewers: number;

  setRoomId: (id: string | null) => void;
  setStatus: (status: ShareStatus, error?: string | null) => void;
  setViewers: (count: number) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>()(
  persist(
    (set) => ({
      roomId: null,
      status: 'off',
      error: null,
      viewers: 0,

      setRoomId: (roomId) => set({ roomId }),
      setStatus: (status, error = null) => set({ status, error }),
      setViewers: (viewers) => set({ viewers }),
      reset: () => set({ status: 'off', error: null, viewers: 0 }),
    }),
    {
      name: 'ant:room',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Sólo el id sobrevive a la recarga. `status` y `viewers` describen una
      // conexión viva: rehidratarlos mostraría "en vivo" sobre un canal cerrado.
      partialize: (state) => ({ roomId: state.roomId }),
    },
  ),
);

/** URL para compartir. */
export function roomUrl(roomId: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
}

/** Lee el id de sala de la URL actual, si la hay. */
export function roomIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get('room');
  if (!id) return null;
  // Validar el formato antes de usarlo evita mandar basura a Postgres, que
  // rechazaría el uuid con un error crudo en vez de un mensaje entendible.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}
