import Link from "next/link";
import { notFound } from "next/navigation";
import { AssetUploader } from "@/components/asset-uploader";
import { createClient } from "@/lib/supabase/server";
import { deleteSong, updateSong } from "../actions";

export default async function SongPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) notFound();
  const { data: song } = await supabase.from("songs").select("*").eq("id", songId).maybeSingle();
  if (!song) notFound();
  const { data: assets } = await supabase
    .from("song_assets")
    .select("kind,original_name,status,version")
    .eq("song_id", songId)
    .eq("status", "ready");
  return (
    <main className="card">
      <h1>{song.title}</h1>
      <p className="muted">{song.artist}</p>
      <p>
        <Link className="button primary" href={`/songs/${songId}/practice`}>연습</Link>
      </p>
      <form action={updateSong}>
        <input type="hidden" name="id" value={song.id} />
        <input type="hidden" name="version" value={song.version} />
        <label>곡 이름<input type="text" name="title" defaultValue={song.title} /></label>
        <label>아티스트<input type="text" name="artist" defaultValue={song.artist} /></label>
        <label>난이도<input type="text" name="difficulty" defaultValue={song.difficulty} /></label>
        <label>태그<input type="text" name="tags" defaultValue={(song.tags ?? []).join(", ")} /></label>
        <label className="check">
          <input type="checkbox" name="favorite" defaultChecked={song.favorite} /> 즐겨찾기
        </label>
        <button type="submit">수정</button>
      </form>
      <h2>파일</h2>
      <p className="muted">악보나 음원을 바꾸면 이전에 맞춘 동기화 지점이 새 파일과 어긋날 수 있습니다.</p>
      <ul>
        {(assets ?? []).map((asset) => (
          <li key={asset.kind}>{asset.kind === "score" ? "악보" : "음원"} · {asset.original_name}</li>
        ))}
      </ul>
      <AssetUploader songId={songId} userId={userId} />
      <form action={deleteSong}>
        <input type="hidden" name="id" value={song.id} />
        <button type="submit">곡 삭제</button>
      </form>
    </main>
  );
}
