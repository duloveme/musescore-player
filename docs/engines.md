# 악보·소리 엔진 비교

조사일: 2026-10-18. 버전은 그날의 npm `latest`와 GitHub Releases 기준이다. canary는 사용하지 않는다.

| 후보 | 저장소 | npm | 안정 버전 | 최근 게시 | 라이선스 | 이 앱에서의 역할 |
| --- | --- | --- | --- | --- | --- | --- |
| webmscore | https://github.com/LibreScore/webmscore | https://www.npmjs.com/package/webmscore | 1.2.1 | 2023-01-24 | GPL | `.mscz`를 직접 읽고 SVG, MIDI, MusicXML, PDF를 만든다 |
| OpenSheetMusicDisplay | https://github.com/opensheetmusicdisplay/opensheetmusicdisplay | https://www.npmjs.com/package/opensheetmusicdisplay | 2.2.1 | 2026-10-12 | BSD-3-Clause | MusicXML 렌더링 대안. 의존성에 넣지 않음 |
| SpessaSynth | https://github.com/spessasus/SpessaSynth | https://www.npmjs.com/package/spessasynth_lib | 4.3.14 | 2026-08-18 | Apache-2.0 | SoundFont 재생. 의존성에 넣지 않음 |
| SoundTouchJS AudioWorklet | https://github.com/cutterbl/SoundTouchJS | https://www.npmjs.com/package/@soundtouchjs/audio-worklet | 2.1.1 | 2026-08-03 | MPL-2.0 | 원곡 음정을 유지한 속도 변경 |

MuseScore Studio 최신 안정 릴리스는 2026-09-08의 4.7.5다. https://github.com/musescore/MuseScore/releases/tag/v4.7.5

## 권장 조합

1. `.mscz`는 webmscore 1.2.1만 직접 읽는다. `WebMscore.version()`이 돌려주는 형식 상한은 400이고, 이는 MuseScore 4.0 계열이다. Studio 4.7 파일을 완벽히 연다고 보지 않는다. LibreScore 이슈에서 최근 MuseScore 4 파일이 비어 나오는 보고가 있다.
2. 드럼 소리는 악보 MIDI의 채널 10(파일에서는 0부터 세면 9) 음표를 AudioContext 오실레이터와 노이즈로 낸다. SoundFont 엔진은 iPad 메모리와 AudioWorklet 위험을 피하려고 넣지 않았다. 나중에 SpessaSynth로 바꿀 수 있게 음표 시각과 피치는 `LoadedScore.notes`에만 둔다.
3. 원곡 속도는 SoundTouch AudioWorklet이다. `playbackRate`와 SoundTouch `playbackRate`를 같은 배율로 두고 `pitch`는 1이다. 등록에 실패하면 화면에 음정이 바뀔 수 있다고 표시하고, 그 경우 브라우저 `playbackRate`만 사용한다.
4. OSMD는 MusicXML로 바꾼 뒤의 대안이다. 변환은 드럼 음표머리와 레이아웃을 잃을 수 있고, OSMD의 재생기는 후원 기능과 분리되어 있다. 지금 경로에서는 변환을 요구하지 않는다.

## webmscore에서 확인한 API

사용한 것: `ready`, `version()`, `load("mscz", bytes, fonts)`, `metadata()`, `measurePositions()`, `saveSvg`, `saveMidi(false, false)`, `savePdf()`, `saveXml()`, `destroy`.

사용하지 않는 것: `segmentPositions()`. Node에서 합성 악보와 공식 4.0.2 트레블 템플릿 모두 `RuntimeError: null function or function signature mismatch`가 났다. 커서는 SVG의 `class="Note"` transform과 MIDI 시작 시각을 맞춘다. 음표 사이 간격이 시간과 같다고 가정하지 않고, 인접한 음표 열 사이를 시간으로 보간한다.

`metadata.tempo`는 이 합성 파일에서 120이었다. 마디 이벤트 `position`은 밀리초다.

한글 폰트는 `load`의 fonts 인자로 넘긴다. 제목 문자열은 metadata에 남고, SVG 본문은 윤곽선이라 한글 코드포인트가 없을 수 있다.

## 직접 구현한 범위

- 2·4·8마디 창과 다음 화면의 첫 마디 미리보기. 미리보기 마디는 재생 순서를 건너뛰거나 두 번 재생하지 않는다.
- 악보 밀리초와 원곡 초의 구간 선형 매핑. 속도 배율은 매핑 밖에 둔다.
- 카운트인 0·1·2마디. 못갖춘마디여도 카운트인은 현재 박자표의 온마디다.
- 반복 기호, D.C., D.S.는 MusicXML 문자열에서 감지해 안내만 한다. 조용히 전개하지 않는다.
- 복잡한 마디는 배율 0.55 아래에서 음표를 겹치지 않고 가로 스크롤한다.

## 아직 확인하지 않은 것

- 사용자가 MuseScore Studio 4.7에서 저장한 실제 `.mscz`
- iPad Safari의 WASM, AudioWorklet, 긴 음원, 회전, 화면 잠금
- M4A 디코딩. 목표는 MP3·M4A·WAV이나 이 환경의 합성 음원은 WAV다.
- 유료 OSMD 재생기와 SpessaSynth를 실제 페이지에 올려 비교한 측정
