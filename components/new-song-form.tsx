"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSongRecord } from "@/app/songs/actions";
import { uploadSongAsset } from "@/lib/files/upload-asset";

export function NewSongForm() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const score = data.get("score");
    if (!(score instanceof File) || score.size === 0) {
      setError("악보 .mscz 파일을 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      setStatus("곡 정보를 저장하는 중");
      const created = await createSongRecord(data);
      setStatus("악보를 올리는 중");
      await uploadSongAsset({ file: score, songId: created.songId, userId: created.userId });
      const audio = data.get("audio");
      if (audio instanceof File && audio.size > 0) {
        setStatus("원곡을 올리는 중");
        await uploadSongAsset({ file: audio, songId: created.songId, userId: created.userId });
      }
      setStatus("저장했습니다.");
      router.push(`/songs/${created.songId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "곡을 저장하지 못했습니다.");
      setStatus(null);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <label>
        곡 이름
        <input type="text" name="title" required disabled={busy} />
      </label>
      <label>
        아티스트
        <input type="text" name="artist" disabled={busy} />
      </label>
      <label>
        난이도
        <input type="text" name="difficulty" disabled={busy} />
      </label>
      <label>
        태그
        <input type="text" name="tags" placeholder="락, 8비트" disabled={busy} />
      </label>
      <label>
        악보 .mscz (필수)
        <input
          name="score"
          type="file"
          accept=".mscz,application/zip"
          required
          disabled={busy}
        />
      </label>
      <label>
        원곡 .mp3 .m4a .wav (선택)
        <input
          name="audio"
          type="file"
          accept=".mp3,.m4a,.wav,audio/*"
          disabled={busy}
        />
      </label>
      <button className="primary" type="submit" disabled={busy}>
        {busy ? "저장 중…" : "저장"}
      </button>
      {status && <p>{status}</p>}
      {error && <p className="banner error">{error}</p>}
    </form>
  );
}
