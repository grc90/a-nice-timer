import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { useMediaQuery } from './useMediaQuery';

/**
 * Aplica el tema resuelto y la paleta a <html>.
 *
 * Escribir en `dataset` en vez de manejar clases mantiene el CSS declarativo:
 * los selectores de theme.css son `[data-palette][data-theme]` y no hay que
 * tocar ningún componente para agregar una paleta.
 */
export function useTheme(): 'light' | 'dark' {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const palette = useSettingsStore((s) => s.palette);
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const resolved: 'light' | 'dark' = themeMode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themeMode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.palette = palette;

    // Tiñe la barra de estado del navegador en mobile para que no corte el fondo.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) {
      meta.content = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim() || '#0b0c0f';
    }
  }, [resolved, palette]);

  return resolved;
}
