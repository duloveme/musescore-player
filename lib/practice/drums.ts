function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.4);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

let cachedNoise: AudioBuffer | null = null;

export function playDrum(
  context: AudioContext,
  when: number,
  pitch: number,
  velocity: number,
  destination: AudioNode,
): () => void {
  const level = Math.max(0.05, Math.min(1, velocity / 127));
  const gain = context.createGain();
  gain.connect(destination);
  const nodes: AudioNode[] = [gain];
  const stopAt = when + 0.8;

  const tone = (frequency: number, endFrequency: number, duration: number, type: OscillatorType, peak: number) => {
    const osc = context.createOscillator();
    const amp = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), when + duration);
    amp.gain.setValueAtTime(peak * level, when);
    amp.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(amp);
    amp.connect(gain);
    osc.start(when);
    osc.stop(when + duration + 0.02);
    nodes.push(osc, amp);
  };

  const burst = (duration: number, peak: number, filterHz: number) => {
    if (!cachedNoise) cachedNoise = noiseBuffer(context);
    const source = context.createBufferSource();
    source.buffer = cachedNoise;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = filterHz;
    const amp = context.createGain();
    amp.gain.setValueAtTime(peak * level, when);
    amp.gain.exponentialRampToValueAtTime(0.001, when + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(gain);
    source.start(when);
    source.stop(when + duration);
    nodes.push(source, filter, amp);
  };

  if (pitch <= 36) tone(150, 48, 0.28, "sine", 0.9);
  else if (pitch === 38 || pitch === 40) {
    tone(190, 140, 0.16, "triangle", 0.45);
    burst(0.18, 0.55, 1800);
  } else if (pitch === 42 || pitch === 44) burst(0.05, 0.35, 7000);
  else if (pitch === 46) burst(0.2, 0.4, 5000);
  else if (pitch === 49 || pitch === 57) burst(0.45, 0.45, 4000);
  else if (pitch === 51 || pitch === 59) {
    tone(320, 280, 0.25, "square", 0.12);
    burst(0.12, 0.22, 4500);
  } else tone(220 - Math.min(80, pitch), 90, 0.22, "sine", 0.55);

  return () => {
    const now = context.currentTime;
    if (now > stopAt) return;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
    } catch {
      gain.disconnect();
    }
  };
}

export function playClick(
  context: AudioContext,
  when: number,
  accent: boolean,
  destination: AudioNode,
): () => void {
  const osc = context.createOscillator();
  const amp = context.createGain();
  osc.type = "square";
  osc.frequency.value = accent ? 1400 : 900;
  amp.gain.setValueAtTime(accent ? 0.25 : 0.14, when);
  amp.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
  osc.connect(amp);
  amp.connect(destination);
  osc.start(when);
  osc.stop(when + 0.06);
  return () => {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
  };
}
