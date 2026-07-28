import { useEffect } from 'react';
import { isCloudConfigured } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { usePresetsStore } from '@/store/presetsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useStatsStore } from '@/store/statsStore';
import { useAudioStore } from '@/store/audioStore';
import { cancelScheduledPush, runFullSync, schedulePush } from '@/sync/syncEngine';

/**
 * Conecta los stores locales con la nube mientras haya sesión.
 *
 * Se monta una vez en la raíz. Sin sesión —o sin Supabase configurado— no hace
 * absolutamente nada, y la app queda en modo invitado puro.
 */
export function useCloudSync(): void {
  const status = useAuthStore((s) => s.status);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // Sincronización completa al iniciar sesión y al volver de estar offline.
  useEffect(() => {
    if (!isCloudConfigured || status !== 'authenticated' || !userId) return;

    void runFullSync(userId);

    const onOnline = () => void runFullSync(userId);
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [status, userId]);

  // Subida con debounce ante cualquier cambio local.
  useEffect(() => {
    if (!isCloudConfigured || status !== 'authenticated' || !userId) return;

    // Una suscripción por store en vez de comparar campos: cualquier cambio en
    // los datos sincronizables merece una subida, y el debounce del motor se
    // encarga de que una ráfaga de ediciones no produzca una ráfaga de requests.
    const unsubscribes = [
      usePresetsStore.subscribe(() => schedulePush(userId)),
      useSettingsStore.subscribe(() => schedulePush(userId)),
      useStatsStore.subscribe(() => schedulePush(userId)),
      useAudioStore.subscribe(() => schedulePush(userId)),
    ];

    return () => {
      cancelScheduledPush();
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [status, userId]);

  // Última subida al ocultar la pestaña, para no perder los cambios que quedaron
  // dentro de la ventana del debounce si el usuario cierra el navegador.
  useEffect(() => {
    if (!isCloudConfigured || status !== 'authenticated' || !userId) return;

    const onHide = () => {
      if (document.visibilityState === 'hidden') schedulePush(userId);
    };

    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [status, userId]);
}

/** Arranca la escucha de sesión de Supabase. Se monta una vez en la raíz. */
export function useAuthListener(): void {
  const init = useAuthStore((s) => s.init);
  useEffect(() => init(), [init]);
}
