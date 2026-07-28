import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'bg-surface-2 text-ink border border-line hover:bg-surface hover:border-accent/40',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-transparent text-danger border border-danger/30 hover:bg-danger/10',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[0.8125rem] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-2xl',
};

export function Button({ variant = 'secondary', size = 'md', icon, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium select-none',
        'transition-[background-color,border-color,color,filter,transform] duration-150',
        'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obligatorio: el botón no tiene texto visible. */
  label: string;
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

const ICON_SIZES: Record<Size, string> = {
  sm: 'size-8 text-[0.95rem] rounded-lg',
  md: 'size-10 text-[1.05rem] rounded-xl',
  lg: 'size-12 text-[1.2rem] rounded-2xl',
};

export function IconButton({
  label,
  variant = 'ghost',
  size = 'md',
  active = false,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={props['aria-pressed'] ?? (active || undefined)}
      className={cn(
        'inline-flex items-center justify-center shrink-0',
        'transition-[background-color,border-color,color,filter,transform] duration-150',
        'active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        ICON_SIZES[size],
        active && 'bg-accent-soft text-accent',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
