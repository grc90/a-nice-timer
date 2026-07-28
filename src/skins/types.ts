import type { ComponentType } from 'react';
import type { Phase, SkinId, TimerStatus } from '@/types';

/**
 * Contrato único de todas las skins.
 *
 * Una skin recibe el progreso y no sabe nada del store: no puede iniciar,
 * pausar ni mutar el timer. Por eso cambiar de skin no puede romper una sesión
 * en curso — la garantía es estructural, no una convención.
 */
export interface SkinProps {
  /** Fracción transcurrida de la fase actual, 0..1. */
  progress: number;
  remainingMs: number;
  totalMs: number;
  phase: Phase;
  status: TimerStatus;
  /** El usuario pidió menos movimiento: las skins deben cortar animaciones continuas. */
  reducedMotion: boolean;
}

export interface SkinDef {
  id: SkinId;
  name: string;
  description: string;
  component: ComponentType<SkinProps>;
}
