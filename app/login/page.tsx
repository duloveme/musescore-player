import { LoginForm } from "@/components/login-form";
import { safeNextPath } from "@/lib/auth/safe-next";
import { supabaseEnv } from "@/lib/supabase/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const configured = supabaseEnv() !== null;
  return (
    <main className="card">
      <h1>Google로 로그인</h1>
      {params.error === "config" && <p className="banner error">Supabase 주소와 키가 없습니다.</p>}
      {params.error === "oauth" && <p className="banner error">로그인 주소를 만들지 못했습니다.</p>}
      {params.error === "callback" && <p className="banner error">로그인을 끝내지 못했습니다. 다시 시도해 주세요.</p>}
      {!configured && (
        <p>비밀값은 서버 환경변수에만 넣습니다. 설정 전에는 기술 검증 화면으로 연습 동작을 확인할 수 있습니다.</p>
      )}
      <LoginForm next={next} disabled={!configured} />
    </main>
  );
}
