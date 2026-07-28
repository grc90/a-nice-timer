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
| 6 | Autenticación y sincronización | ✅ |
| 7 | Estadísticas y metas | ✅ |
| 8 | Salas compartidas | ✅ |

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
| `authStore` | sesión y estado de sincronización | la maneja Supabase |
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

### Nube (Supabase)

**localStorage sigue siendo la fuente de verdad de la app corriendo; Supabase es
un espejo.** No al revés. Esa es la condición para que el modo invitado sea una
función real y no un estado degradado: la app nunca espera a la red para
responder, y perder la conexión no cambia nada de lo que se ve.

**No hay una regla única de conflictos, porque las entidades no se comportan
igual:**

| Entidad | Resolución |
|---|---|
| Presets | última escritura gana por `updatedAt`; los borrados viajan como lápidas |
| Registros de foco | append-only ⇒ unión por id, **no puede haber conflicto** |
| Totales diarios | no se sincronizan: los recalcula el servidor con SQL |
| Ajustes y metas | gana lo remoto si existe; si no, se sube lo local (migración) |

**Lápidas en vez de DELETE.** Borrar pone `deleted_at`, no saca la fila. Sin eso,
borrar un preset en la compu y abrir el celular después lo resucitaría: el celular
sólo vería una fila remota que le falta, sin forma de distinguir "esto se borró" de
"esto todavía no lo recibí".

**`focus_records` es la tabla de hechos y los totales se calculan, no se
guardan.** Sumar dos rollups de dos dispositivos duplicaría el tiempo en cada
sincronización. Con los registros crudos del lado del servidor el agregado es una
consulta (`daily_focus_totals`) y siempre da exacto — era el argumento para elegir
Postgres sobre Firestore, y acá se cobra.

**El SDK se carga a demanda.** `@supabase/supabase-js` pesa ~56 kB comprimidos y el
modo invitado no lo usa nunca; con un import estático, alguien que abre la app a
poner cinco minutos pagaría por un cliente de base de datos que no va a tocar. El
chunk baja recién al intentar iniciar sesión, así que el bundle de entrada se
mantiene en ~98 kB gzip.

`updated_at` lo escribe un trigger del servidor, no el cliente: con resolución por
última escritura, un reloj de navegador desfasado decidiría mal los conflictos.

### Salas compartidas (body doubling)

El host genera un link; quien lo abre ve la fase y el tiempo restante en vivo,
**sin cuenta**. Sólo visualización: nada de chat ni de controles compartidos.

**El invitado no recibe el tiempo restante: recibe `endsAt` y lo calcula.** De ahí
sale todo lo demás. El host publica sólo en las transiciones estructurales —fase,
estado, `endsAt`, duración, skin— y nunca por el paso del tiempo, así que una
sesión Pomodoro de dos horas se sincroniza con unos **diez mensajes** en lugar de
siete mil. Y el reloj del invitado sigue corriendo bien aunque se caiga el canal,
porque no depende del canal para avanzar, sólo para enterarse de un cambio de fase.

**Tres mecanismos, porque ninguno alcanza solo:**

| Mecanismo | Resuelve |
|---|---|
| Broadcast de Realtime | actualizaciones instantáneas |
| Snapshot en la tabla, leído al entrar | el invitado que llega en el minuto 12 de un bloque de foco y no vería nada hasta la próxima transición |
| Sondeo cada 25 s | el WebSocket que se cae en silencio, habitual en redes móviles |

**La privacidad es una decisión explícita del esquema.** La tabla `rooms` **no** es
legible por `anon`: la lectura pasa por `get_shared_room`, una función
`security definer` que devuelve columnas enumeradas a mano y nunca el `user_id` del
dueño. RLS no puede filtrar por columna, así que abrir un `select` anónimo sobre la
tabla expondría más de lo necesario y crecería solo al agregar columnas. El id de la
sala *es* el token de invitación: un uuid v4 son 122 bits, adivinarlo no es una vía
realista.

**La vista de invitado es de sólo lectura por construcción, no por convención.** El
ruteo vive en `main.tsx`, así que el árbol del espectador no monta el motor del
timer, ni el sync, ni el audio — no existe la ruta de código por la que podría
alterar la sesión del host. Verificado en el bundle: `ant:timer`, `ant:presets`,
`ant:stats`, `ant:audio` y las recetas de audio ambiente aparecen **sólo** en el
chunk de `App`.

Y renderiza la skin del host pasándole props calculadas — que es exactamente lo que
el contrato `SkinProps` sin acceso al store hizo posible desde el paso 3.

## Puesta en marcha de la nube

1. Copiá `.env.example` a `.env.local` y completá `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY`. Sin esas variables la app arranca igual, en modo
   invitado.
2. Pegá `supabase/schema.sql` entero en el SQL Editor del proyecto y ejecutalo. Es
   idempotente: se puede volver a correr.
3. Para el acceso con Google, habilitá el proveedor en *Authentication →
   Providers → Google* y agregá `http://localhost:5173` y tu dominio de producción
   en *Authentication → URL Configuration → Redirect URLs*. Mientras esté
   deshabilitado, el botón muestra un mensaje explicándolo y email/contraseña
   sigue funcionando.

## Publicar

Es una SPA estática más Supabase: no hay servidor propio, sólo archivos. Cualquier
hosting estático sirve — hay un `vercel.json` listo con reescritura SPA, cabeceras
de caché y cabeceras de seguridad.

**HTTPS es obligatorio, no una mejora.** Notificaciones, Wake Lock y portapapeles
sólo funcionan en contexto seguro. `localhost` está exento por decisión del
navegador; un dominio por HTTP plano rompe las tres funciones en silencio.

### Vercel

```bash
npm i -g vercel
vercel            # primera vez: crea el proyecto
vercel --prod     # publica
```

Las variables van en el dashboard (*Settings → Environment Variables*), **no** en
el repo: `.env.local` está en `.gitignore`, y como Vite las inlinea en tiempo de
build tienen que existir en el entorno del build o el bundle sale sin ellas y la
app arranca en modo invitado permanente.

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

### Caché de los sonidos ambiente

`vercel.json` les da una regla propia. Los `.m4a` viven en `public/`, así que Vite
no les pone hash en el nombre y **no pueden ser `immutable`**: si el contenido
cambia, el nombre sigue igual y el navegador serviría el viejo para siempre. Van
con una semana de caché firme más un mes sirviendo el viejo mientras revalida de
fondo — son ~4,8 MB, el 90 % del deploy, y no conviene rebajarlos seguido.

Si los regenerás con `tools/build-ambient.sh`, o les cambiás el nombre o esperás
la semana.

(El esquema de `vercel.json` no admite una clave `comment` dentro de `headers`, y
JSON no tiene comentarios: por eso esta explicación vive acá y no en el archivo.)

### Otros hosts

| Host | Config equivalente |
|---|---|
| Cloudflare Pages | build `npm run build`, salida `dist`; el fallback SPA es automático |
| Netlify | `_redirects` con `/*  /index.html  200` |
| GitHub Pages | necesita `base` en `vite.config.ts` si es project page, y un workflow para inyectar las variables |

### Después de publicar: dos cosas en Supabase

En *Authentication → URL Configuration*:

- **Site URL** → tu dominio de producción
- **Redirect URLs** → agregá `https://tu-dominio/**` **sin borrar** el de
  `localhost`, o se rompe el login en desarrollo

En Google Cloud **no hay que tocar nada**: la URI de retorno registrada allá apunta
al callback de Supabase, no a tu dominio. Supabase es el que redirige después.

### Sobre las salas compartidas

Los links que genere el host usan `window.location.origin`, así que en producción
salen con el dominio real automáticamente. Un link creado en `localhost` sólo
funciona en esa máquina — es esperable, no un bug.

## Estructura

```
src/
├── audio/        context.ts · alarm.ts · ambient.ts · youtube.ts
├── components/   layout/ · timer/ · presets/ · focus/ · audio/ · stats/
│                 auth/ · settings/ · ui/
├── hooks/        useTimerEngine · useSmoothClock · useKeyboardShortcuts
│                 useWakeLock · useTheme · useMediaQuery · useAmbientSync
│                 useCloudSync
├── lib/          supabase.ts
├── rooms/        roomClient.ts · types.ts
├── skins/        registry.ts + 6 skins + geometry.ts
├── store/        timerStore · presetsStore · settingsStore · audioStore
│                 statsStore · authStore · roomStore · uiStore
├── sync/         mappers.ts · syncEngine.ts
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
