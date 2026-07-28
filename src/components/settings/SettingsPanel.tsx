import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { PALETTES } from '@/themes/palettes';
import { SKINS } from '@/skins/registry';
import { ALARMS, previewAlarm } from '@/audio/alarm';
import { Modal } from '@/components/ui/Modal';
import { Field, SegmentedControl, Slider, Stepper, Toggle } from '@/components/ui/Field';
import { CheckIcon } from '@/components/ui/Icons';
import { useReducedMotion } from '@/hooks/useMediaQuery';
import { getNotificationPermission, requestNotificationPermission } from '@/utils/notifications';
import { cn } from '@/utils/cn';
import type { ThemeMode } from '@/types';

const THEME_OPTIONS: readonly { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettingsStore();
  const [permission, setPermission] = useState(getNotificationPermission);
  const systemPrefersReducedMotion = useReducedMotion();

  const handleNotificationsToggle = async (enabled: boolean) => {
    if (!enabled) {
      settings.setNotificationsEnabled(false);
      return;
    }
    // El permiso se pide acá porque este click es un gesto del usuario. Pedirlo
    // al cargar la app hace que los navegadores lo bloqueen de entrada.
    const result = await requestNotificationPermission();
    setPermission(result);
    settings.setNotificationsEnabled(result === 'granted');
  };

  return (
    <Modal open={open} onClose={onClose} title="Ajustes" size="lg">
      <div className="flex flex-col gap-7">
        <section className="flex flex-col gap-4">
          <SectionTitle>Apariencia</SectionTitle>

          <Field label="Tema">
            <SegmentedControl
              value={settings.themeMode}
              onChange={settings.setThemeMode}
              options={THEME_OPTIONS}
              className="w-full"
            />
          </Field>

          <Field label="Paleta de color">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  onClick={() => settings.setPalette(palette.id)}
                  aria-pressed={settings.palette === palette.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors duration-150',
                    settings.palette === palette.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface-2 hover:border-accent/40',
                  )}
                >
                  <span
                    className="size-5 shrink-0 rounded-full border border-black/10"
                    style={{
                      // Muestra las dos variantes en un solo círculo, para que el
                      // selector siga siendo informativo en cualquier tema.
                      background: `linear-gradient(135deg, ${palette.swatch.light} 0 50%, ${palette.swatch.dark} 50% 100%)`,
                    }}
                  />
                  <span className="truncate text-[0.8125rem] font-medium text-ink">{palette.name}</span>
                  {settings.palette === palette.id && <CheckIcon className="ml-auto shrink-0 text-accent" />}
                </button>
              ))}
            </div>
          </Field>

          <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface-2/40 px-3.5 py-2.5">
            <Toggle
              checked={settings.auroraEnabled}
              onChange={settings.setAuroraEnabled}
              label="Fondo de auroras"
              description="Luces cálidas que se mueven muy despacio detrás del timer."
            />
            {settings.auroraEnabled && (
              <div className="anim-fade-in mt-1 flex flex-col gap-3 border-t border-line pt-2">
                <Toggle
                  checked={settings.auroraMotion}
                  onChange={settings.setAuroraMotion}
                  label="Movimiento"
                  description={
                    systemPrefersReducedMotion
                      ? 'Tu sistema pide movimiento reducido. Esto lo ignora sólo para el fondo; el resto de la interfaz lo respeta.'
                      : 'Las luces se desplazan lentamente. Apagalo para dejarlas fijas.'
                  }
                />

                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-muted">Intensidad</span>
                  <Slider
                    label="Intensidad del fondo"
                    value={settings.auroraIntensity}
                    onChange={settings.setAuroraIntensity}
                    min={0.15}
                    max={1}
                  />
                  <span className="tabular w-9 shrink-0 text-right text-[0.6875rem] text-faint">
                    {Math.round(settings.auroraIntensity * 100)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <Field label="Skin del timer" hint="Se puede cambiar en cualquier momento sin perder la sesión activa.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SKINS.map((skin) => (
                <button
                  key={skin.id}
                  type="button"
                  onClick={() => settings.setSkin(skin.id)}
                  aria-pressed={settings.skinId === skin.id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 text-left transition-colors duration-150',
                    settings.skinId === skin.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-line bg-surface-2 hover:border-accent/40',
                  )}
                >
                  <span className="block text-[0.8125rem] font-medium text-ink">{skin.name}</span>
                  <span className="mt-0.5 block text-[0.6875rem] leading-tight text-faint">{skin.description}</span>
                </button>
              ))}
            </div>
          </Field>
        </section>

        <section className="flex flex-col gap-4 border-t border-line pt-6">
          <SectionTitle>Alarma</SectionTitle>

          <Field label={`Volumen · ${Math.round(settings.alarmVolume * 100)}%`}>
            <Slider
              label="Volumen de la alarma"
              value={settings.alarmVolume}
              onChange={(v) => {
                settings.setAlarmVolume(v);
              }}
            />
          </Field>

          <Field label="Repeticiones" hint="Cuántas veces suena la alarma al terminar una fase.">
            <Stepper value={settings.alarmRepeats} onChange={settings.setAlarmRepeats} min={1} max={5} />
          </Field>

          <Field label="Sonido por defecto" hint="Se aplica a timers sin preset. Cada sesión guardada tiene el suyo.">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ALARMS.map((alarm) => (
                <button
                  key={alarm.id}
                  type="button"
                  onClick={() => {
                    settings.setDefaultAlarm(alarm.id);
                    previewAlarm(alarm.id, settings.alarmVolume);
                  }}
                  aria-pressed={settings.defaultAlarmId === alarm.id}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-[0.8125rem] font-medium transition-colors duration-150',
                    settings.defaultAlarmId === alarm.id
                      ? 'border-accent bg-accent-soft text-ink'
                      : 'border-line bg-surface-2 text-muted hover:border-accent/40 hover:text-ink',
                  )}
                >
                  {alarm.name}
                </button>
              ))}
            </div>
          </Field>
        </section>

        <section className="flex flex-col gap-1 border-t border-line pt-6">
          <SectionTitle className="mb-3">Comportamiento</SectionTitle>

          <Toggle
            checked={settings.notificationsEnabled && permission === 'granted'}
            onChange={(v) => void handleNotificationsToggle(v)}
            label="Notificaciones del navegador"
            description={
              permission === 'denied'
                ? 'Bloqueadas: habilitalas desde los permisos del sitio en el navegador.'
                : permission === 'unsupported'
                  ? 'Este navegador no las soporta.'
                  : 'Avisa al terminar cada fase, incluso con la pestaña en segundo plano.'
            }
          />

          <Toggle
            checked={settings.keepAwake}
            onChange={settings.setKeepAwake}
            label="Mantener la pantalla encendida"
            description="Evita que el dispositivo se bloquee mientras corre una sesión."
          />

          <Toggle
            checked={settings.autoFocusMode}
            onChange={settings.setAutoFocusMode}
            label="Modo concentración automático"
            description="Entra en pantalla completa al empezar cada bloque de foco."
          />

          <Toggle
            checked={settings.showTimeInTitle}
            onChange={settings.setShowTimeInTitle}
            label="Tiempo en el título de la pestaña"
            description="Para seguir la cuenta desde otra pestaña."
          />
        </section>
      </div>
    </Modal>
  );
}

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h3 className={cn('text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint', className)}>{children}</h3>
  );
}
