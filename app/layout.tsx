import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "드럼 연습",
  description: "악보와 원곡을 함께 보며 드럼을 연습합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/">드럼 연습</Link>
            <nav className="topbar">
              <Link href="/songs">곡</Link>
              <Link href="/lab">기술 검증</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
