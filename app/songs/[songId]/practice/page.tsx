import { PracticePlayer } from "@/components/practice-player";
import { createClient } from "@/lib/supabase/server";
import { SONG_FILES_BUCKET, type PracticeSettings } from "@/lib/db/types";
import { notFound } from "next/navigation";

export default async function SongPracticePage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) notFound();
  const { data: song } = await supabase.from("songs").select("title").eq("id", songId).maybeSingle();
  if (!song) notFound();
  const { data: assets } = await supabase
    .from("song_assets")
    .select("kind,object_path")
    .eq("song_id", songId)
    .eq("status", "ready");
  const score = assets?.find((asset) => asset.kind === "score");
  const audio = assets?.find((asset) => asset.kind === "audio");
  if (!score) {
    return (
      <main className="card">
        <h1>{song.title}</h1>
        <p>연습하려면 악보 .mscz 를 먼저 올려 주세요.</p>
      </main>
    );
  }
  const scoreUrl = await supabase.storage.from(SONG_FILES_BUCKET).createSignedUrl(score.object_path, 300);
  const audioUrl = audio
    ? await supabase.storage.from(SONG_FILES_BUCKET).createSignedUrl(audio.object_path, 300)
    : null;
  if (scoreUrl.error || !scoreUrl.data) {
    return (
      <main className="card">
        <p className="banner error">악보 주소를 만들지 못했습니다. 잠시 후 다시 열어 주세요.</p>
      </main>
    );
  }
  const { data: points } = await supabase
    .from("sync_points")
    .select("id,score_ms,audio_sec")
    .eq("song_id", songId);
  const { data: settings } = await supabase
    .from("practice_settings")
    .select("*")
    .eq("song_id", songId)
    .maybeSingle();
  return (
    <PracticePlayer
      heading={song.title}
      songId={songId}
      scoreUrl={scoreUrl.data.signedUrl}
      audioUrl={audioUrl?.data?.signedUrl ?? null}
      initialSync={(points ?? []).map((point) => ({
        id: point.id,
        scoreMs: Number(point.score_ms),
        audioSec: Number(point.audio_sec),
      }))}
      initialSettings={settings as PracticeSettings | null}
    />
  );
}
