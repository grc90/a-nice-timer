import type { AlarmId } from '@/types';
import { getAudioContext, unlockAudio as unlock } from './context';

export interface AlarmMeta {
  id: AlarmId;
  name: string;
  description: string;
}

export const ALARMS: readonly AlarmMeta[] = [
  { id: 'chime', name: 'Chime', description: 'Tres notas ascendentes, suave' },
  { id: 'bell', name: 'Bell', description: 'Campana con cola larga' },
  { id: 'marimba', name: 'Marimba', description: 'Percusivo, cálido' },
  { id: 'pulse', name: 'Pulse', description: 'Tres pulsos cortos, discreto' },
  { id: 'none', name: 'Silencio', description: 'Sólo aviso visual' },
] as const;

/**
 * Alarmas sintetizadas con Web Audio en vez de archivos de audio.
 *
 * Tres razones: no suma peso al bundle ni requests, suenan idénticas offline, y
 * — la que importa — se generan en el momento sin depender de que un <audio>
 * precargado sobreviva a la política de autoplay del navegador. Un <audio> que
 * nunca se tocó puede quedar bloqueado justo cuando el timer llega a cero.
 */

/** Receta de una alarma: cada nota es una parcial con su offset y envolvente. */
interface Note {
  /** Segundos desde el inicio de la alarma. */
  at: number;
  freq: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  /** Armónicos adicionales, como múltiplos de `freq`, para dar timbre. */
  overtones?: readonly { ratio: number; gain: number }[];
}

const RECIPES: Record<Exclude<AlarmId, 'none'>, readonly Note[]> = {
  chime: [
    { at: 0, freq: 523.25, duration: 1.4, type: 'sine', gain: 0.5 },
    { at: 0.16, freq: 659.25, duration: 1.4, type: 'sine', gain: 0.45 },
    { at: 0.32, freq: 783.99, duration: 1.8, type: 'sine', gain: 0.5 },
  ],
  bell: [
    {
      at: 0,
      freq: 440,
      duration: 3.2,
      type: 'sine',
      gain: 0.5,
      // Los múltiplos no enteros son lo que hace que suene a metal y no a flauta.
      overtones: [
        { ratio: 2.76, gain: 0.28 },
        { ratio: 5.4, gain: 0.14 },
        { ratio: 8.93, gain: 0.06 },
      ],
    },
  ],
  marimba: [
    { at: 0, freq: 587.33, duration: 0.5, type: 'sine', gain: 0.55, overtones: [{ ratio: 4, gain: 0.2 }] },
    { at: 0.18, freq: 880, duration: 0.5, type: 'sine', gain: 0.5, overtones: [{ ratio: 4, gain: 0.18 }] },
    { at: 0.36, freq: 1174.66, duration: 0.9, type: 'sine', gain: 0.45, overtones: [{ ratio: 4, gain: 0.15 }] },
  ],
  pulse: [
    { at: 0, freq: 880, duration: 0.12, type: 'triangle', gain: 0.4 },
    { at: 0.22, freq: 880, duration: 0.12, type: 'triangle', gain: 0.4 },
    { at: 0.44, freq: 880, duration: 0.2, type: 'triangle', gain: 0.4 },
  ],
};

/** Bus propio de la alarma, separado del de ambiente para que no compartan volumen. */
let alarmBus: GainNode | null = null;

function ensureBus(): { context: AudioContext; bus: GainNode } | null {
  const context = getAudioContext();
  if (!context) return null;

  if (!alarmBus) {
    alarmBus = context.createGain();
    alarmBus.gain.value = 1;
    alarmBus.connect(context.destination);
  }

  return { context, bus: alarmBus };
}

export { unlockAudio } from './context';

function scheduleNote(context: AudioContext, destination: GainNode, note: Note, startAt: number, volume: number): void {
  const partials = [{ ratio: 1, gain: 1 }, ...(note.overtones ?? [])];

  for (const partial of partials) {
    const osc = context.createOscillator();
    const env = context.createGain();

    osc.type = note.type;
    osc.frequency.value = note.freq * partial.ratio;

    const peak = note.gain * partial.gain * volume;
    const t0 = startAt + note.at;
    // Los armónicos altos decaen más rápido que la fundamental, igual que en un
    // instrumento real; sin esto la cola suena metálica y sintética.
    const decay = note.duration / Math.sqrt(partial.ratio);

    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(Math.max(peak * 0.0001, 0.00001), t0 + decay);

    osc.connect(env);
    env.connect(destination);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
}

/**
 * Reproduce una alarma.
 *
 * @param volume 0..1
 * @param repeats Veces que se repite la secuencia, espaciadas para que se note.
 */
export function playAlarm(id: AlarmId, volume = 0.8, repeats = 1): void {
  if (id === 'none' || volume <= 0) return;

  const audio = ensureBus();
  if (!audio) return;
  const { context, bus } = audio;

  // Si el contexto quedó suspendido (pestaña en background en algunos
  // navegadores) intentamos reanudar; puede resolver después del `start` pero
  // el scheduling relativo a currentTime se mantiene coherente.
  if (context.state === 'suspended') void context.resume();

  const recipe = RECIPES[id];
  const sequenceLength = Math.max(...recipe.map((n) => n.at + n.duration));

  for (let i = 0; i < repeats; i++) {
    const offset = context.currentTime + 0.02 + i * (sequenceLength + 0.4);
    for (const note of recipe) {
      scheduleNote(context, bus, note, offset, volume);
    }
  }
}

/** Vista previa desde el selector de alarmas: una sola pasada, sin repeticiones. */
export function previewAlarm(id: AlarmId, volume = 0.8): void {
  void unlock();
  playAlarm(id, volume, 1);
}
