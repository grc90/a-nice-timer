import { useSettingsStore } from '@/store/settingsStore';
import { getSkin, nextSkinId } from '@/skins/registry';
import { ShapesIcon } from '@/components/ui/Icons';
import { cn } from '@/utils/cn';

/**
 * Cambio de skin al pie del timer.
 *
 * Vive pegado a la esfera y no en la barra superior: es lo único que edita lo
 * que se está mirando, así que el control tiene que estar donde está el efecto.
 * Muestra el nombre de la skin actual para que el botón también sirva de
 * etiqueta; el catálogo completo sigue en Ajustes.
 */
export function SkinSwitcher({ className }: { className?: string }) {
  const skinId = useSettingsStore((s) => s.skinId);
  const setSkin = useSettingsStore((s) => s.setSkin);

  const current = getSkin(skinId);
  const next = getSkin(nextSkinId(skinId));

  return (
    <button
      type="button"
      onClick={() => setSkin(next.id)}
      title={`Skin: ${current.name} · cambiar a ${next.name} (K)`}
      aria-label={`Skin del timer: ${current.name}. Cambiar a ${next.name}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line/70 bg-surface-2/50 px-2.5 py-1',
        'text-[0.6875rem] font-medium text-muted select-none',
        'transition-[background-color,border-color,color,transform] duration-150',
        'hover:border-accent/40 hover:text-ink active:scale-95',
        className,
      )}
    >
      <ShapesIcon className="shrink-0 text-[0.8125rem]" />
      {current.name}
    </button>
  );
}
