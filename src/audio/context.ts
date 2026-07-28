/**
 * AudioContext compartido por toda la app.
 *
 * Un único contexto para alarmas y ambiente, no uno por subsistema: los
 * navegadores limitan cuántos AudioContext puede abrir una página (Safari corta
 * en cuatro y despues falla en silencio), y cada uno arrastra su propio hilo de
 * audio. Además el desbloqueo por gesto de usuario vale para el contexto entero,
 * así que compartirlo hace que tocar "iniciar" habilite también la mezcla.
 */

let ctx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }

  return ctx;
}

/**
 * Despierta el contexto de audio.
 *
 * El navegador lo crea en estado 'suspended' hasta que hay un gesto real del
 * usuario. Llamar a esto desde un click garantiza que la alarma pueda sonar 25
 * minutos después, cuando ya no hay ningún gesto cerca. Sin esto, el timer
 * termina en silencio.
 */
export async function unlockAudio(): Promise<void> {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') {
    try {
      await context.resume();
    } catch {
      // Ignorado: si falla, el aviso visual sigue funcionando.
    }
  }
}

export function isAudioRunning(): boolean {
  return getAudioContext()?.state === 'running';
}
