/**
 * Convierte PCM f32le crudo en un bucle sin costura por solapamiento.
 *
 * uso: node loopify.mjs <in.raw> <out.raw> <canales> <segundosBucle> <segundosCruce> <segundosGuarda> [techo]
 *
 * El cuerpo del bucle B de largo P se construye cruzando sus primeros X segundos
 * con los X segundos que siguen a P en la fuente. Con eso B[0] sale de la muestra
 * que en la grabación original venía justo después de B[P-1], así que el salto del
 * bucle cae entre dos muestras que ya eran vecinas y no hay discontinuidad.
 *
 * Las curvas del cruce son raíz cuadrada (potencia constante), no lineales: para
 * señales tipo ruido, que no están correlacionadas, un cruce lineal produce un
 * bajón de ~3 dB en el medio del solapamiento.
 *
 * Alrededor del cuerpo se agregan guardas: el archivo final es
 *   [cola de B, G seg][B completo, P seg][cabeza de B, G seg]
 * La guarda inicial absorbe las muestras de relleno que agrega el decodificador
 * AAC (~50 ms), que si cayeran dentro de la región del bucle meterían un clic.
 *
 * El control de picos se hace acá y no con `alimiter` de ffmpeg a propósito. Un
 * limitador trabaja en el tiempo: al pisar un pico agacha también los ~50 ms que
 * lo rodean. En estas grabaciones los picos son muestras sueltas —en el fuego, 12
 * ms sobre -20 dBFS en 39 segundos— así que un limitador temporal deforma miles
 * de veces más audio del que hace falta. El recorte suave de acá es instantáneo:
 * es la identidad por debajo del codo y solo dobla las muestras que se pasan.
 *
 * (Cuidado si se vuelve a `alimiter`: trae `level` activado por defecto, que
 * renormaliza la salida a 0 dBFS y anula cualquier normalización previa.)
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath, chStr, loopStr, xfadeStr, guardStr, ceilStr] = process.argv;
const RATE = 44100;
const ch = Number(chStr);
const framesP = Math.round(Number(loopStr) * RATE);
const framesX = Math.round(Number(xfadeStr) * RATE);
const framesG = Math.round(Number(guardStr) * RATE);
const CEIL = Number(ceilStr ?? 0.6);
const KNEE = CEIL * 0.7;

const src = new Float32Array(readFileSync(inPath).buffer.slice(0));
const srcFrames = Math.floor(src.length / ch);

if (srcFrames < framesP + framesX) {
  throw new Error(`fuente corta: ${srcFrames} frames, se necesitan ${framesP + framesX}`);
}

// Cuerpo del bucle con el solapamiento aplicado.
const body = new Float32Array(framesP * ch);
for (let i = 0; i < framesP; i++) {
  if (i < framesX) {
    const w = i / framesX;
    const gIn = Math.sqrt(w);
    const gOut = Math.sqrt(1 - w);
    for (let c = 0; c < ch; c++) {
      body[i * ch + c] = src[i * ch + c] * gIn + src[(framesP + i) * ch + c] * gOut;
    }
  } else {
    for (let c = 0; c < ch; c++) body[i * ch + c] = src[i * ch + c];
  }
}

/**
 * Recorte suave: identidad hasta el codo, luego se curva hacia el techo sin
 * alcanzarlo nunca. Al ser puntual no arrastra a las muestras vecinas.
 */
let clipped = 0;
for (let i = 0; i < body.length; i++) {
  const x = body[i];
  const a = Math.abs(x);
  if (a <= KNEE) continue;
  clipped++;
  body[i] = Math.sign(x) * (KNEE + (CEIL - KNEE) * Math.tanh((a - KNEE) / (CEIL - KNEE)));
}
console.log(
  `  recorte: ${clipped} muestras (${((clipped / body.length) * 100).toFixed(4)}%) sobre ` +
    `${(20 * Math.log10(KNEE)).toFixed(1)} dBFS, techo ${(20 * Math.log10(CEIL)).toFixed(1)} dBFS`,
);

const out = new Float32Array((framesG + framesP + framesG) * ch);
out.set(body.subarray((framesP - framesG) * ch, framesP * ch), 0);
out.set(body, framesG * ch);
out.set(body.subarray(0, framesG * ch), (framesG + framesP) * ch);

writeFileSync(outPath, Buffer.from(out.buffer));

// Verificación: discontinuidad en el salto del bucle comparada con la variación
// típica entre muestras vecinas. Si el salto no sobresale, el bucle es limpio.
let jump = 0;
for (let c = 0; c < ch; c++) jump += Math.abs(body[(framesP - 1) * ch + c] - body[c]);

const deltas = [];
for (let i = 1; i < framesP; i += 37) {
  let s = 0;
  for (let c = 0; c < ch; c++) s += Math.abs(body[i * ch + c] - body[(i - 1) * ch + c]);
  deltas.push(s);
}
deltas.sort((a, b) => a - b);
let lo = 0;
let hi = deltas.length - 1;
while (lo < hi) {
  const m = (lo + hi) >> 1;
  if (deltas[m] < jump) lo = m + 1;
  else hi = m;
}
const percentile = (lo / deltas.length) * 100;

console.log(
  `  bucle=${(framesP / RATE).toFixed(2)}s guarda=${(framesG / RATE).toFixed(2)}s ` +
    `costura=p${percentile.toFixed(0)} ${percentile < 99 ? 'OK' : 'REVISAR'}`,
);
