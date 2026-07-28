import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isCloudConfigured } from '@/lib/supabase';

export type AuthStatus =
  /** Todavía no sabemos si hay sesión guardada. Dura milisegundos al arrancar. */
  | 'loading'
  /** Sin cuenta. Todo vive en localStorage y la app funciona completa. */
  | 'guest'
  | 'authenticated';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  /** Mensaje del último intento de login/registro, para mostrarlo en el formulario. */
  error: string | null;
  /** El registro pidió confirmar el mail antes de poder entrar. */
  pendingEmailConfirmation: string | null;
  busy: boolean;

  syncStatus: SyncStatus;
  lastSyncedAt: number | null;
  syncError: string | null;

  init: () => () => void;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;

  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  markSynced: () => void;
}

/**
 * Traduce los errores de Supabase, que llegan en inglés y a veces son crípticos.
 * Los que no reconocemos pasan tal cual antes que inventar un mensaje genérico
 * que oculte la causa real.
 */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email o contraseña incorrectos.',
    'Email not confirmed': 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.',
    'User already registered': 'Ya existe una cuenta con ese email.',
    'Password should be at least 6 characters': 'La contraseña necesita al menos 6 caracteres.',
    'Unable to validate email address: invalid format': 'Ese email no tiene un formato válido.',
    'Email rate limit exceeded': 'Demasiados intentos. Esperá unos minutos.',
    'Signups not allowed for this instance': 'El registro está deshabilitado en este proyecto.',
  };
  if (map[message]) return map[message];

  // Los proveedores OAuth se habilitan uno por uno en el panel de Supabase, y el
  // mensaje crudo ("Unsupported provider") no le dice nada a quien usa la app.
  if (/unsupported provider|provider is not enabled/i.test(message)) {
    return 'El acceso con Google no está habilitado en este proyecto. Usá email y contraseña.';
  }

  return message;
}

export const useAuthStore = create<AuthState>()((set) => ({
  // Sin nube configurada el estado inicial ya es definitivo: no hay sesión que
  // esperar, así que la app arranca en invitado sin pantalla de carga.
  status: isCloudConfigured ? 'loading' : 'guest',
  user: null,
  error: null,
  pendingEmailConfirmation: null,
  busy: false,

  syncStatus: 'idle',
  lastSyncedAt: null,
  syncError: null,

  /**
   * Arranca la escucha de sesión. Devuelve la función para cortarla.
   *
   * `onAuthStateChange` cubre el arranque, el refresco de token y el retorno del
   * OAuth de Google, así que una sola suscripción reemplaza a un `getSession`
   * inicial más el manejo del redirect por separado.
   */
  init: () => {
    if (!isCloudConfigured) {
      set({ status: 'guest' });
      return () => {};
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    const applySession = (session: Session | null) => {
      if (cancelled) return;
      set({
        status: session ? 'authenticated' : 'guest',
        user: session?.user ?? null,
      });
    };

    void (async () => {
      try {
        const db = await getSupabase();
        if (cancelled) return;

        const { data: sessionData } = await db.auth.getSession();
        applySession(sessionData.session);

        const { data } = db.auth.onAuthStateChange((_event, session) => applySession(session));
        if (cancelled) data.subscription.unsubscribe();
        else unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        // Sin SDK no hay sesión posible: la app sigue en invitado.
        applySession(null);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  },

  signUp: async (email, password) => {
    if (!isCloudConfigured) return false;
    set({ busy: true, error: null, pendingEmailConfirmation: null });

    const db = await getSupabase();
    const { data, error } = await db.auth.signUp({ email: email.trim(), password });

    if (error) {
      set({ busy: false, error: translateAuthError(error.message) });
      return false;
    }

    // Con confirmación por email activada, Supabase devuelve un usuario sin
    // sesión. Sin ese aviso el formulario parecería no haber hecho nada.
    if (data.user && !data.session) {
      set({ busy: false, pendingEmailConfirmation: email.trim() });
      return true;
    }

    set({ busy: false });
    return true;
  },

  signIn: async (email, password) => {
    if (!isCloudConfigured) return false;
    set({ busy: true, error: null, pendingEmailConfirmation: null });

    const db = await getSupabase();
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      set({ busy: false, error: translateAuthError(error.message) });
      return false;
    }

    set({ busy: false });
    return true;
  },

  signInWithGoogle: async () => {
    if (!isCloudConfigured) return;
    set({ busy: true, error: null });

    const db = await getSupabase();
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

    // Si sale bien el navegador ya está navegando; sólo importa el caso de error.
    if (error) set({ busy: false, error: translateAuthError(error.message) });
  },

  signOut: async () => {
    if (!isCloudConfigured) return;
    set({ busy: true });
    const db = await getSupabase();
    await db.auth.signOut();
    // Los datos locales NO se borran: cerrar sesión devuelve al modo invitado
    // con lo que había, no a una app vacía.
    set({ busy: false, status: 'guest', user: null, syncStatus: 'idle', lastSyncedAt: null, syncError: null });
  },

  clearError: () => set({ error: null, pendingEmailConfirmation: null }),

  setSyncStatus: (syncStatus, syncError = null) => set({ syncStatus, syncError }),
  markSynced: () => set({ syncStatus: 'idle', syncError: null, lastSyncedAt: Date.now() }),
}));

/** Nombre a mostrar: el de Google si existe, si no la parte local del email. */
export function displayName(user: User | null): string {
  if (!user) return 'Invitado';
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user.email?.split('@')[0] ?? 'Cuenta';
}
