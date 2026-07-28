import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton, TOUCH_ICON } from '@/components/ui/Button';
import { MoreIcon } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';

export interface BarAction {
  key: string;
  /** Texto visible en el menú. Corto: la fila ya tiene su icono al lado. */
  label: string;
  /** Etiqueta larga del botón de icono, que no tiene texto que lo explique. */
  a11yLabel: string;
  /** Estado que el icono solo no alcanza a contar (paleta actual, sala en vivo). */
  hint?: string;
  icon: ReactNode;
  active?: boolean;
  onSelect: () => void;
}

/**
 * Acciones secundarias plegadas en un menú, para mobile.
 *
 * En desktop la barra muestra los ocho iconos sueltos y está bien: hay ancho de
 * sobra y un mouse apunta fino. En un teléfono esos mismos iconos entran sólo si
 * se los achica por debajo del blanco táctil mínimo, así que las acciones que no
 * son de la sesión en curso se pliegan acá y quedan como filas de 44 px con su
 * nombre escrito, que además resuelve que un icono suelto no se entiende sin
 * hover ni title.
 */
export function MoreMenu({ actions, className }: { actions: BarAction[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mismo criterio que `AccountMenu`: `pointerdown` y no `click`, porque con
  // `click` el botón de abajo recibiría el evento antes de que el menú cierre.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <IconButton
        label="Más acciones"
        active={open}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={TOUCH_ICON}
      >
        <MoreIcon />
      </IconButton>

      {open && (
        <div
          role="menu"
          className={cn(
            'anim-scale-in absolute right-0 top-full z-50 mt-2 w-60 origin-top-right',
            'rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]',
          )}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              className={cn(
                'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm',
                'transition-colors duration-150 hover:bg-surface-2',
                action.active ? 'text-accent' : 'text-ink',
              )}
            >
              <span className={cn('shrink-0 text-[1.05rem]', action.active ? 'text-accent' : 'text-muted')}>
                {action.icon}
              </span>
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              {action.hint && <span className="shrink-0 text-xs text-faint">{action.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
