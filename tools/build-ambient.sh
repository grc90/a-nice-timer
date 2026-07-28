#!/usr/bin/env bash
#
# Reconstruye los archivos de ambiente de public/ambient/ desde las grabaciones
# originales de Wikimedia Commons.
#
# Requiere ffmpeg y node en el PATH. Los originales no están en el repo: se bajan
# acá. Ver ATTRIBUTION.md por autores y licencias.
#
# Para cada ambiente: recorta el tramo estable, iguala loudness, arma un bucle sin
# costura (loopify.mjs) y codifica a AAC. Imprime al final los valores de
# loopStart/loopEnd que consume src/audio/ambient.ts.
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${TMPDIR:-/tmp}/ambient-build"
SRC="$WORK/src"
OUT="$HERE/../public/ambient"
RATE=44100
TARGET_LUFS=-23
XFADE=4
GUARD=0.25
UA="a-nice-timer/1.0 asset build"

# Techo de muestra. Deja margen para el sobrepaso que introduce el AAC al
# codificar y para la suma de varios canales en la mezcla.
#
# 0.6 y no más alto porque el pico *verdadero* (entre muestras) queda por encima
# del pico de muestra: con techo 0.7 la lluvia terminaba en +0.18 dBTP. Tampoco
# más bajo: recortar más genera más distorsión armónica, que a su vez aumenta el
# sobrepaso entre muestras, y con 0.5 el fuego empeoraba a +0.73 dBTP.
CEILING=0.6

mkdir -p "$SRC" "$WORK/tmp" "$OUT"

# archivoLocal | urlDeOrigen
SOURCES=(
  "rain-window.ogg|https://upload.wikimedia.org/wikipedia/commons/4/41/Rain_against_the_window.ogg"
  "waves.ogg|https://upload.wikimedia.org/wikipedia/commons/f/f1/Oceanwavescrushing.ogg"
  "fire.ogg|https://upload.wikimedia.org/wikipedia/commons/b/b1/Campfire_sound_ambience.ogg"
  "cafe.ogg|https://upload.wikimedia.org/wikipedia/commons/b/b5/Restaurant_ambience.ogg"
  "wind.ogg|https://upload.wikimedia.org/wikipedia/commons/f/f3/Wind_in_Swedish_pine_forest_at_25_mps.ogg"
)

echo "── descargando originales ──"
for row in "${SOURCES[@]}"; do
  IFS='|' read -r name url <<<"$row"
  if [ -s "$SRC/$name" ]; then echo "  $name (ya estaba)"; continue; fi
  # Wikimedia rechaza User-Agents con paréntesis y devuelve una página de error
  # de ~2 KB en lugar del audio, sin código de error.
  curl -sL --max-time 180 -A "$UA" -o "$SRC/$name" "$url" || { echo "  FALLO $name"; exit 1; }
  size=$(stat -c%s "$SRC/$name" 2>/dev/null || stat -f%z "$SRC/$name")
  if [ "$size" -lt 10000 ]; then echo "  FALLO $name: solo $size bytes"; exit 1; fi
  echo "  $name ($size bytes)"
done

# id | archivo | inicio | duracion | canales | largoBucle | bitrate | filtroEQ | gananciaFija
#
# Los recortes evitan los fundidos de entrada y salida de cada grabación, y en el
# fuego también los últimos 10 s, que bajan a silencio.
#
# Sin compresor ni limitador. La ganancia es estática y el control de picos lo
# hace loopify.mjs por muestra. Se probó comprimir el fuego para poder subirlo y
# empeora en los dos ejes a la vez: umbral -18/ratio 4 daba -30.4 LUFS y LRA 3.6,
# peor que los -27.9 LUFS con LRA 5.5 de la ganancia limpia.
#
# El fuego lleva ganancia fija en vez de apuntar a -23 LUFS porque su factor de
# cresta es de ~40 dB: un puñado de chasquidos aislados vive 40 dB por encima del
# promedio, así que llegar a -23 LUFS exigiría picos en +16 dBTP. Queda ~5 dB por
# debajo de los otros cuatro y src/audio/ambient.ts lo compensa con TRIM.
#
# EQ: la lluvia se grabó desde adentro y llega apagada en agudos; las olas tienen
# poco cuerpo abajo. El resto va sin tocar.
ASSETS=(
  "rain|rain-window.ogg|4.0|76|1|70|80k|highshelf=f=5000:g=2|"
  "waves|waves.ogg|2.0|118|2|112|128k|bass=f=150:g=4|"
  "fire|fire.ogg|9.0|39|1|35|80k|anull|18"
  "cafe|cafe.ogg|1.5|74|2|69.5|128k|anull|"
  "wind|wind.ogg|2.0|56|2|52|128k|anull|"
)

echo ""
echo "── construyendo ──"
for row in "${ASSETS[@]}"; do
  IFS='|' read -r id file ss dur ch loop br eq fixedGain <<<"$row"
  echo "==== $id ===="

  if [ -n "$fixedGain" ]; then
    gain="$fixedGain"
    echo "  ganancia fija=${gain} dB"
  else
    # Loudness del tramo exacto que se va a usar, ya con la EQ aplicada.
    # loudnorm imprime los valores entre comillas, de ahí el tr.
    measured=$(ffmpeg -hide_banner -nostats -ss "$ss" -t "$dur" -i "$SRC/$file" \
      -af "$eq,loudnorm=print_format=json" -f null - 2>&1 \
      | grep -o '"input_i"[^,]*' | tr -d '"' | grep -o '\-\?[0-9.]\+$')
    if [ -z "$measured" ]; then echo "  FALLO al medir loudness"; continue; fi
    gain=$(node -e "console.log((($TARGET_LUFS)-($measured)).toFixed(2))")
    echo "  medido=${measured} LUFS  ganancia=${gain} dB"
  fi

  # Ganancia estática, no loudnorm dinámico: este último comprimiría el vaivén de
  # las olas y las ráfagas del viento, que son justamente lo que hay que conservar.
  ffmpeg -hide_banner -loglevel error -y -ss "$ss" -t "$dur" -i "$SRC/$file" \
    -af "$eq,volume=${gain}dB" \
    -ac "$ch" -ar "$RATE" -f f32le "$WORK/tmp/$id.raw" || { echo "  FALLO decode"; continue; }

  node "$HERE/loopify.mjs" "$WORK/tmp/$id.raw" "$WORK/tmp/$id.loop.raw" \
    "$ch" "$loop" "$XFADE" "$GUARD" "$CEILING" || continue

  ffmpeg -hide_banner -loglevel error -y -f f32le -ar "$RATE" -ac "$ch" -i "$WORK/tmp/$id.loop.raw" \
    -c:a aac -b:a "$br" -movflags +faststart "$OUT/$id.m4a" || { echo "  FALLO encode"; continue; }

  kb=$(node -e "console.log((require('fs').statSync('$OUT/$id.m4a').size/1024).toFixed(0))")
  loopEnd=$(node -e "console.log(($GUARD + $loop).toFixed(2))")
  echo "  -> $id.m4a ${kb} KB   loopStart: $GUARD  loopEnd: $loopEnd"
done

echo ""
echo "Verificar con: ffmpeg -i public/ambient/<id>.m4a -af loudnorm=print_format=summary -f null -"
