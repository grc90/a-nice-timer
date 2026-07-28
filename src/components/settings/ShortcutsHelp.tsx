import { SHORTCUTS, type ShortcutDef } from '@/hooks/useKeyboardShortcuts';
import { Modal } from '@/components/ui/Modal';
import { Kbd } from '@/components/ui/Field';

const GROUP_ORDER: ShortcutDef['group'][] = ['Timer', 'Vista', 'General'];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Atajos de teclado"
      description="No funcionan mientras escribís en un campo de texto."
      size="sm"
    >
      <div className="flex flex-col gap-6">
        {GROUP_ORDER.map((group) => {
          const items = SHORTCUTS.filter((s) => s.group === group);
          if (items.length === 0) return null;

          return (
            <section key={group} className="flex flex-col gap-2">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">{group}</h3>
              <ul className="flex flex-col">
                {items.map((shortcut) => (
                  <li
                    key={shortcut.action}
                    className="flex items-center justify-between gap-4 border-b border-line/60 py-2 last:border-0"
                  >
                    <span className="text-sm text-muted">{shortcut.label}</span>
                    <span className="flex shrink-0 gap-1">
                      {shortcut.display.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
