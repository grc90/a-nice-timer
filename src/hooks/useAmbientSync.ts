import { useEffect } from 'react';
import { useAudioStore } from '@/store/audioStore';
import { ambientEngine } from '@/audio/ambient';
import { AMBIENT_IDS } from '@/audio/ambient';

/**
 * Puente entre el store y el motor de audio.
 *
 * El store es la fuente de verdad declarativa —una mezcla es un objeto de
 * volúmenes— y el motor es imperativo. Este hook sincroniza uno con el otro en
 * un solo lugar, así ningún componente termina llamando al motor por su cuenta y
 * desincronizando la UI del sonido real.
 *
 * Se monta una única vez, en la raíz.
 */
export function useAmbientSync(): void {
  useEffect(() => {
    // `subscribe` en vez de un efecto por canal: evita seis suscripciones y deja
    // la comparación de la mezcla en un solo sitio.
    let previous = useAudioStore.getState();

    const applyMix = (state: typeof previous) => {
      const muted = state.ambientMuted;
      for (const id of AMBIENT_IDS) {
        ambientEngine.setVolume(id, muted ? 0 : state.mix[id]);
      }
    };

    ambientEngine.setMasterVolume(previous.ambientMaster);
    applyMix(previous);

    const unsubscribe = useAudioStore.subscribe((state) => {
      if (state.ambientMaster !== previous.ambientMaster) {
        ambientEngine.setMasterVolume(state.ambientMaster);
      }

      const mixChanged = AMBIENT_IDS.some((id) => state.mix[id] !== previous.mix[id]);
      if (mixChanged || state.ambientMuted !== previous.ambientMuted) {
        applyMix(state);
      }

      previous = state;
    });

    return () => {
      unsubscribe();
      ambientEngine.stopAll();
    };
  }, []);
}
