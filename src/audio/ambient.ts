import { getAudioContext } from './context';

export type AmbientId = 'rain' | 'waves' | 'fire' | 'cafe' | 'wind' | 'white';

export interface AmbientMeta {
  id: AmbientId;
  name: string;
  description: string;
}

export const AMBIENTS: readonly AmbientMeta[] = [
  { id: 'rain', name: 'Lluvia', description: 'Repiqueteo contra el vidrio, grabado desde adentro' },
  { id: 'waves', name: 'Olas', description: 'Rompiente de mar abierto' },
  { id: 'fire', name: 'Fuego', description: 'Brasas de fogata con chisporroteo' },
  { id: 'cafe', name: 'Café', description: 'Murmullo de salón y loza ocasional' },
  { id: 'wind', name: 'Viento', description: 'Ráfagas en un pinar' },
  { id: 'white', name: 'Ruido blanco', description: 'Plano y sin textura, para tapar todo' },
] as const;

export const AMBIENT_IDS = AMBIENTS.map((a) => a.id);

/** Tiempo de fundido al subir o bajar un canal. Evita el clic al cortar de golpe. */
const FADE_S = 0.5;

// ── Grabaciones ─────────────────────────────────────────────────────────────

/**
 * Cinco de los seis ambientes son grabaciones de campo reales.
 *
 * Antes eran síntesis —ruido filtrado con osciladores lentos encima— y el
 * problema era que los seis compartían la misma arquitectura: ruido, un biquad de
 * Q bajo y un LFO. Con bandas solapadas y sin transitorios propios, olas y viento
 * terminaban siendo casi el mismo sonido, y ninguno se distinguía de "siseo con un
 * bulto". Lo que identifica un ambiente son sus eventos discretos, y esos no
 * salen de un filtro.
 *
 * El ruido blanco sigue sintetizado: es aleatorio por definición, un archivo no
 * aportaría nada y el ruido es el peor caso para un códec con pérdida.
 *
 * Cada archivo está preparado para repetirse sin costura (ver
 * `tools/build-ambient.sh`): el cuerpo del bucle se armó por solapamiento, así que
 * la última muestra antes del salto y la primera después son muestras adyacentes
 * de la grabación original.
 */
interface SampleSpec {
  file: string;
  /**
   * Región a repetir. No arranca en 0 a propósito: el decodificador AAC agrega
   * unas muestras de relleno al principio, y si el bucle las incluyera se
   * escucharía un clic en cada vuelta. Los archivos traen 0.25 s de guarda a cada
   * lado justamente para dejarlas afuera.
   */
  loopStart: number;
  loopEnd: number;
}

const SAMPLES: Record<Exclude<AmbientId, 'white'>, SampleSpec> = {
  rain: { file: 'rain.m4a', loopStart: 0.25, loopEnd: 70.25 },
  waves: { file: 'waves.m4a', loopStart: 0.25, loopEnd: 112.25 },
  fire: { file: 'fire.m4a', loopStart: 0.25, loopEnd: 35.25 },
  cafe: { file: 'cafe.m4a', loopStart: 0.25, loopEnd: 69.75 },
  wind: { file: 'wind.m4a', loopStart: 0.25, loopEnd: 52.25 },
};

/**
 * Compensación de nivel por canal.
 *
 * Los archivos se normalizaron todos a -23 LUFS para que los faders se sientan
 * parejos, menos el fuego: su grabación tiene un factor de cresta de ~40 dB
 * —chasquidos aislados muy por encima del promedio— así que llegar a -23 LUFS
 * habría exigido picos fuera de escala. Quedó en -27.9 LUFS y se recupera acá.
 */
const TRIM: Partial<Record<AmbientId, number>> = {
  fire: 1.5,
};

const buffers = new Map<AmbientId, AudioBuffer>();
const loading = new Map<AmbientId, Promise<AudioBuffer | null>>();

function assetUrl(file: string): string {
  // BASE_URL y no una ruta absoluta: si la app se sirve desde un subdirectorio,
  // '/ambient/x.m4a' apuntaría a la raíz del dominio y no al de la app.
  return `${import.meta.env.BASE_URL}ambient/${file}`;
}

function loadBuffer(context: AudioContext, id: Exclude<AmbientId, 'white'>): Promise<AudioBuffer | null> {
  const cached = buffers.get(id);
  if (cached) return Promise.resolve(cached);

  // Deduplicación: subir y bajar el fader antes de que termine la descarga no
  // debe disparar una segunda.
  const inFlight = loading.get(id);
  if (inFlight) return inFlight;

  const promise = fetch(assetUrl(SAMPLES[id].file))
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      buffers.set(id, buffer);
      return buffer;
    })
    .catch((error: unknown) => {
      // El canal queda en silencio pero la app sigue andando: el ambiente es
      // accesorio y no vale la pena romper el timer por un archivo que no cargó.
      console.error(`[ambient] no se pudo cargar ${id}:`, error);
      return null;
    })
    .finally(() => {
      loading.delete(id);
    });

  loading.set(id, promise);
  return promise;
}

/** Ruido blanco sintetizado, el único canal que no es una grabación. */
let whiteBuffer: AudioBuffer | null = null;

function getWhiteBuffer(context: AudioContext): AudioBuffer {
  if (whiteBuffer) return whiteBuffer;

  const length = Math.floor(context.sampleRate * 6);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;

  whiteBuffer = buffer;
  return buffer;
}

// ── Canales ─────────────────────────────────────────────────────────────────

interface Channel {
  /** Fader del canal. Todo lo que suene debe pasar por acá. */
  gain: GainNode;
  source: AudioBufferSourceNode;
}

function buildChannel(context: AudioContext, id: AmbientId, buffer: AudioBuffer, out: GainNode): Channel {
  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(out);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  if (id === 'white') {
    // El ruido blanco puro es fatigante después de veinte minutos, que es justo
    // cuánto dura una sesión.
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 9000;
    source.connect(filter).connect(gain);
    source.start();
    return { gain, source };
  }

  const spec = SAMPLES[id as Exclude<AmbientId, 'white'>];
  source.loopStart = spec.loopStart;
  source.loopEnd = spec.loopEnd;
  source.connect(gain);

  // Arranque en un punto al azar del bucle: encender el mismo canal dos veces no
  // debería empezar siempre por el mismo segundo de grabación.
  const offset = spec.loopStart + Math.random() * (spec.loopEnd - spec.loopStart);
  source.start(0, offset);

  return { gain, source };
}

// ── Motor ───────────────────────────────────────────────────────────────────

class AmbientEngine {
  private bus: GainNode | null = null;
  private channels = new Map<AmbientId, Channel>();
  /**
   * Volumen pedido por canal, incluso mientras el archivo todavía se descarga.
   * Sin esto, una carga que termina después de que el usuario bajó el fader
   * arrancaría un canal que ya nadie quiere escuchar.
   */
  private desired = new Map<AmbientId, number>();
  private masterVolume = 0.7;

  private ensureBus(context: AudioContext): GainNode {
    if (!this.bus) {
      this.bus = context.createGain();
      this.bus.gain.value = this.masterVolume;
      this.bus.connect(context.destination);
    }
    return this.bus;
  }

  /**
   * Ajusta el volumen de un canal. Un volumen de 0 lo desmonta del todo tras el
   * fundido: dejar una fuente girando en silencio consume CPU y batería sin que
   * nadie la escuche. El AudioBuffer decodificado queda en caché, así que volver
   * a encenderlo no vuelve a descargar ni decodificar.
   */
  setVolume(id: AmbientId, volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume));
    this.desired.set(id, clamped);

    const context = getAudioContext();
    if (!context) return;

    const existing = this.channels.get(id);

    if (clamped <= 0) {
      if (existing) this.teardown(id, existing, context);
      return;
    }

    if (existing) {
      this.ramp(existing.gain, this.targetGain(id, clamped), context);
      return;
    }

    if (id === 'white') {
      this.mount(context, id, getWhiteBuffer(context), clamped);
      return;
    }

    void loadBuffer(context, id).then((buffer) => {
      if (!buffer) return;
      // El fader pudo moverse mientras se descargaba.
      const wanted = this.desired.get(id) ?? 0;
      if (wanted <= 0 || this.channels.has(id)) return;
      this.mount(context, id, buffer, wanted);
    });
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.min(1, Math.max(0, volume));
    const context = getAudioContext();
    if (!context || !this.bus) return;
    this.ramp(this.bus, this.masterVolume, context, 0.12);
  }

  /**
   * Desmonta todos los canales. El motor no recuerda la mezcla a propósito: la
   * guarda el store, que es quien la persiste, así no hay dos copias del mismo
   * dato que puedan quedar desincronizadas.
   */
  stopAll(): void {
    const context = getAudioContext();
    if (!context) return;
    this.desired.clear();
    for (const [id, channel] of this.channels) this.teardown(id, channel, context);
  }

  private mount(context: AudioContext, id: AmbientId, buffer: AudioBuffer, volume: number): void {
    const channel = buildChannel(context, id, buffer, this.ensureBus(context));
    this.channels.set(id, channel);
    this.ramp(channel.gain, this.targetGain(id, volume), context);
  }

  private targetGain(id: AmbientId, volume: number): number {
    return volume * (TRIM[id] ?? 1);
  }

  private ramp(node: GainNode, target: number, context: AudioContext, seconds = FADE_S): void {
    const now = context.currentTime;
    node.gain.cancelScheduledValues(now);
    // setValueAtTime fija el punto de partida: sin esto la rampa arrancaría
    // desde el último valor *programado* y no desde el que suena ahora.
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(target, now + seconds);
  }

  private teardown(id: AmbientId, channel: Channel, context: AudioContext): void {
    this.channels.delete(id);
    this.ramp(channel.gain, 0, context);

    // Se frena después del fundido, no durante: cortar la fuente en medio de la
    // rampa produce el clic que la rampa venía a evitar.
    try {
      channel.source.stop(context.currentTime + FADE_S + 0.05);
    } catch {
      // Ya detenida.
    }

    window.setTimeout(() => channel.gain.disconnect(), (FADE_S + 0.3) * 1000);
  }
}

export const ambientEngine = new AmbientEngine();
