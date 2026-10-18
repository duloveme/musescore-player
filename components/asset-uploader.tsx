"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { commitAsset, discardUpload } from "@/app/songs/actions";
import { objectFileName, validateUpload } from "@/lib/files/validate";
import { SONG_FILES_BUCKET } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/client";

export function AssetUploader({ songId, userId }: { songId: string; userId: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File, kindLabel: string) {
    setError(null);
    try {
      const checked = validateUpload(file);
      const assetId = crypto.randomUUID();
      const path = `${userId}/${songId}/${assetId}/${objectFileName(checked.extension)}`;
      const supabase = createClient();
      setProgress(`${kindLabel} 올리는 중`);
      const uploaded = await supabase.storage.from(SONG_FILES_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
      if (uploaded.error) throw new Error(uploaded.error.message);
      try {
        await commitAsset({
          songId,
          assetId,
          kind: checked.kind,
          extension: checked.extension,
          byteSize: file.size,
          mime: file.type || "application/octet-stream",
          originalName: file.name,
        });
      } catch (cause) {
        await discardUpload(path);
        throw cause;
      }
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
