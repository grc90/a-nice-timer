import { useEffect, useRef, useState } from 'react';
import { isCloudConfigured } from '@/lib/supabase';
import { displayName, useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { runFullSync } from '@/sync/syncEngine';
import { Button, IconButton, TOUCH_BUTTON, TOUCH_ICON } from '@/components/ui/Button';
import { UserIcon } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';

function relativeTime(timestamp: number): string {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 45) return 'recién';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.round(minutes / 60)} h`;
}

const SYNC_COPY = {
  idle: 'Al día',
  syncing: 'Sincronizando…',
  error: 'No se pudo sincronizar',
  offline: 'Sin conexión',
} as const;

/**
 * Estado de la cuenta en la barra superior.
 *
 * Si Supabase no está configurado no se renderiza nada: mostrar un botón de
 * cuenta que no puede funcionar sería peor que no ofrecerlo.
 */
export function AccountMenu() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const syncStatus = useAuthStore((s) => s.syncStatus);
  const syncError = useAuthStore((s) => s.syncError);
  const lastSyncedAt = useAuthStore((s) => s.lastSyncedAt);
  const signOut = useAuthStore((s) => s.signOut);
  const openOverlay = useUiStore((s) => s.openOverlay);

  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cierra al hacer click afuera. En `pointerdown` y no en `click`: si esperara
  // al click, un botón de abajo recibiría el evento antes de que el menú cierre.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [menuOpen]);

  if (!isCloudConfigured) return null;

  if (status !== 'authenticated') {
    return (
      <Button
        variant="secondary"
        className={`ml-1 ${TOUCH_BUTTON}`}
        onClick={() => openOverlay('auth')}
        disabled={status === 'loading'}
      >
        Entrar
      </Button>
    );
  }

  return (
    <div ref={containerRef} className="relative ml-0.5">
      <IconButton
        label={`Cuenta de ${displayName(user)}`}
        active={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className={`relative ${TOUCH_ICON}`}
      >
        <UserIcon />
        <span
          className={cn('absolute right-1 top-1 size-1.5 rounded-full transition-colors', {
            'bg-accent': syncStatus === 'syncing',
            'bg-danger': syncStatus === 'error',
            'bg-[var(--c-text-faint)]': syncStatus === 'offline',
            'opacity-0': syncStatus === 'idle',
          })}
        />
      </IconButton>

      {menuOpen && (
        <div className="anim-scale-in absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-2xl border border-line bg-surface p-3 shadow-[var(--shadow-lift)]">
          <p className="truncate text-sm font-medium text-ink">{displayName(user)}</p>
          <p className="mt-0.5 truncate text-xs text-faint">{user?.email}</p>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-xs text-muted">{SYNC_COPY[syncStatus]}</span>
            {syncStatus === 'idle' && lastSyncedAt && (
              <span className="text-[0.6875rem] text-faint">{relativeTime(lastSyncedAt)}</span>
            )}
          </div>

          {syncStatus === 'error' && syncError && (
            <p className="mt-1.5 break-words text-[0.6875rem] leading-tight text-danger">{syncError}</p>
          )}

          <div className="mt-3 flex flex-col gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={syncStatus === 'syncing' || !user}
              onClick={() => user && void runFullSync(user.id)}
            >
              Sincronizar ahora
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setMenuOpen(false);
                void signOut();
              }}
            >
              Cerrar sesión
            </Button>
          </div>

          <p className="mt-2 text-[0.6875rem] leading-tight text-faint">
            Al cerrar sesión tus datos quedan en este navegador.
          </p>
        </div>
      )}
    </div>
  );
}
