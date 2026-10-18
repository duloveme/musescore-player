import Link from "next/link";

export default function HomePage() {
  return (
    <main className="card">
      <p className="eyebrow">MuseScore 악보와 원곡</p>
      <h1>드럼을 악보 위치와 함께 연습합니다.</h1>
      <p>PC에서는 곡과 파일을 관리하고, iPad Safari에서는 가로 화면으로 연습합니다.</p>
      <p className="topbar">
        <Link className="button primary" href="/songs">곡 목록</Link>
        <Link className="button" href="/lab">합성 악보로 연습 확인</Link>
      </p>
    </main>
  );
}
