"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadSongAsset } from "@/lib/files/upload-asset";

export function AssetUploader({ songId, userId }: { songId: string; userId: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File, kindLabel: string) {
    setError(null);
    try {
      setProgress(`${kindLabel} 올리는 중`);
      await uploadSongAsset({ file, songId, userId });
      setProgress("저장했습니다.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "업로드에 실패했습니다.");
      setProgress(null);
    }
  }

  return (
    <div>
      <label>
        악보 .mscz
        <input
          name="score-file"
          type="file"
          accept=".mscz,application/zip"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file, "악보");
          }}
        />
      </label>
      <label>
        원곡 .mp3 .m4a .wav
        <input
          name="audio-file"
          type="file"
          accept=".mp3,.m4a,.wav,audio/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file, "음원");
          }}
        />
      </label>
      {progress && <p>{progress}</p>}
      {error && <p className="banner error">{error}</p>}
    </div>
  );
}
