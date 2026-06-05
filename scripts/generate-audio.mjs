import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const TWO_PI = Math.PI * 2;
const AUDIO_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio');

function createPrng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function envelope(time, duration, attack = 0.006, release = 0.06) {
  if (time < attack) return time / attack;
  const tail = Math.max(0, duration - time) / release;
  return Math.min(1, tail);
}

function triangle(phase) {
  return (2 / Math.PI) * Math.asin(Math.sin(phase));
}

function softClip(sample) {
  return Math.tanh(sample * 1.2) / Math.tanh(1.2);
}

function render(duration, synth) {
  const length = Math.floor(duration * SAMPLE_RATE);
  const samples = new Float32Array(length);

  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    samples[index] = softClip(synth(time, duration, index));
  }

  return samples;
}

function mixTone(time, start, duration, frequency, gain, shape = 'sine') {
  if (time < start || time > start + duration) return 0;

  const localTime = time - start;
  const amp = envelope(localTime, duration, 0.008, 0.09) * gain;
  const phase = TWO_PI * frequency * localTime;

  if (shape === 'triangle') return triangle(phase) * amp;
  return Math.sin(phase) * amp;
}

function toWav(samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }

  return buffer;
}

async function writeSound(name, duration, synth) {
  const samples = render(duration, synth);
  await writeFile(join(AUDIO_DIR, name), toWav(samples));
}

await mkdir(AUDIO_DIR, { recursive: true });

const sliceNoise = createPrng(1205);
let sliceFilter = 0;
await writeSound('slice.wav', 0.14, (time, duration) => {
  const fade = envelope(time, duration, 0.004, 0.055);
  const glideFrequency = 420 + 380 * (time / duration);
  const pop = Math.sin(TWO_PI * glideFrequency * time) * 0.16;
  sliceFilter = sliceFilter * 0.76 + (sliceNoise() * 2 - 1) * 0.24;
  const air = sliceFilter * 0.22;
  return (pop + air) * fade;
});

await writeSound('click.wav', 0.08, (time, duration) => {
  const fade = envelope(time, duration, 0.003, 0.035);
  const pop = triangle(TWO_PI * 520 * time) * 0.17 + Math.sin(TWO_PI * 240 * time) * 0.08;
  return pop * fade;
});

await writeSound('combo.wav', 0.46, (time) => {
  const first = mixTone(time, 0, 0.16, 523.25, 0.2, 'triangle');
  const second = mixTone(time, 0.12, 0.17, 659.25, 0.21, 'triangle');
  const third = mixTone(time, 0.26, 0.18, 783.99, 0.2, 'sine');
  const softBody = mixTone(time, 0.03, 0.35, 261.63, 0.045, 'sine');
  return first + second + third + softBody;
});

const bombNoise = createPrng(5021);
let bombFilter = 0;
await writeSound('bomb.wav', 0.38, (time, duration) => {
  const fade = envelope(time, duration, 0.004, 0.18);
  const pitch = 105 - 55 * (time / duration);
  const thump = Math.sin(TWO_PI * pitch * time) * 0.38;
  bombFilter = bombFilter * 0.9 + (bombNoise() * 2 - 1) * 0.1;
  const puff = bombFilter * 0.18;
  return (thump + puff) * fade;
});

await writeSound('game-over.wav', 0.82, (time) => {
  const noteA = mixTone(time, 0, 0.28, 659.25, 0.13, 'triangle');
  const noteB = mixTone(time, 0.2, 0.3, 587.33, 0.12, 'triangle');
  const noteC = mixTone(time, 0.42, 0.36, 523.25, 0.14, 'sine');
  const warmth = mixTone(time, 0.1, 0.62, 261.63, 0.045, 'sine');
  return noteA + noteB + noteC + warmth;
});

console.log('Generated soft game audio in public/audio');
