# 드럼 연습

MuseScore Studio에서 만든 `.mscz` 악보와 원곡 음원을 올리고, 악보 커서와 함께 드럼을 연습하는 웹앱이다. 악보 편집기는 없다.

## 지금 되는 것

- Next.js 16 App Router에서 합성 8마디 드럼 악보를 읽고, 4마디와 다음 첫 마디를 보여 준다.
- 원곡 WAV, 간단한 드럼 소리, 메트로놈, 카운트인, 50–150% 속도, 마디 반복을 한 시계로 진행한다.
- Supabase Google 로그인, 개인 곡 라이브러리, private Storage, RLS SQL을 코드로 갖춘다.

환경변수와 실제 MuseScore Studio 4.7 파일이 없으면 로그인, 권한 격리, 최신 악보 호환은 확인되지 않는다. 확인 범위는 [docs/engines.md](docs/engines.md)와 [docs/setup.md](docs/setup.md)에 적었다.

## 실행

```bash
npm ci
npm test
npm run verify:score
npm run dev
```

브라우저에서 `/lab`은 합성 악보 연습이다. `/songs`는 Supabase 환경변수가 있을 때 로그인 뒤 사용한다.

앱 코드의 Google 로그인(Supabase `signInWithOAuth`)은 이미 연결되어 있다. 버튼이 비활성이거나 `oauth`/`config` 오류가 나면 아래 콘솔·대시보드 설정과 환경변수가 빠진 것이다. 버전·SQL·배포 세부 절차는 [docs/setup.md](docs/setup.md)에 있다.

## Google 로그인 설정

리다이렉트는 두 단계다. Google → Supabase 콜백, 그다음 Supabase → 앱 `/auth/callback`. Google 콘솔에는 **Supabase 콜백만** 넣고, 앱 URL은 Supabase Redirect URLs에 넣는다.

### 1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만들거나 고른다.
2. **APIs & Services → OAuth consent screen**에서 External(또는 조직용 Internal) 동의 화면을 구성한다. 테스트 단계면 테스트 사용자에 본인 Google 계정을 추가한다.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins** (경로 없이 origin만)
     - 로컬: `http://localhost:3000`
     - 운영: `https://<your-app-host>`
   - **Authorized redirect URIs** (앱의 `/auth/callback`이 아님)
     - 호스팅 Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`
     - 로컬 Supabase CLI만 쓸 때: `http://127.0.0.1:54321/auth/v1/callback`
4. 만든 뒤 **Client ID**와 **Client secret**을 복사한다. 저장소와 `NEXT_PUBLIC_*`에는 넣지 않는다.

### 2. Supabase Dashboard

새 대시보드에서는 Authentication 왼쪽 메뉴 **CONFIGURATION → URL Configuration**(Multi-Factor와 Attack Protection 사이)이다.

1. Authentication → Providers → **Google**을 켜고 Client ID / Client secret을 붙여 넣는다.
2. Authentication → URL Configuration
   - **Site URL**: 운영 앱 주소 (예: `https://museplayer.snipkit.org`). 기본 `http://localhost:3000`이면 로그인 후 localhost로 폴백된다.
   - **Redirect URLs**에 앱 콜백을 추가한다. allow list에 없으면 Site URL로 떨어지며 `/?code=…`처럼 보인다.
     - `http://localhost:3000/auth/callback`
     - `https://museplayer.snipkit.org/auth/callback`
     - Preview·운영의 `https://<host>/auth/callback`
3. Project Settings → API에서 Project URL과 publishable key를 복사한다.
4. **SQL Editor**에서 [`supabase/migrations/0001_library.sql`](supabase/migrations/0001_library.sql) 전체를 한 번 실행한다. Vercel 배포는 SQL을 실행하지 않는다. 미적용 시 곡 목록에 `Could not find the table 'public.songs'`가 난다.
5. 로그인 **후에** SQL을 적용했다면 기존 사용자용 profile을 백필한다.

```sql
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    '연주자'
  )
from auth.users u
on conflict (id) do nothing;
```

### 3. 앱 환경변수

`.env.local`(로컬)과 Vercel Environment Variables(Production·Preview)에만 넣는다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

`service_role` / secret key는 넣지 않는다. 값이 없으면 `/login`의「Google 계정으로 계속」버튼이 비활성이다.

## 곡 추가

`/songs` → **곡 추가**에서 곡 이름과 함께 **악보 `.mscz`(필수)**, 원곡 음원(선택)을 올린다. 저장 후 곡 상세에서 파일을 바꿀 수 있다. Storage 버킷 `song-files`는 위 SQL에 포함된다.

## 라이선스

webmscore는 GPL이다. 이 앱이 그 코드를 브라우저에 포함해 배포하면 GPL 의무가 따른다. SoundTouchJS AudioWorklet은 MPL-2.0, 한글 폰트 고지는 `public/fonts/NOTICE.txt`에 있다.
