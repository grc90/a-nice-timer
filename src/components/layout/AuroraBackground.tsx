import { useSettingsStore } from '@/store/settingsStore';
import { cn } from '@/utils/cn';

interface AuroraBackgroundProps {
  /** Permite reubicarla en otro contexto de apilado, como el modo concentración. */
  className?: string;
}

/**
 * Fondo de auroras cálidas.
 *
 * Toda la mecánica vive en CSS (`.aurora` en index.css); acá sólo se decide si
 * se muestra y con cuánta fuerza. Así el fondo no re-renderiza nunca durante una
 * sesión: React lo monta una vez y el compositor se encarga del resto.
 *
 * `aria-hidden` porque no comunica nada — es ambiente, y anunciarlo sería ruido
 * para un lector de pantalla.
 */
export function AuroraBackground({ className }: AuroraBackgroundProps) {
  const enabled = useSettingsStore((s) => s.auroraEnabled);
  const motion = useSettingsStore((s) => s.auroraMotion);
  const intensity = useSettingsStore((s) => s.auroraIntensity);

  if (!enabled) return null;

  return (
    <div
      className={cn('aurora', motion && 'aurora--animated', className)}
      aria-hidden="true"
      style={{ '--aurora-intensity': intensity } as React.CSSProperties}
    >
      <span className="aurora__band" />
      <span className="aurora__band" />
      <span className="aurora__band" />
      <span className="aurora__band" />
      <span className="aurora__band" />
    </div>
  );
}
