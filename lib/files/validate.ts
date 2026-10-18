export const MAX_SCORE_BYTES = 20 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 80 * 1024 * 1024;

const SCORE_EXTENSIONS = new Set(["mscz"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "m4a", "wav"]);

export type FileKind = "score" | "audio";

export function fileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function validateUpload(file: { name: string; size: number; type?: string }): {
  kind: FileKind;
  extension: string;
} {
  const extension = fileExtension(file.name);
  if (SCORE_EXTENSIONS.has(extension)) {
    if (file.size <= 0 || file.size > MAX_SCORE_BYTES) {
      throw new Error("악보 파일은 1바이트 이상 20MB 이하여야 합니다.");
    }
    return { kind: "score", extension };
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
      throw new Error("음원은 1바이트 이상 80MB 이하여야 합니다.");
    }
    return { kind: "audio", extension };
  }
  throw new Error("악보는 .mscz, 음원은 .mp3 .m4a .wav 만 올릴 수 있습니다.");
}

export function objectFileName(extension: string): string {
  return `original.${extension}`;
}
