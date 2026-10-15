/**
 * Alarm Sound Player for Dot
 * Plays preset sounds ('chime', 'bell', 'soft-ping') using HTMLAudioElement
 * with a Web Audio API synthesizer fallback.
 */

const SOUND_FILES = {
  chime: './sounds/chime.wav',
  bell: './sounds/bell.wav',
  'soft-ping': './sounds/soft-ping.wav'
};

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

// Web Audio synthesis fallback
function playSynthesizedSound(soundName) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    if (soundName === 'bell') {
      // Crisp bell: 1046.5Hz (C6) + 2093Hz (C7) + 3139.5Hz
      const tones = [
        { freq: 1046.5, gain: 0.4 },
        { freq: 2093.0, gain: 0.2 },
        { freq: 3139.5, gain: 0.1 }
      ];
      masterGain.gain.setValueAtTime(0.7, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      tones.forEach(({ freq, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(gain, now);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.9);
      });
    } else if (soundName === 'soft-ping') {
      // Soft ping: 523.25Hz (C5) + 1046.5Hz (C6)
      const tones = [
        { freq: 523.25, gain: 0.5 },
        { freq: 1046.5, gain: 0.15 }
      ];
      masterGain.gain.setValueAtTime(0.6, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      tones.forEach(({ freq, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(gain, now);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.55);
      });
    } else {
      // Chime: 587.33Hz (D5) + 880Hz (A5) + 1174.66Hz (D6)
      const tones = [
        { freq: 587.33, gain: 0.4 },
        { freq: 880.0, gain: 0.28 },
        { freq: 1174.66, gain: 0.12 }
      ];
      masterGain.gain.setValueAtTime(0.65, now);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

      tones.forEach(({ freq, gain }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(gain, now);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.75);
      });
    }
  } catch (err) {
    console.warn('[soundPlayer] Synthesis fallback failed:', err);
  }
}

export function playAlarmSound(soundName = 'chime') {
  const soundKey = SOUND_FILES[soundName] ? soundName : 'chime';
  const filePath = SOUND_FILES[soundKey];

  try {
    const audio = new Audio(filePath);
    audio.volume = 0.85;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn(`[soundPlayer] HTML Audio play failed (${err.message}), falling back to Web Audio synthesis`);
        playSynthesizedSound(soundKey);
      });
    }
  } catch (err) {
    console.warn(`[soundPlayer] Could not create Audio element, falling back to synthesis:`, err);
    playSynthesizedSound(soundKey);
  }
}
