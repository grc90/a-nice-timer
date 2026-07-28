import { useState } from 'react';
import type { SessionPreset } from '@/types';
import { usePresetsStore } from '@/store/presetsStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTimerStore } from '@/store/timerStore';
import { unlockAudio } from '@/audio/alarm';
import { Button, IconButton, TOUCH_BUTTON, TOUCH_ICON } from '@/components/ui/Button';
import { CopyIcon, EditIcon, PlayIcon, PlusIcon, TrashIcon } from '@/components/ui/Icons';
import { PresetEditor } from './PresetEditor';
import { formatDurationLabel } from '@/utils/time';
import { cn } from '@/utils/cn';

const MODE_LABEL = { pomodoro: 'Pomodoro', freeFocus: 'Foco libre', simple: 'Simple' } as const;

export function PresetList({ className }: { className?: string }) {
  const presets = usePresetsStore((s) => s.presets);
  const duplicatePreset = usePresetsStore((s) => s.duplicatePreset);
  const deletePreset = usePresetsStore((s) => s.deletePreset);

  const activePresetId = useTimerStore((s) => s.presetId);
  const timerStatus = useTimerStore((s) => s.status);
  const loadPreset = useTimerStore((s) => s.loadPreset);
  const setSkin = useSettingsStore((s) => s.setSkin);

  const [editing, setEditing] = useState<SessionPreset | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const sessionInProgress = timerStatus === 'running' || timerStatus === 'paused';

  const handleStart = (preset: SessionPreset) => {
    void unlockAudio();
    // Cargar un preset trae su skin: es parte de la identidad de la sesión.
    setSkin(preset.skinId);
    loadPreset(preset, true);
  };

  const openEditor = (preset: SessionPreset | null) => {
    setEditing(preset);
    setEditorOpen(true);
  };

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-label="Sesiones guardadas">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium tracking-tight text-ink">Sesiones</h2>
        <Button variant="ghost" className={TOUCH_BUTTON} icon={<PlusIcon />} onClick={() => openEditor(null)}>
          Nueva
        </Button>
      </header>

      {presets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
          No tenés sesiones guardadas todavía.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {presets.map((preset) => {
            const isActive = preset.id === activePresetId;
            const confirming = pendingDelete === preset.id;

            return (
              <li
                key={preset.id}
                className={cn(
                  'group rounded-2xl border bg-surface px-3.5 py-3 transition-colors duration-150',
                  isActive ? 'border-accent/60 bg-accent-soft/30' : 'border-line hover:border-accent/30',
                )}
              >
                {/* En mobile los botones bajan a su propia línea: apretados
                    contra el nombre en la misma fila, o el nombre queda en dos
                    letras o los botones por debajo del blanco táctil mínimo. */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{preset.name}</p>
                    <p className="mt-0.5 text-xs text-faint">
                      {MODE_LABEL[preset.mode]}
                      {' · '}
                      {preset.mode === 'pomodoro'
                        ? `${formatDurationLabel(preset.pomodoro.focusMs)} / ${formatDurationLabel(preset.pomodoro.shortBreakMs)}`
                        : formatDurationLabel(preset.durationMs)}
                      {isActive && sessionInProgress && <span className="text-accent"> · en curso</span>}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-0.5">
                    {/* En mobile los controles quedan siempre visibles: no hay hover. */}
                    <div className="flex items-center gap-1 opacity-100 transition-opacity sm:gap-0.5 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                      <IconButton
                        label={`Editar ${preset.name}`}
                        onClick={() => openEditor(preset)}
                        className={TOUCH_ICON}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        label={`Duplicar ${preset.name}`}
                        onClick={() => duplicatePreset(preset.id)}
                        className={TOUCH_ICON}
                      >
                        <CopyIcon />
                      </IconButton>
                      <IconButton
                        label={`Eliminar ${preset.name}`}
                        onClick={() => setPendingDelete(confirming ? null : preset.id)}
                        className={cn(TOUCH_ICON, confirming && 'text-danger')}
                      >
                        <TrashIcon />
                      </IconButton>
                    </div>

                    <IconButton
                      label={`Iniciar ${preset.name}`}
                      variant="primary"
                      onClick={() => handleStart(preset)}
                      className={TOUCH_ICON}
                    >
                      <PlayIcon />
                    </IconButton>
                  </div>
                </div>

                {/* Confirmación en línea: un modal para borrar un preset sería
                    desproporcionado, pero borrar sin preguntar es peor. */}
                {confirming && (
                  <div className="anim-fade-in mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                    <span className="text-xs text-muted">¿Eliminar esta sesión?</span>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setPendingDelete(null)}>
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          deletePreset(preset.id);
                          setPendingDelete(null);
                        }}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <PresetEditor open={editorOpen} onClose={() => setEditorOpen(false)} preset={editing} />
    </section>
  );
}
