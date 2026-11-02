"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { savePracticeState } from "@/app/songs/actions";
import { placeCursor } from "@/lib/score/cursor";
import {
  fitScoreWidth,
  measuresOnSystem,
  measuresPerScreenFromCount,
  nextSystemPreview,
  preferredSystemViewportWidth,
  PREVIEW_PEEK_SCALE,
  SCORE_BOTTOM_EXTRA,
  SCORE_PAD,
  SCORE_TOP_EXTRA,
  sheetViewportSize,
  systemIdsFromYs,
  windowForMeasure,
} from "@/lib/score/windows";
import { PracticeEngine, type EngineView, type MixState } from "@/lib/practice/engine";
import { loadScoreFile, type LoadedScore } from "@/lib/practice/load-score";
import { requestScreenWakeLock } from "@/lib/platform/wake-lock";
import type { PracticeSettings } from "@/lib/db/types";
import type { SyncPoint } from "@/lib/sync/mapping";

type Props = {
  scoreUrl: string;
  audioUrl?: string | null;
  initialSync?: SyncPoint[];
  heading?: string;
  songId?: string;
  initialSettings?: PracticeSettings | null;
};

const EMPTY_VIEW: EngineView = {
  scoreMs: 0,
  playing: false,
  counting: false,
  countDisplay: null,
  rate: 1,
  stretch: "idle",
  measureIndex: 0,
  loop: null,
};

export function PracticePlayer({
  scoreUrl,
  audioUrl,
  initialSync = [],
  heading,
  songId,
  initialSettings,
}: Props) {
  const [model, setModel] = useState<LoadedScore | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<EngineView>(EMPTY_VIEW);
  const [mix, setMix] = useState<MixState>({
    original: initialSettings?.original_enabled ?? true,
    drums: initialSettings?.drum_enabled ?? true,
    metronome: initialSettings?.metronome_enabled ?? true,
    originalVolume: initialSettings?.original_volume ?? 0.8,
    drumVolume: initialSettings?.drum_volume ?? 0.65,
    metronomeVolume: initialSettings?.metronome_volume ?? 0.45,
    countInVolume: initialSettings?.count_in_volume ?? 0.7,
  });
  const initialCountIn = countInFromSettings(initialSettings?.count_in);
  const [countInEnabled, setCountInEnabled] = useState(initialCountIn > 0);
  const [countInBars, setCountInBars] = useState<1 | 2>(initialCountIn === 2 ? 2 : 1);
  const countIn: 0 | 1 | 2 = countInEnabled ? countInBars : 0;
  const [countEveryLoop, setCountEveryLoop] = useState(initialSettings?.count_in_every_loop ?? false);
  const [visualOffset, setVisualOffset] = useState(initialSettings?.visual_offset_ms ?? 0);
  const [settingsVersion, setSettingsVersion] = useState(initialSettings?.version ?? 1);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loopName, setLoopName] = useState("반복");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sync, setSync] = useState<SyncPoint[]>(initialSync);
  const [audioSeconds, setAudioSeconds] = useState(initialSync[0]?.audioSec ?? 0);
  const [loopDraft, setLoopDraft] = useState<{ start: number; end: number } | null>(null);
  const [wakeSupported, setWakeSupported] = useState<boolean | null>(null);
  const [width, setWidth] = useState(800);
  const engineRef = useRef<PracticeEngine | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const paintRef = useRef({
    model: null as LoadedScore | null,
    visualOffset: 0,
    width: 800,
  });

  useEffect(() => {
    let cancelled = false;
    let loaded: LoadedScore | null = null;
    const context = new AudioContext();
    (async () => {
      try {
        const [scoreBytes, fontBytes, audioBytes] = await Promise.all([
          fetch(scoreUrl).then((response) => {
            if (!response.ok) throw new Error("악보를 받지 못했습니다.");
            return response.arrayBuffer();
          }),
          fetch("/fonts/wqy-microhei.ttc").then((response) => response.arrayBuffer()),
          audioUrl
            ? fetch(audioUrl).then((response) => {
                if (!response.ok) throw new Error("음원을 받지 못했습니다.");
                return response.arrayBuffer();
              })
            : Promise.resolve(null),
        ]);
        loaded = await loadScoreFile(new Uint8Array(scoreBytes), new Uint8Array(fontBytes));
        if (cancelled) {
          loaded.destroy();
          return;
        }
        let buffer: AudioBuffer | null = null;
        if (audioBytes) {
          buffer = await context.decodeAudioData(audioBytes.slice(0));
        }
        const engine = new PracticeEngine(context, loaded, buffer);
        engine.setSync(initialSync);
        await engine.prepareStretch();
        engine.setMix(mix);
        engine.setCountIn(countIn, countEveryLoop);
        if (initialSettings && initialSettings.tempo_ratio !== 1) {
          engine.setRate(initialSettings.tempo_ratio);
        }
        if (initialSettings && initialSettings.last_measure > 0) {
          engine.seekMeasure(initialSettings.last_measure);
        }
        engineRef.current = engine;
        setModel(loaded);
        setView(engine.view());
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "악보를 열지 못했습니다.");
      }
    })();
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      try {
        loaded?.destroy();
      } catch {
        /* already released */
      }
      void context.close();
    };
    // The engine is created once per score URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreUrl, audioUrl]);

  useEffect(() => {
    let frame = 0;
    let signature = "";
    const loop = () => {
      const engine = engineRef.current;
      if (engine) {
        engine.tick();
        const next = engine.view();
        const nextSignature = `${next.playing}|${next.counting}|${next.countDisplay}|${next.measureIndex}|${next.rate}|${next.stretch}`;
        if (nextSignature !== signature) {
          signature = nextSignature;
          setView(next);
        }
        const cursor = cursorRef.current;
        const paint = paintRef.current;
        if (cursor && paint.model) {
          const placed = cursorPlacement(paint.model, next, paint.visualOffset, paint.width);
          cursor.hidden = !placed;
          if (placed) cursor.style.left = `${placed.left}px`;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) engineRef.current?.pause();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWidth(node.clientWidth));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, [model]);

  useEffect(() => {
    engineRef.current?.setMix(mix);
  }, [mix]);

  useEffect(() => {
    engineRef.current?.setCountIn(countIn, countEveryLoop);
  }, [countIn, countEveryLoop]);

  useEffect(() => {
    engineRef.current?.setSync(sync);
  }, [sync]);

  useEffect(() => {
    engineRef.current?.setLoop(loopDraft);
  }, [loopDraft]);

  async function togglePlay() {
    const engine = engineRef.current;
    if (!engine) return;
    if (view.playing || view.counting) {
      engine.pause();
      setView(engine.view());
      return;
    }
    const sentinel = await requestScreenWakeLock();
    setWakeSupported(sentinel !== null);
    await engine.play();
    setView(engine.view());
  }

  useEffect(() => {
    paintRef.current = { model, visualOffset, width };
  });

  if (error) {
    return <p className="banner error">{error}</p>;
  }
  if (!model) {
    return <p className="banner">악보를 읽고 있습니다.</p>;
  }

  const frame = layoutFrame(model, view.measureIndex, width);
  const { window, systemIndexes, previewIndex, union, pad, fit, viewport } = frame;
  const previewBox =
    previewIndex !== null ? model.measuresGeom[previewIndex] ?? null : null;
  const measure = model.measuresGeom[view.measureIndex];
  const measureEnd = model.measuresGeom[view.measureIndex + 1]?.timeMs ?? model.durationMs;
  const cursor = measure
    ? placeCursor({
        scoreMs: view.scoreMs + visualOffset,
        measure,
        measureEndMs: measureEnd,
        columns: model.columns,
      })
    : null;
  const secondsPerBeat = measure ? (measureEnd - measure.timeMs) / 1000 / model.beatsPerMeasure : 0.5;
  const beat = measure ? (view.scoreMs - measure.timeMs) / 1000 / secondsPerBeat : 0;
  const effectiveBpm = model.tempoBpm * view.rate;

  return (
    <section className="practice">
      <header className="practice-head">
        <div>
          <p className="eyebrow">{heading ?? "연습"}</p>
          <h1>{model.title}</h1>
        </div>
        <p className="meta">
          {model.timeSignature} · 악보 {Math.round(model.tempoBpm)} BPM · 지금 {effectiveBpm.toFixed(0)} BPM ·{" "}
          {view.measureIndex + 1}마디
        </p>
      </header>
      {model.limitations.length > 0 && (
        <ul className="limits">
          {model.limitations.map((item) => (
            <li key={item.code}>{item.message}</li>
          ))}
        </ul>
      )}
      <div className="stage" ref={stageRef}>
        <div className="sheet" style={{ width: viewport.viewportWidth }}>
          <div className="score-banner" style={{ width: viewport.innerWidth }}>
            <p className="score-tempo">
              <span className="score-tempo-note" aria-hidden>
                ♩
              </span>
              <span>= {Math.round(model.tempoBpm)}</span>
              {view.rate !== 1 && (
                <span className="score-tempo-live"> · 지금 {effectiveBpm.toFixed(0)}</span>
              )}
            </p>
            <div className="score-sections">
              {model.markers
                .filter((marker) => systemIndexes.includes(marker.measureIndex))
                .map((marker) => {
                  const box = model.measuresGeom[marker.measureIndex];
                  if (!box) return null;
                  return (
                    <span
                      key={`${marker.measureIndex}-${marker.label}`}
                      className="score-section"
                      style={{ left: (box.x - union.x + pad) * fit.scale }}
                    >
                      {marker.label}
                    </span>
                  );
                })}
            </div>
          </div>
          <div
            className="sheet-canvas"
            style={{
              height: viewport.viewportHeight,
              overflowX: "hidden",
              overflowY: viewport.innerHeight > viewport.viewportHeight ? "auto" : "hidden",
            }}
          >
            <div
              className="sheet-inner"
              style={{ width: viewport.innerWidth, height: viewport.innerHeight }}
            >
              <div
                className="score-svg"
                style={{
                  transform: `translate(${(pad - union.x) * fit.scale}px, ${(pad - union.y) * fit.scale}px) scale(${fit.scale})`,
                }}
                dangerouslySetInnerHTML={{ __html: model.svg }}
              />
              {systemIndexes.map((index) => {
                const box = model.measuresGeom[index];
                if (!box) return null;
                const current = index === view.measureIndex;
                const inWindow = window.body.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    className={
                      current ? "measure current" : inWindow ? "measure" : "measure outside-window"
                    }
                    style={boxStyle(box, union, pad, fit.scale)}
                    onClick={() => engineRef.current?.seekMeasure(index)}
                    aria-label={`${index + 1}마디로 이동`}
                  />
                );
              })}
              <div ref={cursorRef} className="cursor" hidden />
            </div>
          </div>
        </div>
        {previewBox && previewIndex !== null && (
          <div className="preview-strip">
            <p className="preview-strip-label">다음 시스템 · {previewIndex + 1}마디</p>
            <PreviewPeek svg={model.svg} box={previewBox} measureIndex={previewIndex} />
          </div>
        )}
        {view.counting && <div className="count">{view.countDisplay}</div>}
        <p className="hint">시스템 {systemIndexes.length}마디 · MuseScore 한 줄 단위</p>
      </div>
      <div className="practice-deck">
        <div className="deck-row deck-transport">
          <div className="deck-group deck-playback">
            <button type="button" className="primary" onClick={() => void togglePlay()}>
              {view.playing || view.counting ? "일시정지" : "재생"}
            </button>
            <button
              type="button"
              onClick={() => {
                engineRef.current?.stop();
                setView(engineRef.current?.view() ?? EMPTY_VIEW);
              }}
            >
              정지
            </button>
          </div>
          <label className="deck-field">
            <span className="deck-label">속도 {Math.round(view.rate * 100)}%</span>
            <input
              name="tempo"
              type="range"
              min={50}
              max={150}
              value={Math.round(view.rate * 100)}
              onChange={(event) => {
                const rate = Number(event.target.value) / 100;
                engineRef.current?.setRate(rate);
                setView(engineRef.current?.view() ?? { ...view, rate });
              }}
            />
          </label>
          <div className="deck-field deck-count-in">
            <label className="check deck-count-toggle">
              <input
                name="count-in-enabled"
                type="checkbox"
                checked={countInEnabled}
                onChange={(event) => setCountInEnabled(event.target.checked)}
              />
              카운트인
            </label>
            <select
              name="count-in"
              value={countInBars}
              disabled={!countInEnabled}
              onChange={(event) => setCountInBars(Number(event.target.value) as 1 | 2)}
            >
              <option value={1}>1마디</option>
              <option value={2}>2마디</option>
            </select>
          </div>
          <div className="deck-group deck-loop">
            <button
              type="button"
              onClick={() => setLoopDraft({ start: view.measureIndex, end: view.measureIndex })}
            >
              이 마디 반복
            </button>
            <button
              type="button"
              onClick={() =>
                setLoopDraft({
                  start: window.start,
                  end: window.body[window.body.length - 1] ?? window.start,
                })
              }
            >
              이 화면 반복
            </button>
            <button type="button" onClick={() => setLoopDraft(null)}>
              반복 해제
            </button>
            {loopDraft && (
              <span className="deck-loop-range">
                {loopDraft.start + 1}–{loopDraft.end + 1}마디
              </span>
            )}
          </div>
        </div>
        <div className="deck-row deck-mix">
          <MixToggle
            label="원곡"
            enabled={mix.original}
            volume={mix.originalVolume}
            onEnabled={(original) => setMix({ ...mix, original })}
            onVolume={(originalVolume) => setMix({ ...mix, originalVolume })}
          />
          <MixToggle
            label="드럼"
            enabled={mix.drums}
            volume={mix.drumVolume}
            onEnabled={(drums) => setMix({ ...mix, drums })}
            onVolume={(drumVolume) => setMix({ ...mix, drumVolume })}
          />
          <MixToggle
            label="메트로놈"
            enabled={mix.metronome}
            volume={mix.metronomeVolume}
            onEnabled={(metronome) => setMix({ ...mix, metronome })}
            onVolume={(metronomeVolume) => setMix({ ...mix, metronomeVolume })}
          />
          <label className="deck-field mix-channel">
            <span className="deck-label">카운트인 볼륨 {Math.round(mix.countInVolume * 100)}</span>
            <input
              name="count-in-volume"
              type="range"
              min={0}
              max={100}
              value={Math.round(mix.countInVolume * 100)}
              onChange={(event) => setMix({ ...mix, countInVolume: Number(event.target.value) / 100 })}
            />
          </label>
        </div>
        <div className="deck-row deck-tools-toggle">
          <button type="button" onClick={() => setToolsOpen((open) => !open)}>
            {toolsOpen ? "설정 접기" : "동기화·반복 설정"}
          </button>
        </div>
      </div>
      {toolsOpen && <div className="tools">
        <label>
          화면 지연 {visualOffset}ms
          <input
            name="visual-offset"
            type="range"
            min={-200}
            max={200}
            value={visualOffset}
            onChange={(event) => setVisualOffset(Number(event.target.value))}
          />
        </label>
        <label className="check">
          <input
            name="count-every-loop"
            type="checkbox"
            checked={countEveryLoop}
            onChange={(event) => setCountEveryLoop(event.target.checked)}
          />
          반복마다 카운트인
        </label>
        <p>
          커서 {cursor?.reliable ? "음표 좌표" : "마디 비례"} · 박 {Math.max(1, Math.floor(beat) + 1)} ·{" "}
          {view.stretch === "ready"
            ? "음정을 유지합니다"
            : view.stretch === "unavailable"
              ? "음정 유지 처리를 시작하지 못했습니다. 속도는 음정이 변할 수 있습니다."
              : "음정 유지를 준비하는 중입니다"}
          {wakeSupported === false ? " · 이 브라우저는 화면 잠금 방지를 지원하지 않습니다." : ""}
        </p>
        <form
          className="sync-form"
          onSubmit={(event) => {
            event.preventDefault();
            const box = model.measuresGeom[view.measureIndex];
            if (!box) return;
            const point: SyncPoint = {
              id: crypto.randomUUID(),
              scoreMs: box.timeMs,
              audioSec: audioSeconds,
            };
            setSync((current) =>
              [...current.filter((item) => item.scoreMs !== point.scoreMs), point].sort(
                (a, b) => a.scoreMs - b.scoreMs,
              ),
            );
          }}
        >
          <label>
            원곡 시각(초)
            <input
              name="audio-seconds"
              type="number"
              min={0}
              step={0.01}
              value={audioSeconds}
              onChange={(event) => setAudioSeconds(Number(event.target.value))}
            />
          </label>
          <button type="submit">현재 마디 첫 박에 연결</button>
          {sync.map((point) => (
            <button
              key={point.id}
              type="button"
              onClick={() => setSync((current) => current.filter((item) => item.id !== point.id))}
            >
              {(point.scoreMs / 1000).toFixed(2)}초 악보 = {point.audioSec.toFixed(2)}초 삭제
            </button>
          ))}
        </form>
        <button
          type="button"
          onClick={() => {
            void model.savePdf().then((bytes) => {
              const blob = new Blob([bytes.slice()], { type: "application/pdf" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${model.title}.pdf`;
              link.click();
              URL.revokeObjectURL(url);
            });
          }}
        >
          전체 악보 PDF
        </button>
        {songId ? (
          <button
            type="button"
            onClick={() => {
              void savePracticeState({
                songId,
                settingsVersion,
                tempoRatio: view.rate,
                originalVolume: mix.originalVolume,
                drumVolume: mix.drumVolume,
                metronomeVolume: mix.metronomeVolume,
                countInVolume: mix.countInVolume,
                originalEnabled: mix.original,
                drumEnabled: mix.drums,
                metronomeEnabled: mix.metronome,
                countIn: String(countIn) as "0" | "1" | "2",
                countInEveryLoop: countEveryLoop,
                measuresPerScreen: measuresPerScreenFromCount(systemIndexes.length),
                lastMeasure: view.measureIndex,
                visualOffsetMs: visualOffset,
                sync: sync.map((point) => ({ scoreMs: point.scoreMs, audioSec: point.audioSec })),
                loop: loopDraft
                  ? { name: loopName, startMeasure: loopDraft.start, endMeasure: loopDraft.end }
                  : null,
              })
                .then((version) => {
                  setSettingsVersion(version);
                  setSaveMessage("이 계정의 연습 설정을 저장했습니다.");
                })
                .catch((cause: unknown) => {
                  setSaveMessage(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
                });
            }}
          >
            연습 설정 저장
          </button>
        ) : (
          <p className="hint">이 화면은 합성 악보 확인용이며 서버에 저장하지 않습니다.</p>
        )}
        <label>
          반복 이름
          <input name="loop-name" type="text" value={loopName} onChange={(event) => setLoopName(event.target.value)} />
        </label>
        {saveMessage && <p>{saveMessage}</p>}
      </div>}
    </section>
  );
}

function countInFromSettings(value: string | undefined): 0 | 1 | 2 {
  if (value === "0" || value === "2") return Number(value) as 0 | 2;
  return 1;
}

function layoutFrame(
  model: LoadedScore,
  measureIndex: number,
  width: number,
) {
  const systemIds = systemIdsFromYs(model.measuresGeom.map((box) => box.y));
  const window = windowForMeasure(measureIndex, 4, model.measuresGeom.length, systemIds);
  const systemId = systemIds[measureIndex] ?? 0;
  const systemIndexes = measuresOnSystem(systemIds, systemId);
  const previewIndex = nextSystemPreview(systemIds, systemId);
  const shown = systemIndexes
    .map((index) => model.measuresGeom[index])
    .filter((item): item is LoadedScore["measuresGeom"][number] => Boolean(item));
  const union = shown.reduce(
    (box, item) => ({
      x: Math.min(box.x, item.x),
      y: Math.min(box.y, item.y),
      right: Math.max(box.right, item.x + item.sx),
      bottom: Math.max(box.bottom, item.y + item.sy),
    }),
    {
      x: shown[0]?.x ?? 0,
      y: (shown[0]?.y ?? 0) - SCORE_TOP_EXTRA,
      right: shown[0] ? shown[0].x + shown[0].sx : 0,
      bottom: shown[0] ? shown[0].y + shown[0].sy : 0,
    },
  );
  union.bottom += SCORE_BOTTOM_EXTRA;
  const pad = SCORE_PAD;
  const unionWidth = Math.max(1, union.right - union.x + pad * 2);
  const unionHeight = Math.max(1, union.bottom - union.y + pad * 2);
  const containerWidth = Math.max(320, width - 8);
  // Widen past the stage when needed so a full system stays readable without clipping.
  const targetWidth = preferredSystemViewportWidth(unionWidth, containerWidth, 0.55);
  const fit = fitScoreWidth(unionWidth, targetWidth, 0.42);
  const viewport = sheetViewportSize(
    unionWidth,
    unionHeight,
    fit.scale,
    targetWidth,
    fit.scroll,
  );
  return { window, systemIndexes, previewIndex, union, pad, unionWidth, unionHeight, fit, viewport };
}

function PreviewPeek({
  svg,
  box,
  measureIndex,
}: {
  svg: string;
  box: { x: number; y: number; sx: number; sy: number };
  measureIndex: number;
}) {
  const scale = PREVIEW_PEEK_SCALE;
  const pad = 18;
  const topExtra = 72;
  const bottomExtra = 28;
  const width = (box.sx + pad * 2) * scale;
  const height = (box.sy + topExtra + bottomExtra + pad * 2) * scale;
  return (
    <div
      className="preview-peek"
      style={{ width, height }}
      aria-label={`다음 시스템 ${measureIndex + 1}마디 미리보기`}
    >
      <div className="preview-peek-inner" style={{ width, height }}>
        <div
          className="score-svg"
          style={{
            transform: `translate(${(pad - box.x) * scale}px, ${(pad + topExtra - box.y) * scale}px) scale(${scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}

function cursorPlacement(
  model: LoadedScore,
  view: EngineView,
  visualOffset: number,
  width: number,
): { left: number } | null {
  const frame = layoutFrame(model, view.measureIndex, width);
  const measure = model.measuresGeom[view.measureIndex];
  if (!measure) return null;
  const measureEnd = model.measuresGeom[view.measureIndex + 1]?.timeMs ?? model.durationMs;
  const cursor = placeCursor({
    scoreMs: view.scoreMs + visualOffset,
    measure,
    measureEndMs: measureEnd,
    columns: model.columns,
  });
  return { left: (cursor.x - frame.union.x + frame.pad) * frame.fit.scale };
}

function boxStyle(
  box: { x: number; y: number; sx: number; sy: number },
  union: { x: number; y: number },
  pad: number,
  scale: number,
): CSSProperties {
  return {
    left: (box.x - union.x + pad) * scale,
    top: (box.y - union.y + pad) * scale - 24 * scale,
    width: box.sx * scale,
    height: (box.sy + 36) * scale,
  };
}

function MixToggle({
  label,
  enabled,
  volume,
  onEnabled,
  onVolume,
}: {
  label: string;
  enabled: boolean;
  volume: number;
  onEnabled: (value: boolean) => void;
  onVolume: (value: number) => void;
}) {
  return (
    <div className="mix-channel">
      <label className="check">
        <input
          name={`${label}-enabled`}
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabled(event.target.checked)}
        />
        {label}
      </label>
      <input
        name={`${label}-volume`}
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        disabled={!enabled}
        onChange={(event) => onVolume(Number(event.target.value) / 100)}
      />
    </div>
  );
}
