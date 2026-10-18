"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { objectFileName, validateUpload } from "@/lib/files/validate";
import { safeNextPath } from "@/lib/auth/safe-next";
import { SONG_FILES_BUCKET, type PracticeSettings } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase 환경변수가 없습니다.");
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) throw new Error("로그인이 필요합니다.");
  return { supabase, userId };
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect("/login?error=config");
  const next = safeNextPath(String(formData.get("next") ?? "/songs"));
  const origin = String(formData.get("origin") ?? "");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/login");
}

export async function createSong(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("곡 이름이 필요합니다.");
  const { data, error } = await supabase
    .from("songs")
    .insert({
      owner_id: userId,
      title,
      artist: String(formData.get("artist") ?? "").trim(),
      difficulty: String(formData.get("difficulty") ?? "").trim(),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "곡을 저장하지 못했습니다.");
  await supabase.from("practice_settings").insert({ song_id: data.id, owner_id: userId });
  revalidatePath("/songs");
  redirect(`/songs/${data.id}`);
}

export async function updateSong(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const version = Number(formData.get("version"));
  const { data, error } = await supabase
    .from("songs")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      artist: String(formData.get("artist") ?? "").trim(),
      difficulty: String(formData.get("difficulty") ?? "").trim(),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      favorite: formData.get("favorite") === "on",
      version: version + 1,
    })
    .eq("id", id)
    .eq("owner_id", userId)
    .eq("version", version)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("다른 기기에서 먼저 저장했습니다. 다시 불러오세요.");
  revalidatePath(`/songs/${id}`);
}

export async function deleteSong(formData: FormData) {
  const { supabase, userId } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { data: assets } = await supabase
    .from("song_assets")
    .select("object_path")
    .eq("song_id", id)
    .eq("owner_id", userId);
  if (assets?.length) {
    await supabase.storage.from(SONG_FILES_BUCKET).remove(assets.map((asset) => asset.object_path));
  }
  const { error } = await supabase.from("songs").delete().eq("id", id).eq("owner_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/songs");
  redirect("/songs");
}

export async function commitAsset(input: {
  songId: string;
  assetId: string;
  kind: "score" | "audio";
  extension: string;
  byteSize: number;
  mime: string;
  originalName: string;
}) {
  const { supabase, userId } = await requireUser();
  validateUpload({ name: input.originalName, size: input.byteSize });
  const objectPath = `${userId}/${input.songId}/${input.assetId}/${objectFileName(input.extension)}`;
  const { error: retireError } = await supabase
    .from("song_assets")
    .update({ status: "replaced" })
    .eq("song_id", input.songId)
    .eq("owner_id", userId)
    .eq("kind", input.kind)
    .eq("status", "ready");
  if (retireError) throw new Error(retireError.message);
  const { error } = await supabase.from("song_assets").insert({
    id: input.assetId,
    song_id: input.songId,
    owner_id: userId,
    kind: input.kind,
    bucket: SONG_FILES_BUCKET,
    object_path: objectPath,
    byte_size: input.byteSize,
    mime: input.mime,
    original_name: input.originalName,
    status: "ready",
  });
  if (error) {
    await supabase.storage.from(SONG_FILES_BUCKET).remove([objectPath]);
    throw new Error(error.message);
  }
  revalidatePath(`/songs/${input.songId}`);
  return { objectPath };
}

export async function discardUpload(objectPath: string) {
  const { supabase, userId } = await requireUser();
  if (!objectPath.startsWith(`${userId}/`)) throw new Error("파일을 지울 수 없습니다.");
  await supabase.storage.from(SONG_FILES_BUCKET).remove([objectPath]);
}

export async function signedAssetUrl(songId: string, kind: "score" | "audio") {
  const { supabase, userId } = await requireUser();
  const { data: asset, error } = await supabase
    .from("song_assets")
    .select("object_path")
    .eq("song_id", songId)
    .eq("owner_id", userId)
    .eq("kind", kind)
    .eq("status", "ready")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!asset) return null;
  const signed = await supabase.storage.from(SONG_FILES_BUCKET).createSignedUrl(asset.object_path, 120);
  if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "다운로드 주소를 만들지 못했습니다.");
  return signed.data.signedUrl;
}

export async function savePractice(input: {
  songId: string;
  version: number;
  settings: Partial<PracticeSettings> & { last_measure: number };
}) {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("practice_settings")
    .update({ ...input.settings, version: input.version + 1 })
    .eq("song_id", input.songId)
    .eq("owner_id", userId)
    .eq("version", input.version)
    .select("version")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("연습 설정이 다른 기기에서 바뀌었습니다. 다시 불러오세요.");
  return data.version as number;
}

export async function savePracticeState(input: {
  songId: string;
  settingsVersion: number;
  tempoRatio: number;
  originalVolume: number;
  drumVolume: number;
  metronomeVolume: number;
  countInVolume: number;
  originalEnabled: boolean;
  drumEnabled: boolean;
  metronomeEnabled: boolean;
  countIn: "0" | "1" | "2";
  countInEveryLoop: boolean;
  measuresPerScreen: 2 | 4 | 8;
  lastMeasure: number;
  visualOffsetMs: number;
  sync: { scoreMs: number; audioSec: number }[];
  loop: { name: string; startMeasure: number; endMeasure: number } | null;
}) {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("practice_settings")
    .update({
      tempo_ratio: input.tempoRatio,
      original_volume: input.originalVolume,
      drum_volume: input.drumVolume,
      metronome_volume: input.metronomeVolume,
      count_in_volume: input.countInVolume,
      original_enabled: input.originalEnabled,
      drum_enabled: input.drumEnabled,
      metronome_enabled: input.metronomeEnabled,
      count_in: input.countIn,
      count_in_every_loop: input.countInEveryLoop,
      measures_per_screen: input.measuresPerScreen,
      last_measure: input.lastMeasure,
      visual_offset_ms: input.visualOffsetMs,
      version: input.settingsVersion + 1,
    })
    .eq("song_id", input.songId)
    .eq("owner_id", userId)
    .eq("version", input.settingsVersion)
    .select("version")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("연습 설정이 다른 기기에서 바뀌었습니다. 다시 불러오세요.");

  const { error: deleteError } = await supabase
    .from("sync_points")
    .delete()
    .eq("song_id", input.songId)
    .eq("owner_id", userId);
  if (deleteError) throw new Error(deleteError.message);
  if (input.sync.length > 0) {
    const { error: syncError } = await supabase.from("sync_points").insert(
      input.sync.map((point) => ({
        song_id: input.songId,
        owner_id: userId,
        score_ms: point.scoreMs,
        audio_sec: point.audioSec,
      })),
    );
    if (syncError) throw new Error(syncError.message);
  }
  if (input.loop) {
    const { error: loopError } = await supabase.from("practice_loops").insert({
      song_id: input.songId,
      owner_id: userId,
      name: input.loop.name.trim() || "반복",
      start_measure: input.loop.startMeasure,
      end_measure: input.loop.endMeasure,
    });
    if (loopError) throw new Error(loopError.message);
  }
  await supabase
    .from("songs")
    .update({ last_practiced_at: new Date().toISOString() })
    .eq("id", input.songId)
    .eq("owner_id", userId);
  revalidatePath(`/songs/${input.songId}/practice`);
  return data.version as number;
}
