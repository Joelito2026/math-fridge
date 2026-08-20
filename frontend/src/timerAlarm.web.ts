type WebAudioWindow = typeof globalThis & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioContextConstructor = (globalThis as WebAudioWindow).AudioContext
    || (globalThis as WebAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext = new AudioContextConstructor();
  return audioContext;
}

export async function prepareTimerAlarm() {
  const context = getAudioContext();
  if (context?.state === 'suspended') await context.resume();
}

export async function playTimerAlarm() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === 'suspended') await context.resume();

  const start = context.currentTime;
  [0, 0.55, 1.1, 1.65].forEach((offset, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = index % 2 === 0 ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.32, start + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.38);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.4);
  });
}
