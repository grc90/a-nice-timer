/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Ambas son opcionales: sin ellas la app corre en modo invitado. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
