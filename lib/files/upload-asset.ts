"use client";

import { commitAsset, discardUpload } from "@/app/songs/actions";
import { objectFileName, validateUpload } from "@/lib/files/validate";
import { SONG_FILES_BUCKET } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/client";

/** Browser upload to private Storage, then commit metadata. Rolls back the object on commit failure. */
export async function uploadSongAsset(input: {
  file: File;
  songId: string;
  userId: string;
}): Promise<void> {
  const checked = validateUpload(input.file);
  const assetId = crypto.randomUUID();
  const path = `${input.userId}/${input.songId}/${assetId}/${objectFileName(checked.extension)}`;
  const supabase = createClient();
  const uploaded = await supabase.storage.from(SONG_FILES_BUCKET).upload(path, input.file, {
    upsert: false,
    contentType: input.file.type || "application/octet-stream",
  });
  if (uploaded.error) throw new Error(uploaded.error.message);
  try {
    await commitAsset({
      songId: input.songId,
      assetId,
      kind: checked.kind,
      extension: checked.extension,
      byteSize: input.file.size,
      mime: input.file.type || "application/octet-stream",
      originalName: input.file.name,
    });
  } catch (cause) {
    await discardUpload(path);
    throw cause;
  }
}
