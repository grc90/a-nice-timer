import type { SkinId } from '@/types';
import type { SkinDef } from './types';
import { RingSkin } from './RingSkin';
import { DigitalSkin } from './DigitalSkin';
import { AnalogSkin } from './AnalogSkin';
import { HourglassSkin } from './HourglassSkin';
import { MoonSkin } from './MoonSkin';
import { SundialSkin } from './SundialSkin';

/**
 * Registro de skins.
 *
 * Agregar una skin es escribir un componente que cumpla `SkinProps`, sumar su
 * id al tipo `SkinId` y agregar una entrada acá. Ningún otro archivo cambia.
 */
export const SKINS: readonly SkinDef[] = [
  { id: 'ring', name: 'Anillo', description: 'Arco de progreso que se consume', component: RingSkin },
  { id: 'digital', name: 'Digital', description: 'Dígitos limpios, mínimo ruido', component: DigitalSkin },
  { id: 'analog', name: 'Analógico', description: 'Agujas y cuña de tiempo restante', component: AnalogSkin },
  { id: 'hourglass', name: 'Reloj de arena', description: 'Arena cayendo a caudal constante', component: HourglassSkin },
  { id: 'moon', name: 'Fases lunares', description: 'De luna nueva a llena, con el cielo cambiando', component: MoonSkin },
  { id: 'sundial', name: 'Reloj de sol', description: 'La sombra barre el cuadrante', component: SundialSkin },
] as const;

const FALLBACK = SKINS[0]!;

export function getSkin(id: SkinId): SkinDef {
  return SKINS.find((skin) => skin.id === id) ?? FALLBACK;
}

/** Siguiente skin del ciclo, para el atajo de teclado. */
export function nextSkinId(current: SkinId): SkinId {
  const index = SKINS.findIndex((skin) => skin.id === current);
  return SKINS[(index + 1) % SKINS.length]!.id;
}
