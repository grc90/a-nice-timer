import { useState } from 'react';
import { isCloudConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useRoomStore, roomUrl } from '@/store/roomStore';
import { useUiStore } from '@/store/uiStore';
import { useRoomHost } from '@/hooks/useRoomHost';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CheckIcon, CopyIcon } from '@/components/ui/Icons';

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const authStatus = useAuthStore((s) => s.status);
  const roomId = useRoomStore((s) => s.roomId);
  const status = useRoomStore((s) => s.status);
  const error = useRoomStore((s) => s.error);
  const viewers = useRoomStore((s) => s.viewers);
  const openOverlay = useUiStore((s) => s.openOverlay);

  const { startSharing, stopSharing } = useRoomHost();
  const [copied, setCopied] = useState(false);

  const url = roomId && status === 'live' ? roomUrl(roomId) : null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles el input sigue siendo seleccionable a mano.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compartir la sesión"
      description="Para trabajar acompañado: quien entre con el link ve tu timer en vivo, sin cuenta."
      size="sm"
    >
      {!isCloudConfigured ? (
        <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-faint">
          Compartir necesita la nube configurada.
        </p>
      ) : authStatus !== 'authenticated' ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Para compartir una sesión necesitás una cuenta. Quien la mire, no.
          </p>
          <Button variant="primary" onClick={() => openOverlay('auth')}>
            Entrar o crear cuenta
          </Button>
        </div>
      ) : status === 'live' && url ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-medium text-muted">Link de la sala</span>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                onFocus={(event) => event.currentTarget.select()}
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 font-mono text-xs text-ink focus:border-accent focus:outline-none"
              />
              <Button variant="secondary" onClick={() => void copy()} icon={copied ? <CheckIcon /> : <CopyIcon />}>
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
            <div className="flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-accent" />
              <span className="text-sm text-ink">En vivo</span>
            </div>
            <span className="text-xs text-muted">
              {viewers === 0
                ? 'Nadie mirando todavía'
                : `${viewers} ${viewers === 1 ? 'persona' : 'personas'} mirando`}
            </span>
          </div>

          <p className="text-xs text-faint">
            Se comparte la fase, el tiempo restante y el nombre de la sesión. Nada de tus estadísticas, presets ni
            ajustes.
          </p>

          <Button variant="danger" onClick={() => void stopSharing()}>
            Dejar de compartir
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Genera un link único con tu timer en tiempo real. Quien lo abra ve la fase y el tiempo restante, y no puede
            controlar nada.
          </p>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          <Button variant="primary" onClick={() => void startSharing()} disabled={status === 'starting'}>
            {status === 'starting' ? 'Abriendo la sala…' : 'Crear link para compartir'}
          </Button>
        </div>
      )}
    </Modal>
  );
}
