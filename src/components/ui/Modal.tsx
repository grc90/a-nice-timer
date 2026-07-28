import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { IconButton } from './Button';
import { CloseIcon } from './Icons';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const;

/**
 * Diálogo modal. En pantallas chicas se presenta como bottom sheet, que es
 * donde llega el pulgar; en desktop, centrado.
 *
 * Escape NO se maneja acá: lo centraliza el manejador de atajos de la app, para
 * que haya una sola regla de "qué cierra Escape" y no compitan varios listeners.
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Bloquea el scroll del fondo mientras el modal está abierto.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Mueve el foco al panel para que lectores de pantalla y Tab entren al diálogo.
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] anim-fade-in"
        onClick={onClose}
        aria-label="Cerrar"
        tabIndex={-1}
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-surface border border-line outline-none',
          'rounded-t-3xl sm:rounded-3xl shadow-[var(--shadow-lift)]',
          'max-h-[88dvh] flex flex-col anim-scale-in',
          SIZES[size],
        )}
      >
        <header className="flex items-start gap-4 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium tracking-tight text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <IconButton label="Cerrar" onClick={onClose} size="sm">
            <CloseIcon />
          </IconButton>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>

        {footer && (
          <footer className="flex justify-end gap-2 border-t border-line px-5 py-4 sm:px-6 safe-bottom sm:pb-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
