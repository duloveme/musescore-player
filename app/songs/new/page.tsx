import { NewSongForm } from "@/components/new-song-form";

export default function NewSongPage() {
  return (
    <main className="card">
      <h1>곡 등록</h1>
      <p className="muted">MuseScore Studio에서 저장한 .mscz 악보를 함께 올립니다.</p>
      <NewSongForm />
    </main>
  );
}
