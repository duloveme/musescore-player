import type { SoundTouchNode } from "@soundtouchjs/audio-worklet";
import {
  countInSchedule,
  scoreFromWall,
  wallFromScore,
  type CountInMeasures,
} from "@/lib/audio/timeline";
import { playClick, playDrum } from "@/lib/practice/drums";
import type { LoadedScore } from "@/lib/practice/load-score";
import { scoreMsToAudioSec, slopeAt, type SyncPoint } from "@/lib/sync/mapping";

export type MixState = {
  original: boolean;
  drums: boolean;
  metronome: boolean;
  originalVolume: number;
  drumVolume: number;
  metronomeVolume: number;
  countInVolume: number;
};

export type EngineView = {
  scoreMs: number;
  playing: boolean;
  counting: boolean;
  countDisplay: number | null;
  rate: number;
  stretch: "ready" | "unavailable" | "idle";
  measureIndex: number;
  loop: { start: number; end: number } | null;
};

type Loop = { start: number; end: number };

export class PracticeEngine {
  private readonly originalGain: GainNode;
  private readonly drumGain: GainNode;
  private readonly clickGain: GainNode;
  private readonly countGain: GainNode;
  private stretch: EngineView["stretch"] = "idle";
  private rate = 1;
  private mix: MixState = {
    original: true,
    drums: true,
    metronome: false,
    originalVolume: 0.8,
    drumVolume: 0.7,
    metronomeVolume: 0.6,
    countInVolume: 0.7,
  };
  private sync: SyncPoint[] = [];
  private loop: Loop | null = null;
  private countIn: CountInMeasures = 1;
  private countInEveryLoop = false;
  private playing = false;
  private counting = false;
  private originScoreMs = 0;
  private originWhen = 0;
  private scoreMs = 0;
  private playbackWhen = 0;
  private countEvents: { when: number; display: number; accent: boolean }[] = [];
  private source: AudioBufferSourceNode | null = null;
  private stretchNode: SoundTouchNode | null = null;
  private stretchCtor: (new (options: { context: AudioContext }) => SoundTouchNode) | null = null;
  private stops: Array<() => void> = [];
  private scheduledDrums = new Set<string>();
  private scheduledClicks = new Set<string>();
  private audioAnchorScore = 0;
  private audioSlope = 1;

  constructor(
    private readonly context: AudioContext,
    private readonly model: LoadedScore,
    private readonly audio: AudioBuffer | null,
  ) {
    this.originalGain = context.createGain();
    this.drumGain = context.createGain();
    this.clickGain = context.createGain();
    this.countGain = context.createGain();
    this.originalGain.connect(context.destination);
    this.drumGain.connect(context.destination);
    this.clickGain.connect(context.destination);
    this.countGain.connect(context.destination);
    this.applyMix();
  }

  async prepareStretch(): Promise<void> {
    try {
      const loaded = await import("@soundtouchjs/audio-worklet");
      await loaded.SoundTouchNode.register(this.context, "/soundtouch-processor.js");
      this.stretchCtor = loaded.SoundTouchNode;
      this.stretch = "ready";
    } catch {
      this.stretch = "unavailable";
    }
  }

  setSync(points: SyncPoint[]): void {
    this.sync = points;
  }

  setRate(rate: number): void {
    const next = Math.min(1.5, Math.max(0.5, rate));
    if (this.playing) this.scoreMs = this.currentScoreMs();
    this.rate = next;
    if (this.playing) this.restartAt(this.scoreMs, false);
  }

  setMix(mix: MixState): void {
    this.mix = mix;
    this.applyMix();
  }

  setCountIn(measures: CountInMeasures, everyLoop: boolean): void {
    this.countIn = measures;
    this.countInEveryLoop = everyLoop;
    this.applyMix();
  }

  setLoop(loop: Loop | null): void {
    if (loop && loop.end < loop.start) return;
    this.loop = loop;
  }

  seekScore(scoreMs: number): void {
    const next = Math.min(this.model.durationMs, Math.max(0, scoreMs));
    if (this.playing || this.counting) this.restartAt(next, false);
    else this.scoreMs = next;
  }

  seekMeasure(index: number): void {
    const box = this.model.measuresGeom[index];
    this.seekScore(box ? box.timeMs : 0);
  }

  async play(): Promise<void> {
    if (this.context.state !== "running") await this.context.resume();
    this.restartAt(this.scoreMs, true);
  }

  pause(): void {
    this.scoreMs = this.currentScoreMs();
    this.hardStop();
    this.playing = false;
    this.counting = false;
  }

  stop(): void {
    this.hardStop();
    this.playing = false;
    this.counting = false;
    this.scoreMs = 0;
  }

  tick(): void {
    if (!this.playing && !this.counting) return;
    const now = this.context.currentTime;
    if (this.counting && now >= this.playbackWhen) {
      this.counting = false;
      this.playing = true;
      this.originScoreMs = this.scoreMs;
      this.originWhen = this.playbackWhen;
      this.startSong(this.scoreMs, this.playbackWhen);
    }
    if (this.playing) {
      const scoreMs = this.currentScoreMs();
      const loopEnd = this.loopEndMs();
      if (loopEnd !== null && scoreMs >= loopEnd) {
        const start = this.model.measuresGeom[this.loop!.start]?.timeMs ?? 0;
        this.restartAt(start, this.countInEveryLoop);
        return;
      }
      this.scheduleAhead(scoreMs);
      this.followSong(scoreMs);
    }
  }

  view(): EngineView {
    const scoreMs = this.playing ? this.currentScoreMs() : this.scoreMs;
    let countDisplay: number | null = null;
    if (this.counting) {
      const now = this.context.currentTime;
      const current = [...this.countEvents].reverse().find((event) => event.when <= now);
      countDisplay = current?.display ?? this.countEvents[0]?.display ?? null;
    }
    return {
      scoreMs,
      playing: this.playing,
      counting: this.counting,
      countDisplay,
      rate: this.rate,
      stretch: this.stretch,
      measureIndex: this.measureIndex(scoreMs),
      loop: this.loop,
    };
  }

  destroy(): void {
    this.hardStop();
    this.originalGain.disconnect();
    this.drumGain.disconnect();
    this.clickGain.disconnect();
    this.countGain.disconnect();
  }

  private restartAt(scoreMs: number, withCountIn: boolean): void {
    this.hardStop();
    this.scoreMs = scoreMs;
    const now = this.context.currentTime + 0.05;
    if (withCountIn && this.countIn > 0) {
      const secondsPerBeat = this.secondsPerBeat(scoreMs);
      const scheduled = countInSchedule({
        measures: this.countIn,
        beatsPerMeasure: this.model.beatsPerMeasure,
        secondsPerBeat,
        rate: this.rate,
        startContextTime: now,
      });
      this.countEvents = scheduled.events;
      this.playbackWhen = scheduled.playbackContextTime;
      this.counting = true;
      this.playing = false;
      for (const event of scheduled.events) {
        this.stops.push(playClick(this.context, event.when, event.accent, this.countGain));
      }
      return;
    }
    this.counting = false;
    this.playing = true;
    this.originScoreMs = scoreMs;
    this.originWhen = now;
    this.startSong(scoreMs, now);
    this.scheduleAhead(scoreMs);
  }

  private scheduleAhead(scoreMs: number): void {
    const horizon = scoreMs + this.rate * 250;
    if (this.mix.drums) {
      for (const note of this.model.notes) {
        if (note.timeMs < scoreMs || note.timeMs > horizon) continue;
        const key = `n${note.timeMs}:${note.pitch}`;
        if (this.scheduledDrums.has(key)) continue;
        this.scheduledDrums.add(key);
        const when = wallFromScore(note.timeMs, this.originScoreMs, this.originWhen, this.rate);
        if (when < this.context.currentTime - 0.02) continue;
        this.stops.push(playDrum(this.context, when, note.pitch, note.velocity, this.drumGain));
      }
    }
    if (this.mix.metronome) {
      for (let index = 0; index < this.model.measuresGeom.length; index += 1) {
        const start = this.model.measuresGeom[index].timeMs;
        const end = this.model.measuresGeom[index + 1]?.timeMs ?? this.model.durationMs;
        const beat = (end - start) / this.model.beatsPerMeasure;
        for (let step = 0; step < this.model.beatsPerMeasure; step += 1) {
          const time = start + step * beat;
          if (time < scoreMs || time > horizon) continue;
          const key = `m${index}:${step}`;
          if (this.scheduledClicks.has(key)) continue;
          this.scheduledClicks.add(key);
          const when = wallFromScore(time, this.originScoreMs, this.originWhen, this.rate);
          if (when < this.context.currentTime - 0.02) continue;
          this.stops.push(playClick(this.context, when, step === 0, this.clickGain));
        }
      }
    }
  }

  private startSong(scoreMs: number, when: number): void {
    this.stopSong();
    if (!this.audio || !this.mix.original) return;
    const audioSec = scoreMsToAudioSec(this.sync, scoreMs);
    if (audioSec < 0 || audioSec >= this.audio.duration - 0.01) return;
    const slope = slopeAt(this.sync, scoreMs);
    const playbackRate = slope * this.rate;
    const source = this.context.createBufferSource();
    source.buffer = this.audio;
    source.playbackRate.value = playbackRate;
    if (this.stretchCtor) {
      const node = new this.stretchCtor({ context: this.context });
      node.playbackRate.value = playbackRate;
      node.pitch.value = 1;
      source.connect(node);
      node.connect(this.originalGain);
      this.stretchNode = node;
    } else {
      this.stretch = "unavailable";
      source.connect(this.originalGain);
    }
    source.start(when, audioSec);
    this.source = source;
    this.audioAnchorScore = scoreMs;
    this.audioSlope = slope;
  }

  private followSong(scoreMs: number): void {
    if (!this.audio || !this.mix.original) return;
    const slope = slopeAt(this.sync, scoreMs);
    if (Math.abs(slope - this.audioSlope) > 0.02) {
      const when = wallFromScore(scoreMs, this.originScoreMs, this.originWhen, this.rate);
      this.startSong(scoreMs, Math.max(when, this.context.currentTime));
    }
  }

  private stopSong(): void {
    try {
      this.source?.stop();
    } catch {
      /* already stopped */
    }
    this.source?.disconnect();
    this.stretchNode?.disconnect();
    this.source = null;
    this.stretchNode = null;
  }

  private hardStop(): void {
    this.stopSong();
    for (const stop of this.stops) stop();
    this.stops = [];
    this.scheduledDrums.clear();
    this.scheduledClicks.clear();
    this.countEvents = [];
  }

  private currentScoreMs(): number {
    if (!this.playing) return this.scoreMs;
    return Math.min(
      this.model.durationMs,
      scoreFromWall(this.context.currentTime, this.originScoreMs, this.originWhen, this.rate),
    );
  }

  private measureIndex(scoreMs: number): number {
    let index = 0;
    for (let i = 0; i < this.model.measuresGeom.length; i += 1) {
      if (this.model.measuresGeom[i].timeMs <= scoreMs) index = i;
    }
    return index;
  }

  private loopEndMs(): number | null {
    if (!this.loop) return null;
    return this.model.measuresGeom[this.loop.end + 1]?.timeMs ?? this.model.durationMs;
  }

  private secondsPerBeat(scoreMs: number): number {
    const index = this.measureIndex(scoreMs);
    const start = this.model.measuresGeom[index]?.timeMs ?? 0;
    const end = this.model.measuresGeom[index + 1]?.timeMs ?? this.model.durationMs;
    return Math.max(0.05, (end - start) / 1000 / this.model.beatsPerMeasure);
  }

  private applyMix(): void {
    this.originalGain.gain.value = this.mix.original ? this.mix.originalVolume : 0;
    this.drumGain.gain.value = this.mix.drums ? this.mix.drumVolume : 0;
    this.clickGain.gain.value = this.mix.metronome ? this.mix.metronomeVolume : 0;
    this.countGain.gain.value = this.countIn > 0 ? this.mix.countInVolume : 0;
  }
}
