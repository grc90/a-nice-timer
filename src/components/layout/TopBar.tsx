import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import { useAudioStore } from '@/store/audioStore';
import { getPalette, nextPaletteId } from '@/themes/palettes';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { IconButton, TOUCH_ICON } from '@/components/ui/Button';
import { MoreMenu, type BarAction } from '@/components/layout/MoreMenu';
import {
  ChartIcon,
  ClockIcon,
  ExpandIcon,
  KeyboardIcon,
  MoonIcon,
  MusicIcon,
  PaletteIcon,
  SettingsIcon,
  ShareIcon,
  SunIcon,
} from '@/components/ui/Icons';
import { useRoomStore } from '@/store/roomStore';

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

  const sharingLive = useRoomStore((s) => s.status) === 'live';

  const currentPalette = getPalette(palette);
  const nextPalette = getPalette(nextPaletteId(palette));

  /**
   * Acciones que no son de la sesión en curso.
   *
   * Se declaran una vez y se pintan dos veces —iconos sueltos en desktop, filas
   * con nombre dentro del menú en mobile— para que no haya dos listas que
   * puedan quedar desalineadas cuando se agregue una acción.
   */
  const secondary: BarAction[] = [
    {
      key: 'stats',
      label: 'Estadísticas',
      a11yLabel: 'Estadísticas',
      icon: <ChartIcon />,
      onSelect: () => openOverlay('stats'),
    },
    {
      key: 'share',
      label: 'Compartir sesión',
      a11yLabel: sharingLive ? 'Compartiendo la sesión' : 'Compartir la sesión',
      hint: sharingLive ? 'En vivo' : undefined,
      icon: <ShareIcon />,
      active: sharingLive,
      onSelect: () => openOverlay('share'),
    },
    {
      // Cicla las paletas de toda la interfaz. El listado completo, con nombres
      // y muestras, sigue en Ajustes.
      key: 'palette',
      label: 'Cambiar paleta',
      a11yLabel: `Paleta de colores: ${currentPalette.name}. Cambiar a ${nextPalette.name}`,
      hint: currentPalette.name,
      icon: <PaletteIcon />,
      onSelect: () => setPalette(nextPalette.id),
    },
    {
      key: 'theme',
      label: resolvedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro',
      a11yLabel: resolvedTheme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
      icon: resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />,
      onSelect: toggleTheme,
    },
    {
      key: 'settings',
      label: 'Ajustes',
      a11yLabel: 'Ajustes',
      icon: <SettingsIcon />,
      onSelect: () => openOverlay('settings'),
    },
  ];

  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <ClockIcon className="shrink-0 text-accent" style={{ fontSize: '1.15rem' }} />
        <h1 className="truncate font-serif text-lg tracking-tight text-ink sm:text-xl">A Nice Timer</h1>
      </div>

      <nav className="flex shrink-0 items-center gap-1 sm:gap-0.5" aria-label="Acciones">
        {/* Audio y concentración se quedan afuera del menú en toda pantalla:
            son los dos controles que se tocan con una sesión andando. */}
        <IconButton
          label="Panel de audio"
          active={audioPanelOpen}
          onClick={toggleAudioPanel}
          className={`relative ${TOUCH_ICON}`}
        >
          <MusicIcon />
          {/* Punto de actividad: dice que algo suena sin tener que abrir el panel. */}
          {audioActive && !audioPanelOpen && (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" />
          )}
        </IconButton>

        <IconButton label="Modo concentración" onClick={() => setFocusMode(true)} className={TOUCH_ICON}>
          <ExpandIcon />
        </IconButton>

        {/* Mobile: todo lo demás plegado. Desktop: la misma lista, suelta. */}
        <MoreMenu actions={secondary} className="sm:hidden" />

        {secondary.map((action) => (
          <IconButton
            key={action.key}
            label={action.a11yLabel}
            size="sm"
            active={action.active}
            onClick={action.onSelect}
            className="relative hidden sm:inline-flex"
          >
            {action.icon}
            {action.active && <span className="absolute right-1 top-1 size-1.5 animate-pulse rounded-full bg-accent" />}
          </IconButton>
        ))}

        {/* Los atajos no aplican en mobile, donde no hay teclado físico. */}
        <IconButton
          label="Atajos de teclado"
          size="sm"
          className="hidden md:inline-flex"
          onClick={() => openOverlay('shortcuts')}
        >
          <KeyboardIcon />
        </IconButton>

        <AccountMenu />
      </nav>
    </header>
  );
}
