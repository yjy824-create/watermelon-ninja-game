import { SOUND_ENABLED_KEY } from './gameConfig';

export type SoundName = 'slice' | 'bomb' | 'combo' | 'game-over' | 'click';

const SOUND_FILES: Record<SoundName, string> = {
  slice: '/audio/slice.wav',
  bomb: '/audio/bomb.wav',
  combo: '/audio/combo.wav',
  'game-over': '/audio/game-over.wav',
  click: '/audio/click.wav'
};

let audioContext: AudioContext | null = null;
const buffers = new Map<SoundName, AudioBuffer>();
let preloadPromise: Promise<void> | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) return null;

  if (!audioContext) {
    audioContext = new AudioContextConstructor();
  }

  return audioContext;
}

async function loadBuffer(name: SoundName, context: AudioContext): Promise<void> {
  if (buffers.has(name)) return;

  const response = await fetch(SOUND_FILES[name]);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = await context.decodeAudioData(arrayBuffer);
  buffers.set(name, buffer);
}

export function getSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

export async function initializeSound(): Promise<void> {
  const context = getAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    await context.resume();
  }

  if (!preloadPromise) {
    preloadPromise = Promise.all(Object.keys(SOUND_FILES).map((name) => loadBuffer(name as SoundName, context))).then(
      () => undefined
    );
  }

  await preloadPromise;
}

export function playSound(name: SoundName, enabled = true): void {
  if (!enabled || !getSoundEnabled()) return;

  const context = getAudioContext();
  const buffer = buffers.get(name);
  if (!context || !buffer) return;

  try {
    const source = context.createBufferSource();
    const gain = context.createGain();
    gain.gain.value = name === 'bomb' ? 0.62 : 0.78;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
  } catch {
    // Audio feedback should never interrupt gameplay.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
