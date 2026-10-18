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

선택한 버전과 OAuth·SQL 절차는 [docs/setup.md](docs/setup.md)에 있다.

## 라이선스

webmscore는 GPL이다. 이 앱이 그 코드를 브라우저에 포함해 배포하면 GPL 의무가 따른다. SoundTouchJS AudioWorklet은 MPL-2.0, 한글 폰트 고지는 `public/fonts/NOTICE.txt`에 있다.
