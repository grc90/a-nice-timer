import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { usePresetsStore } from '@/store/presetsStore';
import { useStatsStore } from '@/store/statsStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, SegmentedControl, TextInput } from '@/components/ui/Field';
import { CheckIcon } from '@/components/ui/Icons';
import { formatDurationLabel } from '@/utils/time';

type Mode = 'signIn' | 'signUp';

const MODE_OPTIONS: readonly { value: Mode; label: string }[] = [
  { value: 'signIn', label: 'Entrar' },
  { value: 'signUp', label: 'Crear cuenta' },
];

export function AuthPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const pendingConfirmation = useAuthStore((s) => s.pendingEmailConfirmation);
  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const clearError = useAuthStore((s) => s.clearError);

  const presetCount = usePresetsStore((s) => s.presets.length);
  const recordCount = useStatsStore((s) => s.records.length);
  const localFocusMs = useStatsStore((s) =>
    Object.values(s.daily).reduce((sum, day) => sum + day.focusedMs, 0),
  );

  // Limpia el estado del formulario al abrir: dejar un error viejo o la
  // contraseña tipeada de la última vez sería confuso y además inseguro.
  useEffect(() => {
    if (!open) return;
    setPassword('');
    clearError();
  }, [open, clearError]);

  const canSubmit = email.trim().length > 3 && password.length >= 6 && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const ok = mode === 'signIn' ? await signIn(email, password) : await signUp(email, password);
    if (ok && mode === 'signIn') onClose();
  };

  const hasLocalData = presetCount > 0 || recordCount > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'signIn' ? 'Entrar a tu cuenta' : 'Crear una cuenta'}
      description="Para tener tus sesiones, temas y estadísticas en cualquier dispositivo."
      size="sm"
    >
      {pendingConfirmation ? (
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CheckIcon style={{ fontSize: '1.4rem' }} />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Revisá tu email</p>
            <p className="mt-1.5 text-sm text-muted">
              Te enviamos un link de confirmación a <span className="text-ink">{pendingConfirmation}</span>. Cuando lo
              abras vas a poder entrar.
            </p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Entendido
          </Button>
        </div>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <SegmentedControl
            value={mode}
            onChange={(next) => {
              setMode(next);
              clearError();
            }}
            options={MODE_OPTIONS}
            className="w-full"
          />

          <Field label="Email">
            <TextInput value={email} onChange={setEmail} placeholder="vos@ejemplo.com" autoFocus />
          </Field>

          <Field label="Contraseña" hint={mode === 'signUp' ? 'Mínimo 6 caracteres.' : undefined}>
            {/* TextInput es de tipo texto; la contraseña necesita su propio input. */}
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
              className="h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink transition-colors placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </p>
          )}

          {mode === 'signUp' && hasLocalData && (
            <p className="rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-xs text-muted">
              Lo que ya tenés en este navegador se sube a tu cuenta nueva:{' '}
              <span className="text-ink">
                {presetCount} sesión{presetCount === 1 ? '' : 'es'}
              </span>
              {localFocusMs > 0 && (
                <>
                  {' y '}
                  <span className="text-ink">{formatDurationLabel(localFocusMs)}</span> de foco registrado
                </>
              )}
              . No se pierde nada.
            </p>
          )}

          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {busy ? 'Un momento…' : mode === 'signIn' ? 'Entrar' : 'Crear cuenta'}
          </Button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--c-border)]" />
            <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">o</span>
            <span className="h-px flex-1 bg-[var(--c-border)]" />
          </div>

          <Button type="button" variant="secondary" onClick={() => void signInWithGoogle()} disabled={busy}>
            <GoogleMark />
            Continuar con Google
          </Button>

          <p className="text-center text-xs text-faint">
            También podés seguir sin cuenta: todo se guarda en este navegador.
          </p>
        </form>
      )}
    </Modal>
  );
}

/** Logo de Google. Va con sus colores oficiales, no con los de la paleta. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91a8.78 8.78 0 0 0 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86a5.36 5.36 0 0 1-5.03-3.71H1.05v2.34A9 9 0 0 0 9 18z"
      />
      <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.97 7.3V4.96H1.05a9 9 0 0 0 0 8.09l2.92-2.34z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 1.05 4.96L3.97 7.3A5.36 5.36 0 0 1 9 3.58z"
      />
    </svg>
  );
}
