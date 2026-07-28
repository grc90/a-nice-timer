export type ThemeMode = 'light' | 'dark' | 'system';

export type PaletteId = 'minimal' | 'sunset' | 'ocean' | 'forest' | 'midnight';

export interface PaletteMeta {
  id: PaletteId;
  name: string;
  /** Muestras para el selector. No se usan para pintar la app — eso lo hace theme.css. */
  swatch: { light: string; dark: string };
}
