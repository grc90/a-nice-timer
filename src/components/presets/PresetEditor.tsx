import { useEffect, useState } from 'react';
import type { AlarmId, SessionPreset, SkinId, TimerMode } from '@/types';
import { usePresetsStore, type PresetDraft } from '@/store/presetsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { ALARMS, previewAlarm } from '@/audio/alarm';
import { SKINS } from '@/skins/registry';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, SegmentedControl, Stepper, TextInput, Toggle } from '@/components/ui/Field';
import { MINUTE, minutesToMs, msToMinutes } from '@/utils/time';
import { cn } from '@/utils/cn';

const MODE_OPTIONS: readonly { value: TimerMode; label: string }[] = [
  { value: 'pomodoro', label: 'Pomodoro' },
  { value: 'freeFocus', label: 'Foco libre' },
  { value: 'simple', label: 'Simple' },
];

const MODE_HINT: Record<TimerMode, string> = {
  pomodoro: 'Alterna foco y descanso automáticamente, con descanso largo cada N ciclos.',
  freeFocus: 'Una sola cuenta regresiva larga, sin cortes.',
  simple: 'Cuenta regresiva puntual: suena y termina.',
};

interface PresetEditorProps {
  open: boolean;
  onClose: () => void;
  /** Preset a editar. null = crear uno nuevo. */
  preset: SessionPreset | null;
}

export function PresetEditor({ open, onClose, preset }: PresetEditorProps) {
  const createPreset = usePresetsStore((s) => s.createPreset);
  const updatePreset = usePresetsStore((s) => s.updatePreset);
  const defaultPomodoro = useSettingsStore((s) => s.defaultPomodoro);
  const defaultAlarmId = useSettingsStore((s) => s.defaultAlarmId);
  const alarmVolume = useSettingsStore((s) => s.alarmVolume);

  const [draft, setDraft] = useState<PresetDraft>(() => emptyDraft());

  function emptyDraft(): PresetDraft {
    return {
      name: '',
      mode: 'pomodoro',
      durationMs: 25 * MINUTE,
      pomodoro: defaultPomodoro,
      skinId: 'ring',
      alarmId: defaultAlarmId,
      accentColor: null,
    };
  }

  // Se resincroniza al abrir, no en cada render: si dependiera de `preset` a
  // secas, escribir en el campo nombre se pisaría a sí mismo.
  useEffect(() => {
    if (!open) return;
    if (preset) {
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = preset;
      setDraft(rest);
    } else {
      setDraft(emptyDraft());
    }
  }, [open, preset]);

  const patch = (changes: Partial<PresetDraft>) => setDraft((d) => ({ ...d, ...changes }));
  const patchPomodoro = (changes: Partial<PresetDraft['pomodoro']>) =>
    setDraft((d) => ({ ...d, pomodoro: { ...d.pomodoro, ...changes } }));

  const handleSave = () => {
    const name = draft.name.trim() || fallbackName(draft.mode);
    if (preset) updatePreset(preset.id, { ...draft, name });
    else createPreset({ ...draft, name });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={preset ? 'Editar sesión' : 'Nueva sesión'}
      description={MODE_HINT[draft.mode]}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {preset ? 'Guardar cambios' : 'Crear sesión'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Nombre">
          <TextInput
            value={draft.name}
            onChange={(name) => patch({ name })}
            placeholder={fallbackName(draft.mode)}
            maxLength={48}
            autoFocus
          />
        </Field>

        <Field label="Tipo de sesión">
          <SegmentedControl value={draft.mode} onChange={(mode) => patch({ mode })} options={MODE_OPTIONS} className="w-full" />
        </Field>

        {draft.mode === 'pomodoro' ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-2/50 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Foco">
                <Stepper
                  value={Math.round(msToMinutes(draft.pomodoro.focusMs))}
                  onChange={(v) => patchPomodoro({ focusMs: minutesToMs(v) })}
                  min={1}
                  max={180}
                  unit="min"
                />
              </Field>
              <Field label="Descanso corto">
                <Stepper
                  value={Math.round(msToMinutes(draft.pomodoro.shortBreakMs))}
                  onChange={(v) => patchPomodoro({ shortBreakMs: minutesToMs(v) })}
                  min={1}
                  max={60}
                  unit="min"
                />
              </Field>
              <Field label="Descanso largo">
                <Stepper
                  value={Math.round(msToMinutes(draft.pomodoro.longBreakMs))}
                  onChange={(v) => patchPomodoro({ longBreakMs: minutesToMs(v) })}
                  min={1}
                  max={120}
                  unit="min"
                />
              </Field>
            </div>

            <Field label="Focos antes del descanso largo">
              <Stepper
                value={draft.pomodoro.cyclesBeforeLongBreak}
                onChange={(v) => patchPomodoro({ cyclesBeforeLongBreak: v })}
                min={2}
                max={12}
              />
            </Field>

            <div className="flex flex-col gap-1 border-t border-line pt-3">
              <Toggle
                checked={draft.pomodoro.autoStartBreaks}
                onChange={(v) => patchPomodoro({ autoStartBreaks: v })}
                label="Encadenar el descanso"
                description="Al terminar el foco, el descanso arranca solo."
              />
              <Toggle
                checked={draft.pomodoro.autoStartFocus}
                onChange={(v) => patchPomodoro({ autoStartFocus: v })}
                label="Encadenar el foco"
                description="Al terminar el descanso, vuelve a foco sin intervención."
              />
            </div>
          </div>
        ) : (
          <Field label="Duración" hint={draft.mode === 'freeFocus' ? 'Pensado para bloques largos sin cortes.' : undefined}>
            <Stepper
              value={Math.round(msToMinutes(draft.durationMs))}
              onChange={(v) => patch({ durationMs: minutesToMs(v) })}
              min={1}
              max={480}
              unit="min"
            />
          </Field>
        )}

        <Field label="Skin">
          <div className="grid grid-cols-3 gap-2">
            {SKINS.map((skin) => (
              <SelectChip
                key={skin.id}
                selected={draft.skinId === skin.id}
                onClick={() => patch({ skinId: skin.id as SkinId })}
                title={skin.name}
                subtitle={skin.description}
              />
            ))}
          </div>
        </Field>

        <Field label="Alarma" hint="Tocá una opción para escucharla.">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALARMS.map((alarm) => (
              <SelectChip
                key={alarm.id}
                selected={draft.alarmId === alarm.id}
                onClick={() => {
                  patch({ alarmId: alarm.id as AlarmId });
                  previewAlarm(alarm.id, alarmVolume);
                }}
                title={alarm.name}
                subtitle={alarm.description}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

function fallbackName(mode: TimerMode): string {
  return mode === 'pomodoro' ? 'Pomodoro' : mode === 'freeFocus' ? 'Foco libre' : 'Temporizador';
}

interface SelectChipProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}

function SelectChip({ selected, onClick, title, subtitle }: SelectChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={subtitle}
      className={cn(
        'rounded-xl border px-3 py-2 text-left transition-colors duration-150',
        selected ? 'border-accent bg-accent-soft text-ink' : 'border-line bg-surface-2 text-muted hover:border-accent/40 hover:text-ink',
      )}
    >
      <span className="block truncate text-[0.8125rem] font-medium">{title}</span>
    </button>
  );
}
