# A Nice Timer

Temporizadores, Pomodoro y sesiones de concentración con skins temáticas.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run typecheck
```

## Estado

| Paso | Alcance | Estado |
|---|---|---|
| 1 | Timer base, persistencia local, atajos de teclado | ✅ |
| 2 | Pomodoro con fases automáticas + modo concentración | ✅ |
| 3 | Seis skins reactivas al progreso | ✅ |
| 4 | Audio (YouTube IFrame API + sonidos ambiente) | ✅ |
| 5 | Sistema de temas ampliado | ✅ base (5 paletas + claro/oscuro) |
| 6 | Autenticación y sincronización | pendiente |
| 7 | Estadísticas y metas | ✅ |
| 8 | Salas compartidas | pendiente |

## Arquitectura

### El timer no cuenta hacia atrás

Un `setInterval` que decrementa un contador acumula drift y se congela cuando el
navegador throttlea la pestaña — en mobile el timer se atrasaría minutos.

Acá el store guarda **`endsAt`**, un timestamp absoluto, y el tick sólo lee
`endsAt - Date.now()`. De ahí salen tres propiedades gratis:

- Cero drift, y la pestaña puede congelarse sin consecuencias.
- Al recargar, `endsAt` reconstruye el estado exacto sin estimar nada.
- Si `endsAt` ya pasó mientras la app estaba cerrada, se detecta y se ofrece
  retomar en vez de fingir que la sesión siguió corriendo.

Pausar congela `remainingMs` y borra `endsAt`; reanudar recalcula
`endsAt = Date.now() + remainingMs`. La invariante es que exactamente uno de los
dos es la fuente de verdad según el estado.

**Corolario deliberado:** si una fase vence con más de 30 s de overshoot (pestaña
congelada, usuario ausente), el Pomodoro **no** encadena la fase siguiente
automáticamente aunque esté configurado para hacerlo. Encadenar ahí registraría
tiempo de foco que nadie trabajó y ensuciaría las estadísticas del paso 7.

### Dos relojes

El store tickea a 200 ms, suficiente para `mm:ss`. Las skins animadas usan
`requestAnimationFrame` sobre `endsAt` mediante `useSmoothClock`, que mantiene
estado local — así 60 fps de arena cayendo no re-renderizan la app entera.

### Stores

| Store | Contenido | Persistencia |
|---|---|---|
| `settingsStore` | tema, paleta, skin, alarma, defaults de Pomodoro | completa (`ant:settings`) |
| `presetsStore` | sesiones guardadas, CRUD + duplicar | completa (`ant:presets`) |
| `timerStore` | runtime del timer | parcial (`ant:timer`) |
| `audioStore` | mezcla de ambiente, favoritos y recientes de YouTube | completa (`ant:audio`) |
| `statsStore` | registros de foco, rollup diario, metas | completa (`ant:stats`) |
| `uiStore` | modo concentración, modal abierto, panel de audio | ninguna |

Están separados por frecuencia de escritura: el runtime cambia 5 veces por
segundo y no debe reescribir los presets en cada tick. `lastEvent` queda fuera de
la persistencia a propósito — rehidratarlo dispararía la alarma de una sesión
vieja al abrir la app.

### Temas

Todo el color son variables CSS semánticas en `src/themes/theme.css`, bajo
selectores `[data-palette="X"][data-theme="Y"]`. Ningún componente conoce un
color literal. Agregar una paleta son tres cosas: un bloque en `theme.css`, una
entrada en `palettes.ts`, y el id en el tipo `PaletteId`.

Los valores van en oklch para que rotar el tono no altere la luminosidad
percibida — las cinco paletas quedan igual de contrastadas sin recalibrar cada
una a mano. Un script inline en `index.html` lee el tema guardado antes del
primer paint para evitar el flash de tema claro.

### Fondo de auroras

Cinco cortinas de luz cálida —ámbar, coral, dorado, magenta y rojo— que se cruzan
muy despacio. Es puro CSS; React monta la capa una vez y no la vuelve a tocar.

**Tiene que correr 90 minutos sin calentar el equipo**, así que:

- Se anima **sólo `transform`**, la única propiedad (con `opacity`) que el
  compositor resuelve en GPU sin repintar. Animar `background-position` sobre
  gradientes a pantalla completa —la forma habitual de hacer esto— repinta cada
  frame, y es lo que le dio mala fama a estos fondos.
- **Sin `filter: blur()`**: difuminar una capa de pantalla completa cuesta en cada
  frame, y el degradado hasta `transparent` de un gradiente radial ya da la misma
  suavidad gratis.
- `contain: strict` aísla la capa del layout del resto.

También se anima la opacidad, la otra propiedad que el compositor resuelve sin
repintar: una cortina que se enciende y se apaga es la mitad del efecto, y sólo
con desplazamiento el fondo parece un gradiente arrastrándose.

Los ciclos duran 19, 23, 29, 31 y 37 segundos — primos entre sí, así que el patrón
combinado tarda horas en repetirse y nunca se percibe un loop.

**Es una app de foco, así que el fondo se aparta.** Una máscara radial vacía el
centro de la pantalla: la luz vive en los bordes y nunca le resta contraste al
timer.

**Los tonos salen de la paleta activa.** Cada paleta define sus cinco: cuatro
análogos al acento más uno cálido de contrapunto. Ese quinto es el que da
profundidad — sin él, cuatro vecinos del mismo tono se funden en una mancha y se
pierde el efecto de cortinas cruzándose. En oscuro se mezclan en `screen` para que
sumen luz como una aurora real; en claro eso las borraría (sumar luz sobre blanco
da blanco), así que van normales y más tenues.

**El movimiento es un ajuste propio, no herencia de `prefers-reduced-motion`.** En
Windows esa preferencia se activa al apagar los efectos de animación del sistema,
algo que mucha gente hace por rendimiento sin querer un fondo congelado. El resto
de la interfaz obedece al sistema sin excepción; sólo este elemento decorativo
admite una decisión explícita, y Ajustes avisa cuando está sobreescribiendo la
preferencia. Con el movimiento apagado las bandas no se apilan en su posición de
reposo: hay una composición estática puesta a mano que se ve bien quieta.

### Skins

Contrato único en `skins/types.ts`: reciben `{ progress, remainingMs, totalMs,
phase, status, reducedMotion }` y **no tienen acceso al store**. No pueden mutar
el timer, así que cambiar de skin no puede romper una sesión en curso — la
garantía es estructural, no una convención.

Agregar una skin: un componente que cumpla `SkinProps`, el id en `SkinId`, una
entrada en `registry.ts`. Nada más cambia.

Las seis actuales — anillo, digital, analógico, reloj de arena, fases lunares,
reloj de sol — derivan su geometría del progreso real. Dos detalles que importan:
la altura de la arena es √(volumen restante) porque el bulbo es triangular (con
altura lineal el caudal se vería acelerando al final), y el terminador lunar es
una semielipse de semieje `r·|1−2k|`, la geometría real de una fase.

### Audio

Un único `AudioContext` compartido (`audio/context.ts`) para alarmas y ambiente:
los navegadores limitan cuántos puede abrir una página, y el desbloqueo por gesto
de usuario vale para el contexto entero. `unlockAudio()` se llama en el click de
iniciar, que es el único gesto garantizado — un `<audio>` precargado que nunca se
tocó puede quedar bloqueado por la política de autoplay justo cuando el timer
llega a cero.

**Alarmas** (`audio/alarm.ts`) son síntesis: cero peso en el bundle y ningún
archivo que pueda faltar cuando el timer llega a cero.

**Ambiente** (`audio/ambient.ts`) son grabaciones de campo reales. Antes también
era síntesis, y el problema fue que los seis compartían una sola arquitectura
—ruido, un biquad de Q bajo, un LFO lento— con las bandas solapadas: olas y viento
terminaban siendo casi el mismo patch, y ninguno se despegaba de "siseo de banda
ancha con un bulto". Lo que identifica un ambiente son sus eventos discretos
—gotas sueltas, el silbido de una ráfaga— y esos no salen de un filtro. Fuego y
café eran los únicos que se distinguían, y no por casualidad: eran los únicos con
eventos programados encima del lecho.

El **ruido blanco** sigue sintetizado. Es aleatorio por definición, así que un
archivo no aportaría nada, y el ruido es el peor caso para un códec con pérdida.

Los cinco archivos (`public/ambient/`, 4.7 MB en AAC) se generan con
`tools/build-ambient.sh` desde originales de Wikimedia Commons: recorte del tramo
estable, loudness igualado a −23 LUFS para que los faders se sientan parejos, y
bucle armado por solapamiento para que el salto caiga entre dos muestras que ya
eran vecinas en la grabación. Cada archivo lleva 0.25 s de guarda a cada lado
—`loopStart`/`loopEnd` dejan afuera las muestras de relleno que agrega el
decodificador AAC, que si entraran al bucle sonarían como un clic por vuelta.
Autores y licencias en [ATTRIBUTION.md](ATTRIBUTION.md); `wind.m4a` es el único
con share-alike.

Seis ambientes combinables (lluvia, olas, fuego, café, viento, ruido blanco),
cada uno con su fader. Los canales se **desmontan** al llegar a cero en vez de
quedar en silencio: una fuente girando sin que nadie la escuche cuesta CPU y
batería. El `AudioBuffer` decodificado queda en caché, así que volver a encender
un canal no vuelve a descargar. Las rampas de 0.5 s evitan el clic al cortar.

**YouTube** usa la IFrame API con carga diferida: el script de terceros (~100 kB)
sólo baja cuando el usuario abre el panel por primera vez. El iframe se monta en
un nodo creado a mano fuera del árbol de React, porque YouTube *reemplaza* el
elemento que recibe y React tiraría `removeChild` al desmontar un hijo que ya no
existe.

**Límite conocido:** en mobile, el navegador suspende el `AudioContext` cuando la
pestaña pasa a segundo plano. El ambiente se corta al bloquear la pantalla y
vuelve al primer plano. Mitigado en parte por el Wake Lock (la pantalla no se
apaga durante una sesión), pero resolverlo del todo requiere un service worker
con Media Session, que no está implementado.

### Estadísticas

**La unidad de registro es el bloque de foco, no la sesión.** Un Pomodoro de
cuatro ciclos deja cuatro registros. Cada entrada es atómica —no hay filas "en
curso" que actualizar— y una sesión abandonada conserva lo que sí se trabajó.

Detener o reiniciar a mano **también registra** el foco hecho, si superó un
minuto. Sin eso, un bloque de foco libre de 90 minutos que se corta a los 70 no
dejaría rastro, y el histórico sólo premiaría a quien aguanta la fase entera —
que no es lo que la app quiere medir.

**Dos capas de almacenamiento.** Los registros crudos se podan a los 2000 (unos
seis meses de detalle), pero el rollup diario —40 bytes por día, nunca podado—
conserva la historia completa. El gráfico y la racha siguen exactos para siempre;
lo único que se pierde con el tiempo es el desglose por preset de hace medio año.

**La racha no se corta a las 00:01.** Si hoy todavía no hay foco registrado, se
cuenta desde ayer. Romperla por no haber empezado aún es el error clásico de este
cálculo. `activeToday` distingue "viva pero sin extender" de "ya extendida".

Las claves de día son locales, no UTC: una sesión de las 22 h pertenece a ese día
para el usuario, y `toISOString()` partiría las noches en dos.

**Decisiones de visualización.** Una sola serie en el gráfico diario, así que un
solo color y sin leyenda — el título ya dice qué se mide. Sin degradado por valor:
la altura de la columna ya codifica la magnitud. Las barras de distribución van
todas del mismo color porque tipos de sesión y presets no tienen orden natural que
justifique una rampa. La pista del medidor es un paso más claro del mismo tono, no
un gris, para que el estado se lea a lo largo del anillo entero. Sólo el máximo
lleva etiqueta directa; el resto vive en el hover y en la vista de tabla, que es
además la ruta accesible.

## Estructura

```
src/
├── audio/        context.ts · alarm.ts · ambient.ts · youtube.ts
├── components/   layout/ · timer/ · presets/ · focus/ · audio/ · stats/ · settings/ · ui/
├── hooks/        useTimerEngine · useSmoothClock · useKeyboardShortcuts
│                 useWakeLock · useTheme · useMediaQuery · useAmbientSync
├── skins/        registry.ts + 6 skins + geometry.ts
├── store/        timerStore · presetsStore · settingsStore · audioStore
│                 statsStore · uiStore
├── themes/       palettes.ts · theme.css
├── types/        timer.ts · theme.ts · stats.ts
└── utils/        time · id · cn · notifications
```

## Atajos

`Espacio` iniciar/pausar · `R` reiniciar · `S` detener · `N` fase siguiente ·
`↑`/`↓` ±1 min · `F` modo concentración · `A` panel de audio · `K` cambiar skin ·
`T` tema · `Esc` salir · `?` ver todos

Se desactivan mientras hay foco en un campo de texto, y los que tocan el timer se
desactivan con un modal abierto. `Esc` cierra una capa por pulsación: primero el
modal, después el panel de audio, después el modo concentración.

## Backend elegido para los pasos 6 y 8: Supabase

**Tradeoff frente a Firebase.**

Firebase gana en dos puntos: Google Sign-In es más corto de implementar, y
Realtime Database es más barata y de menor latencia para presencia pura, que es
justo lo que necesitan las salas compartidas del paso 8.

Supabase gana en el que pesa más acá: **las estadísticas del paso 7 son un
problema relacional**. «Tiempo de foco por semana agrupado por preset» es una
consulta SQL con `GROUP BY` y `date_trunc`. En Firestore hay que desnormalizar y
mantener contadores agregados a mano en cada escritura, y cada corte nuevo que se
quiera mirar obliga a rellenar históricos. Sumado a que es open source,
self-hosteable y sin lock-in fuerte, la decisión es Supabase.

Contras asumidos: el free tier pausa proyectos inactivos tras ~1 semana, y
Realtime tiene algo más de latencia que RTDB — irrelevante para mostrar un timer
que se refresca por segundo.

**Plan de implementación.**

- **Paso 6** — `@supabase/supabase-js`. Auth con email/password + Google OAuth.
  Tablas `presets`, `sessions`, `goals`, `user_settings`, todas con Row Level
  Security por `auth.uid()`. Los ids ya se generan como UUID en el cliente
  (`utils/id.ts`), así que la migración desde el modo invitado es un `insert`
  masivo sin remapear referencias.
- **Paso 8** — Supabase Realtime con canales de broadcast. El host publica
  `{ phase, endsAt, status }` en cada transición, no cada segundo: como el
  invitado recibe `endsAt` absoluto, calcula su propia cuenta regresiva
  localmente. La sala consume unos pocos mensajes por sesión en vez de uno por
  segundo, y no necesita cuenta para leer.
```
