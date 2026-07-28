export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

/**
 * Pide permiso de notificaciones.
 *
 * Debe invocarse desde un gesto del usuario (click en el toggle de ajustes).
 * Los navegadores rechazan o penalizan el pedido automático al cargar la página,
 * por eso nunca se llama en el arranque.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') {
    return Notification.permission as NotificationPermissionState;
  }
  try {
    return (await Notification.requestPermission()) as NotificationPermissionState;
  } catch {
    return 'denied';
  }
}

interface NotifyOptions {
  body?: string;
  /** Notificaciones con el mismo tag se reemplazan en vez de apilarse. */
  tag?: string;
  /** Mantener visible hasta que el usuario interactúe. Ignorado en varias plataformas. */
  requireInteraction?: boolean;
  onClick?: () => void;
}

/** Muestra una notificación del sistema si hay permiso. Silenciosa si no lo hay. */
export function notify(title: string, options: NotifyOptions = {}): Notification | null {
  if (getNotificationPermission() !== 'granted') return null;

  try {
    const notification = new Notification(title, {
      body: options.body,
      tag: options.tag,
      requireInteraction: options.requireInteraction,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    });

    notification.onclick = () => {
      window.focus();
      options.onClick?.();
      notification.close();
    };

    return notification;
  } catch {
    // Safari en iOS tira si no hay service worker registrado. No es fatal:
    // la notificación in-app ya cubrió el aviso.
    return null;
  }
}
