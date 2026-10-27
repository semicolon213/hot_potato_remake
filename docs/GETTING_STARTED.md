# 개발 환경 시작하기

> 대상: 이미 배포된 Apps Script 백엔드가 있고, 프론트엔드를 로컬에서 개발하려는 사람
> 백엔드부터 새로 세팅해야 한다면 [DEPLOYMENT.md](./DEPLOYMENT.md)를 먼저 보세요.

## 1. 준비물

| 항목 | 버전 |
|---|---|
| Node.js | 18 이상 (Netlify 빌드 환경이 18입니다) |
| npm | 9 이상 |
| Google 계정 | 승인된 HP ERP 계정 (로그인 테스트용) |
| Apps Script 웹앱 URL | `https://script.google.com/macros/s/.../exec` (팀에서 받기) |
| OAuth 클라이언트 ID | `http://localhost:5173`이 승인된 원본·리디렉션 URI로 등록돼 있어야 함 |

## 2. 설치

```bash
git clone https://github.com/semicolon213/hot_potato_remake.git
cd hot_potato_remake
npm ci
cp .env.example .env
```

## 3. 환경변수 (`.env`)

| 변수 | 필수 | 설명 |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | ✅ | Google OAuth 클라이언트 ID |
| `VITE_APP_SCRIPT_URL` | ✅ | Apps Script 웹앱 `/exec` URL. 로컬에서는 Vite 프록시(`/api`)가 이 주소로 전달 |
| `VITE_FOLER_NAME` | — | Drive 폴더 이름 JSON (`ROOT`, `DOCUMENT`, `WORKFLOW`, `ACCOUNT`, `ACCOUNT_EVIDENCE` …). 철자 `FOLER`는 그대로 씀 |
| `VITE_SPREADSHEET_NAME` | — | 스프레드시트 이름 JSON (`CONFIG`, `NOTICE`, `CALENDAR_*`, `STUDENT`, `STAFF`, `TAG`) |
| `VITE_SHEET_NAME` | — | 시트 이름 JSON |
| `VITE_GROUP_EMAIL` | — | 역할별 Google 그룹 이메일 JSON |

- JSON 변수를 비우거나 잘못 쓰면 `src/config/environment.ts`의 기본값과 합쳐집니다. 앱 시작 시 콘솔에 경고만 나오고 실행은 계속됩니다.
- 값의 예시는 `.env.example`에 있습니다.
- `.env`는 커밋하지 않습니다.

## 4. 실행

| 명령 | 용도 | 주소 |
|---|---|---|
| `npm run dev:web` | 웹만 실행 (가장 많이 씀) | http://localhost:5173 |
| `npm run dev` | 웹 + Electron 동시 실행 | 5173 + 데스크톱 창 |
| `npm run dev:netlify` | Netlify Function까지 로컬에서 실행 | http://localhost:8888 |

로그인 후 대시보드가 뜨고, 개발자 도구 콘솔에 `API 응답 성공` 로그가 보이면 정상입니다.

## 5. 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `npm run build` | 프로덕션 빌드 → `dist/` |
| `npm run preview` | 빌드 결과 미리 보기 |
| `npm test` | Jest 테스트 |
| `npm run test:coverage` | 커버리지 포함 테스트 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 적용 |
| `npx tsc --noEmit -p tsconfig.app.json` | 타입 검사 ([CONVENTIONS.md](./CONVENTIONS.md#포맷과-린트) 참고) |
| `npm run bundle-size` | 빌드 후 번들 크기 검사 |
| `npm run ci` | 타입 체크 → 린트 → 포맷 → 테스트 → audit (로컬 품질 검사) |
| `npm run electron:build` | 데스크톱 앱 패키징 → `dist-electron/` |

## 6. 코드 둘러보기

처음 읽을 때는 아래 순서를 추천합니다.

1. `src/App.tsx` — 로그인·승인 게이트, 앱 셸
2. `src/hooks/core/useAppState.ts` — 전역 상태와 로그인 후 초기화
3. `src/components/layout/PageRenderer.tsx` — 화면 전환
4. `src/utils/api/apiClient.ts` — Apps Script 호출, 재시도, 캐시
5. `appScript/Main.gs` — 백엔드 라우터 (`doPost`)

구조는 [ARCHITECTURE.md](./ARCHITECTURE.md), 규칙은 [CONVENTIONS.md](./CONVENTIONS.md)를 보세요.

## 7. 로컬에서 자주 막히는 문제

| 증상 | 해결 |
|---|---|
| 콘솔에 `VITE_APP_SCRIPT_URL` 경고, API 404 | `.env`에 `VITE_APP_SCRIPT_URL`을 넣고 dev 서버 재시작 |
| 로그인 후 `redirect_uri_mismatch` | Google Cloud Console의 OAuth 클라이언트에 `http://localhost:5173`을 원본·리디렉션 URI로 추가 |
| 예전 데이터가 계속 보임 | 헤더의 새로고침 버튼(캐시 초기화) 또는 localStorage의 `cache_*` 삭제 |
| 5173 포트 사용 중 | 기존 dev 서버 종료 또는 `npx vite --port 5174` (OAuth URI도 추가 필요) |

운영 환경 장애는 [RUNBOOK.md](./RUNBOOK.md)를 보세요.
