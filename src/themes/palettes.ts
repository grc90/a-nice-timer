import type { PaletteId, PaletteMeta } from '@/types';

/**
 * Catálogo de paletas para el selector.
 *
 * Los colores reales viven en `theme.css`; esto es sólo metadata de UI. Agregar
 * una paleta = un bloque en theme.css + una entrada acá + el id en el tipo
 * `PaletteId`. Ningún componente necesita cambiar.
 */
export const PALETTES: readonly PaletteMeta[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    swatch: { light: 'oklch(0.52 0.13 250)', dark: 'oklch(0.72 0.1 245)' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    swatch: { light: 'oklch(0.62 0.17 40)', dark: 'oklch(0.75 0.16 45)' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    swatch: { light: 'oklch(0.55 0.13 215)', dark: 'oklch(0.76 0.12 205)' },
  },
  {
    id: 'forest',
    name: 'Forest',
    swatch: { light: 'oklch(0.5 0.12 150)', dark: 'oklch(0.74 0.13 148)' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    swatch: { light: 'oklch(0.52 0.17 288)', dark: 'oklch(0.7 0.15 290)' },
  },
] as const;

const FALLBACK = PALETTES[0]!;

export function getPalette(id: PaletteId): PaletteMeta {
  return PALETTES.find((palette) => palette.id === id) ?? FALLBACK;
}

/** Siguiente paleta del ciclo, para el botón de la barra superior. */
export function nextPaletteId(current: PaletteId): PaletteId {
  const index = PALETTES.findIndex((palette) => palette.id === current);
  return PALETTES[(index + 1) % PALETTES.length]!.id;
}
