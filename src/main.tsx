import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { roomIdFromUrl } from './store/roomStore';
import './index.css';

/**
 * Ruteo mínimo por query param, sin librería de routing.
 *
 * La app tiene exactamente dos vistas y la segunda es un callejón sin salida, así
 * que un router entero sería peso muerto.
 *
 * Que la elección esté acá y no dentro de `App` tiene dos consecuencias:
 *
 * 1. **La vista de invitado es de sólo lectura por construcción**, no por
 *    convención: monta un árbol que no incluye el motor del timer, ni el sync con
 *    la nube, ni el motor de audio. No hay una ruta de código por la que un
 *    espectador pueda alterar la sesión del host, ni una sesión propia que se le
 *    arranque sola de fondo.
 * 2. Las dos ramas se cargan por separado. Quien abre un link de body doubling
 *    —probablemente desde el celular, con datos móviles— no descarga la síntesis
 *    de audio ambiente, las estadísticas ni el editor de presets, que no puede
 *    usar. Sólo baja lo que las dos vistas comparten más su propia rama.
 */
const App = lazy(() => import('./App'));
const RoomViewer = lazy(() => import('./components/rooms/RoomViewer').then((m) => ({ default: m.RoomViewer })));

const container = document.getElementById('root');
if (!container) throw new Error('Falta el elemento #root en index.html');

const roomId = roomIdFromUrl();

createRoot(container).render(
  <StrictMode>
    {/* Sin indicador de carga: el fondo ya está pintado por el CSS y ambas ramas
        resuelven en un par de cuadros. Un spinner que aparece y desaparece se ve
        peor que nada. */}
    <Suspense fallback={null}>{roomId ? <RoomViewer roomId={roomId} /> : <App />}</Suspense>
  </StrictMode>,
);
