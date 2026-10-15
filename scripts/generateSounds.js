import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function generateWav(filename, generator, durationSeconds = 0.8) {
  const sampleRate = 44100;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataSize = numSamples * numChannels * bytesPerSample;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = generator(t, durationSeconds);
    const clamped = Math.max(-1, Math.min(1, sampleVal));
    const intVal = Math.floor(clamped * 32767);
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }
  
  fs.writeFileSync(filename, buffer);
  console.log('Generated:', filename, buffer.length, 'bytes');
}

const soundsDir1 = path.join(projectRoot, 'assets', 'sounds');
const soundsDir2 = path.join(projectRoot, 'src', 'renderer', 'public', 'sounds');

fs.mkdirSync(soundsDir1, { recursive: true });
fs.mkdirSync(soundsDir2, { recursive: true });

// 1. Chime: Dual pleasant harmonic frequencies (587Hz D5 + 880Hz A5) with gentle attack and warm decay
const chimeGen = (t, dur) => {
  const env = Math.exp(-t * 4.2) * Math.min(1, t * 120);
  const tone1 = Math.sin(2 * Math.PI * 587.33 * t);
  const tone2 = Math.sin(2 * Math.PI * 880 * t) * 0.7;
  const tone3 = Math.sin(2 * Math.PI * 1174.66 * t) * 0.3;
  return (tone1 + tone2 + tone3) * 0.4 * env;
};

// 2. Bell: Crisp bright bell strike (1046.5Hz C6 + 2093Hz C7) with rich harmonics
const bellGen = (t, dur) => {
  const env = Math.exp(-t * 4.8) * Math.min(1, t * 250);
  const tone1 = Math.sin(2 * Math.PI * 1046.5 * t);
  const tone2 = Math.sin(2 * Math.PI * 2093.0 * t) * 0.55;
  const tone3 = Math.sin(2 * Math.PI * 3139.5 * t) * 0.25;
  return (tone1 + tone2 + tone3) * 0.42 * env;
};

// 3. Soft-ping: Gentle soft marimba / raindrop chime (523.25Hz C5) with round envelope
const pingGen = (t, dur) => {
  const env = Math.exp(-t * 6.5) * Math.min(1, t * 100);
  const tone1 = Math.sin(2 * Math.PI * 523.25 * t);
  const tone2 = Math.sin(2 * Math.PI * 1046.5 * t) * 0.25;
  return (tone1 + tone2) * 0.5 * env;
};

for (const dir of [soundsDir1, soundsDir2]) {
  generateWav(path.join(dir, 'chime.wav'), chimeGen, 0.75);
  generateWav(path.join(dir, 'bell.wav'), bellGen, 0.9);
  generateWav(path.join(dir, 'soft-ping.wav'), pingGen, 0.55);
}
