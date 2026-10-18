# 설정

웹 배포와 데이터베이스 적용은 따로 한다. Vercel이 이 저장소를 빌드해도 Supabase SQL은 실행되지 않는다.

## 버전

2026-10-18 npm `latest` 기준. lockfile이 설치 결과를 고정한다.

| 패키지 | 버전 |
| --- | --- |
| next | 16.4.2 (`canary` 16.5는 사용하지 않음) |
| react, react-dom | 19.3.1 |
| @supabase/supabase-js | 2.118.0 |
| @supabase/ssr | 0.12.7 |
| webmscore | 1.2.1 |
| @soundtouchjs/audio-worklet, @soundtouchjs/core | 2.1.1 |

Node는 클라우드 이미지의 22를 사용한다.

## Google Cloud에서 할 일

1. Google Cloud 콘솔에서 프로젝트와 OAuth 동의 화면을 만든다.
2. 사용자 인증 정보에서 OAuth 클라이언트 ID를 만든다. 종류는 웹 애플리케이션.
3. 승인된 리디렉션 URI에는 Supabase가 안내하는 주소만 넣는다. 앱의 `/auth/callback`을 Google에 직접 넣지 않는다.
   - 호스팅: `https://<project-ref>.supabase.co/auth/v1/callback`
   - 로컬 Supabase를 쓸 때만: `http://127.0.0.1:54321/auth/v1/callback`
4. 클라이언트 ID와 클라이언트 보안 비밀번호를 복사한다. 이 값은 앱 저장소와 `NEXT_PUBLIC_` 변수에 넣지 않는다.

## Supabase 대시보드에서 할 일

1. 프로젝트를 만든다.
2. Authentication > Providers > Google을 켜고, 위에서 복사한 클라이언트 ID와 보안 비밀번호를 넣는다.
3. Authentication > URL Configuration
   - Site URL: 운영 주소. 예: `https://musescore-player.vercel.app`
   - Redirect URLs에 앱 콜백을 추가한다.
     - `http://localhost:3000/auth/callback`
     - Preview와 운영의 `https://<host>/auth/callback`
4. Project Settings > API에서 Project URL과 publishable key를 복사한다.
5. SQL Editor에서 `supabase/migrations/0001_library.sql` 전체를 한 번 실행한다. 이미 적용된 프로젝트에 다시 실행하면 정책 이름 충돌이 난다.
6. Storage에 `song-files` private 버킷과 정책이 SQL에 포함되어 있다. 공개 버킷으로 바꾸지 않는다.

앱 환경변수는 `.env.example` 두 개뿐이다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Vercel Project Settings > Environment Variables에 Production과 Preview 모두 넣는다. `service_role`은 넣지 않는다.

## 로그인 흐름

1. 브라우저가 Google 로그인을 누르면 서버 액션이 Supabase `signInWithOAuth`를 호출한다.
2. `redirectTo`는 현재 페이지의 origin과 `/auth/callback`이다. `next`는 상대 경로만 허용한다.
3. `/auth/callback`이 코드를 세션 쿠키로 바꾼다.
4. `proxy.ts`가 요청마다 `getClaims()`로 쿠키를 갱신한다. 권한 판단에 `getSession()`이나 클라이언트가 보낸 user id를 쓰지 않는다.

환경변수가 없으면 `/lab`과 홈은 열리고, `/songs`는 로그인 화면으로 보낸다. 이 상태에서는 Google 로그인과 RLS를 검증할 수 없다.

## 로컬과 클라우드

```bash
npm ci
npm test
npm run verify:score
npm run dev
```

`postinstall`이 webmscore와 SoundTouch 처리기를 `public/vendor`, `public/soundtouch-processor.js`로 복사한다. 이 파일은 git에 올리지 않는다.

클라우드 에이전트는 `.cursor/environment.json`의 `npm ci` 이후 `next dev`를 3000번 포트에 띄운다.

## Vercel

GitHub `main`과 Preview 브랜치를 Vercel 프로젝트에 연결한다. 빌드 명령은 `npm run build`, 설치는 `npm ci`다. SQL 마이그레이션은 Vercel 빌드에 포함하지 않고 Supabase에서 따로 적용한다.

## 데이터 규칙

- 경로는 `{user_id}/{song_id}/{asset_id}/original.mscz` 또는 `original.mp3|m4a|wav`.
- 테이블에는 URL 대신 bucket `song-files`와 object path를 저장한다.
- 연습 화면의 서명 URL은 300초다. 만료 뒤 다시 발급하는 동작은 아직 브라우저에서 확인하지 않았다.
- 곡 수정은 `version`이 같을 때만 증가한다. 다르면 다시 불러오라고 한다.
- 업로드 후 메타데이터 저장이 실패하면 그 객체를 지운다. 브라우저가 업로드와 저장 사이에 끊기면 고아 파일이 남을 수 있다.
