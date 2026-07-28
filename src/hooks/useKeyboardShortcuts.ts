import { useEffect, useRef } from 'react';

export type ShortcutAction =
  | 'toggleTimer'
  | 'reset'
  | 'stop'
  | 'skipPhase'
  | 'toggleFocusMode'
  | 'toggleAudio'
  | 'exit'
  | 'toggleTheme'
  | 'toggleHelp'
  | 'addMinute'
  | 'subtractMinute'
  | 'nextSkin';

export interface ShortcutDef {
  action: ShortcutAction;
  /** Valores de `event.key` que disparan la acción. */
  keys: string[];
  /** Cómo se muestra en el panel de ayuda. */
  display: string[];
  label: string;
  group: 'Timer' | 'Vista' | 'General';
}

export const SHORTCUTS: readonly ShortcutDef[] = [
  { action: 'toggleTimer', keys: [' '], display: ['Espacio'], label: 'Iniciar / pausar', group: 'Timer' },
  { action: 'reset', keys: ['r'], display: ['R'], label: 'Reiniciar la fase actual', group: 'Timer' },
  { action: 'stop', keys: ['s'], display: ['S'], label: 'Detener y volver al inicio', group: 'Timer' },
  { action: 'skipPhase', keys: ['n'], display: ['N'], label: 'Saltar a la fase siguiente', group: 'Timer' },
  { action: 'addMinute', keys: ['ArrowUp', '+'], display: ['↑'], label: 'Sumar un minuto', group: 'Timer' },
  { action: 'subtractMinute', keys: ['ArrowDown', '-'], display: ['↓'], label: 'Restar un minuto', group: 'Timer' },
  { action: 'toggleFocusMode', keys: ['f'], display: ['F'], label: 'Modo concentración', group: 'Vista' },
  { action: 'toggleAudio', keys: ['a'], display: ['A'], label: 'Panel de audio', group: 'Vista' },
  { action: 'nextSkin', keys: ['k'], display: ['K'], label: 'Cambiar de skin', group: 'Vista' },
  { action: 'toggleTheme', keys: ['t'], display: ['T'], label: 'Alternar claro / oscuro', group: 'Vista' },
  { action: 'exit', keys: ['Escape'], display: ['Esc'], label: 'Salir del modo concentración o cerrar', group: 'General' },
  { action: 'toggleHelp', keys: ['?', '/'], display: ['?'], label: 'Mostrar estos atajos', group: 'General' },
] as const;

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

/** Un campo de texto tiene prioridad absoluta sobre los atajos globales. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Atajos globales de teclado.
 *
 * Los handlers se guardan en una ref para que el listener se registre una sola
 * vez: sin esto, cada cambio de estado del timer desmontaría y volvería a
 * montar el listener 5 veces por segundo.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers, enabled = true): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Los modificadores quedan para el navegador: interceptar Ctrl+R sería
      // secuestrar el recargar de la página.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const match = SHORTCUTS.find((s) =>
        s.keys.some((k) => (k.length === 1 ? k.toLowerCase() === event.key.toLowerCase() : k === event.key)),
      );
      if (!match) return;

      const handler = handlersRef.current[match.action];
      if (!handler) return;

      // Sin esto, Espacio scrollea la página y las flechas mueven el scroll.
      event.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
