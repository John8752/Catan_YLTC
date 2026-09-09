export type GameSound = "dice-roll" | "your-turn";

/** Original, locally synthesized cues: tumbling wooden clicks and a rising chime. */
export function synthesizeGameSound(sound: GameSound, sampleRate: number): Float32Array<ArrayBuffer> {
  const samples = new Float32Array(Math.ceil(sampleRate * (sound === "dice-roll" ? 0.65 : 0.85)));
  let noise = 73;
  let filtered = 0;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate;
    if (sound === "dice-roll") {
      noise = (Math.imul(noise, 1664525) + 1013904223) >>> 0;
      filtered = filtered * 0.45 + (noise / 0xffffffff * 2 - 1) * 0.55;
      for (const [j, onset] of [0, 0.045, 0.10, 0.17, 0.26, 0.38, 0.51].entries()) {
        const elapsed = t - onset;
        if (elapsed >= 0 && elapsed < 0.10) {
          const attack = Math.min(1, elapsed / 0.0015);
          samples[i]! += attack * Math.exp(-elapsed * 65) * (0.22 - j * 0.016)
            * (filtered * 0.7 + Math.sin(2 * Math.PI * (730 + j * 93) * elapsed) * 0.3);
        }
      }
    } else {
      for (const [j, frequency] of [523.25, 659.25, 783.99].entries()) {
        const elapsed = t - j * 0.14;
        if (elapsed >= 0) {
          const envelope = Math.min(1, elapsed / 0.012) * Math.exp(-elapsed * 8) * Math.min(1, (0.85 - t) / 0.04);
          samples[i]! += envelope * 0.11 * (Math.sin(2 * Math.PI * frequency * elapsed)
            + 0.18 * Math.sin(2 * Math.PI * frequency * 2 * elapsed));
        }
      }
    }
  }
  return samples;
}

export function createGameAudio(createContext = (): AudioContext | null => {
  const Audio = window.AudioContext;
  return typeof Audio === "function" ? new Audio() : null;
}) {
  let context: AudioContext | null = null;
  let muted = false;
  const buffers = new Map<GameSound, AudioBuffer>();
  const sources = new Set<AudioBufferSourceNode>();
  const stop = () => {
    for (const source of sources) {
      try { source.stop(); source.disconnect(); } catch { /* Already stopped. */ }
    }
    sources.clear();
  };
  return {
    // Called synchronously inside a user gesture, including lobby interactions.
    unlock() {
      if (muted) return;
      try {
        if (context === null || context.state === "closed") {
          context = createContext();
          buffers.clear();
        }
        if (context && context.state !== "running") void context.resume().catch(() => undefined);
      } catch { /* Audio is optional, including on plain HTTP and unsupported browsers. */ }
    },
    play(sound: GameSound) {
      // Never queue sounds while locked; unlocking later must not replay old turns.
      if (muted || context?.state !== "running") return;
      try {
        let buffer = buffers.get(sound);
        if (!buffer) {
          const samples = synthesizeGameSound(sound, context.sampleRate);
          buffer = context.createBuffer(1, samples.length, context.sampleRate);
          buffer.copyToChannel(samples, 0);
          buffers.set(sound, buffer);
        }
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        source.onended = () => { sources.delete(source); source.disconnect(); };
        sources.add(source);
        source.start();
      } catch { /* A device/audio interruption must never break a game command. */ }
    },
    setMuted(value: boolean) { muted = value; if (muted) stop(); },
    dispose() {
      stop();
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
      context = null;
      buffers.clear();
    },
  };
}
