import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Si la app tiene credenciales de nube.
 *
 * Es una comprobación de variables de entorno y nada más: no toca el SDK, así
 * que preguntar por esto no arrastra a Supabase al bundle principal.
 */
export const isCloudConfigured = Boolean(url && anonKey);

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Carga el SDK de Supabase la primera vez que se lo necesita.
 *
 * El import dinámico es deliberado: `@supabase/supabase-js` pesa unos 60 kB
 * comprimidos y el modo invitado —que es el estado por defecto— no lo usa nunca.
 * Importándolo estáticamente, cualquiera que abre la app a poner un temporizador
 * de cinco minutos paga por un cliente de base de datos que no va a tocar. Así
 * el chunk baja recién cuando alguien intenta iniciar sesión.
 *
 * La promesa queda cacheada, así que el SDK se descarga y el cliente se
 * construye una sola vez por sesión aunque se lo pida en paralelo.
 */
export function getSupabase(): Promise<SupabaseClient> {
  if (!isCloudConfigured) {
    return Promise.reject(new Error('Supabase no está configurado: falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY'));
  }

  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // La sesión llega en el fragmento de la URL tras el OAuth de Google;
        // esto la consume y limpia la barra de direcciones.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }),
  );

  return clientPromise;
}
