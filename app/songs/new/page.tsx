import { createSong } from "../actions";

export default function NewSongPage() {
  return (
    <main className="card">
      <h1>곡 등록</h1>
      <form action={createSong}>
        <label>곡 이름<input type="text" name="title" required /></label>
        <label>아티스트<input type="text" name="artist" /></label>
        <label>난이도<input type="text" name="difficulty" /></label>
        <label>태그<input type="text" name="tags" placeholder="락, 8비트" /></label>
        <button className="primary" type="submit">저장</button>
      </form>
    </main>
  );
}
