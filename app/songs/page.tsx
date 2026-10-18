import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  if (!supabase) {
    return (
      <main className="card">
        <h1>곡 목록</h1>
        <p>Supabase가 연결되면 이 계정의 곡이 여기 표시됩니다.</p>
      </main>
    );
  }
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return (
      <main className="card">
        <h1>로그인이 필요합니다.</h1>
        <Link className="button primary" href="/login?next=/songs">로그인</Link>
      </main>
    );
  }
  let query = supabase
    .from("songs")
    .select("id,title,artist,favorite,updated_at,last_practiced_at")
    .order("updated_at", { ascending: false });
  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  const { data: songs, error } = await query;
  return (
    <main>
      <div className="topbar">
        <h1>내 곡</h1>
        <form action={signOut}><button type="submit">로그아웃</button></form>
      </div>
      <form>
        <input type="text" name="q" defaultValue={q} placeholder="곡 이름" />
        <button type="submit">검색</button>
        <Link className="button primary" href="/songs/new">곡 추가</Link>
      </form>
      {error && <p className="banner error">{error.message}</p>}
      <div className="song-list">
        {(songs ?? []).map((song) => (
          <Link key={song.id} className="card" href={`/songs/${song.id}`}>
            <strong>{song.favorite ? "★ " : ""}{song.title}</strong>
            <div className="muted">{song.artist || "아티스트 없음"}</div>
            {song.last_practiced_at && (
              <div className="muted">최근 연습 {new Date(song.last_practiced_at).toLocaleString("ko-KR")}</div>
            )}
          </Link>
        ))}
      </div>
      {songs?.length === 0 && <p>등록한 곡이 없습니다.</p>}
    </main>
  );
}
