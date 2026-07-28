import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { useAudioStore } from '@/store/audioStore';
import { getPalette, nextPaletteId } from '@/themes/palettes';
import { IconButton } from '@/components/ui/Button';
import {
  ChartIcon,
  ClockIcon,
  ExpandIcon,
  KeyboardIcon,
  MoonIcon,
  MusicIcon,
  PaletteIcon,
  SettingsIcon,
  SunIcon,
} from '@/components/ui/Icons';

export function TopBar({ resolvedTheme }: { resolvedTheme: 'light' | 'dark' }) {
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const palette = useSettingsStore((s) => s.palette);
  const setPalette = useSettingsStore((s) => s.setPalette);

  const openOverlay = useUiStore((s) => s.openOverlay);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const audioPanelOpen = useUiStore((s) => s.audioPanelOpen);
  const toggleAudioPanel = useUiStore((s) => s.toggleAudioPanel);

  const mix = useAudioStore((s) => s.mix);
  const ambientMuted = useAudioStore((s) => s.ambientMuted);
  const currentLink = useAudioStore((s) => s.currentLink);
  const audioActive = (!ambientMuted && Object.values(mix).some((v) => v > 0)) || currentLink !== null;

  const currentPalette = getPalette(palette);
  const nextPalette = getPalette(nextPaletteId(palette));

  return (
    <header className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <ClockIcon className="shrink-0 text-accent" style={{ fontSize: '1.15rem' }} />
        <h1 className="truncate font-serif text-lg tracking-tight text-ink sm:text-xl">A Nice Timer</h1>
      </div>

      <nav className="flex items-center gap-0.5" aria-label="Acciones">
        <IconButton
          label="Panel de audio"
          size="sm"
          active={audioPanelOpen}
          onClick={toggleAudioPanel}
          className="relative"
        >
          <MusicIcon />
          {/* Punto de actividad: dice que algo suena sin tener que abrir el panel. */}
          {audioActive && !audioPanelOpen && (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" />
          )}
        </IconButton>

        <IconButton label="Estadísticas" size="sm" onClick={() => openOverlay('stats')}>
          <ChartIcon />
        </IconButton>

        {/* Cicla las paletas de toda la interfaz. El listado completo, con
            nombres y muestras, sigue en Ajustes. */}
        <IconButton
          label={`Paleta de colores: ${currentPalette.name}. Cambiar a ${nextPalette.name}`}
          size="sm"
          onClick={() => setPalette(nextPalette.id)}
        >
          <PaletteIcon />
        </IconButton>

        <IconButton
          label={resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          size="sm"
          onClick={toggleTheme}
        >
          {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </IconButton>

        <IconButton label="Modo concentración" size="sm" onClick={() => setFocusMode(true)}>
          <ExpandIcon />
        </IconButton>

        {/* Los atajos no aplican en mobile, donde no hay teclado físico. */}
        <IconButton label="Atajos de teclado" size="sm" className="hidden md:inline-flex" onClick={() => openOverlay('shortcuts')}>
          <KeyboardIcon />
        </IconButton>

        <IconButton label="Ajustes" size="sm" onClick={() => openOverlay('settings')}>
          <SettingsIcon />
        </IconButton>
      </nav>
    </header>
  );
}
