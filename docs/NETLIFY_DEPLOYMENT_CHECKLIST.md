# Netlify 배포 체크리스트

> Netlify로 HP ERP 배포 시 수행할 작업 목록입니다.  
> 상세 설명: [초기 세팅 가이드](./INITIAL_SETUP_GUIDE.md)

---

## 사전 준비 (배포 전에 완료)

| # | 작업 | 확인 |
|---|------|------|
| 1 | Google Cloud Console에서 OAuth 클라이언트 ID 생성 | □ |
| 2 | Apps Script 프로젝트 생성 및 코드 배포 | □ |
| 3 | Apps Script 웹 앱 배포 후 URL 복사 | □ |
| 4 | `initializeSystem()` 실행 후 Drive 폴더/시트 생성 | □ |
| 5 | Apps Script 스크립트 속성 설정 (`setupScriptPropertiesOnly` 또는 `initializeSystem`) | □ |

---

## 1. Netlify 사이트 생성

| # | 작업 | 방법 |
|---|------|------|
| 1 | Netlify 계정 로그인 | [app.netlify.com](https://app.netlify.com) |
| 2 | 새 사이트 추가 | **Add new site** → **Import an existing project** |
| 3 | GitHub 저장소 연결 | 저장소 선택, 브랜치 `main` (또는 사용 브랜치) |

---

## 2. 빌드 설정

`netlify.toml`이 있어 자동 적용됩니다. 수동 확인:

| 항목 | 값 |
|------|-----|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Base directory | (비움) |
| Node version | 18 (netlify.toml에 설정됨) |

---

## 3. 환경 변수 설정 ⭐ 필수

**Site settings** → **Environment variables** → **Add a variable** (또는 **Import from .env**)

### 3.1 필수 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID | `65151...kkvgct.apps.googleusercontent.com` |
| `VITE_APP_SCRIPT_URL` | Apps Script 웹 앱 URL | `https://script.google.com/macros/s/xxxx/exec` |
| `APP_SCRIPT_URL` | (동일) Netlify Function proxy에서 사용 | 위와 동일 |

> ⚠️ `VITE_*` 변수는 **빌드 시** 번들에 포함됩니다. 변경 후 **재배포** 필요.

### 3.2 선택 변수 (기본값과 다를 때만)

| 변수명 | 설명 | 기본값 |
|--------|------|--------|
| `VITE_FOLER_NAME` | 폴더 이름 JSON | `{"ROOT":"hot_potato_remake",...}` |
| `VITE_SPREADSHEET_NAME` | 스프레드시트 이름 JSON | `{"CONFIG":"user_setting","NOTICE":"notice",...}` |
| `VITE_SHEET_NAME` | 시트 이름 JSON | `{"DEFAULT":"시트1",...}` |
| `VITE_GROUP_EMAIL` | 그룹 이메일 JSON | `{"STUDENT":"...","COUNCIL":"...",...}` |

---

## 4. OAuth 리디렉션 URI 등록

배포 후 Netlify 사이트 URL이 확정되면:

| # | 작업 | 방법 |
|---|------|------|
| 1 | Netlify 사이트 URL 확인 | 예: `https://사이트이름.netlify.app` |
| 2 | Google Cloud Console 접속 | APIs & Services → 사용자 인증 정보 |
| 3 | OAuth 클라이언트 ID 편집 | 해당 클라이언트 클릭 |
| 4 | **승인된 JavaScript 원본**에 추가 | `https://사이트이름.netlify.app` |
| 5 | **승인된 리디렉션 URI**에 추가 | `https://사이트이름.netlify.app` |
| 6 | 저장 | |

---

## 5. 배포 트리거

| 방법 | 설명 |
|------|------|
| Push to main | `main` 브랜치에 푸시 시 자동 배포 |
| 수동 배포 | Deploys → **Trigger deploy** → **Deploy site** |

---

## 6. 배포 후 확인

| # | 확인 항목 | 기대 결과 |
|---|-----------|-----------|
| 1 | 사이트 접속 | 로그인 화면 표시 |
| 2 | Google 로그인 클릭 | OAuth 동의 → 리디렉션 성공 |
| 3 | 로그인 후 대시보드 | 위젯·데이터 로딩 |
| 4 | 개발자 도구 Console | `API 요청 시도`, `캐시에서 데이터 로드` 등 정상 로그 |
| 5 | 404/500 에러 없음 | 네트워크 탭에서 확인 |

---

## 7. 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| 로그인 후 빈 화면 / 리디렉션 실패 | OAuth URI 미등록 | Google Cloud Console에서 Netlify URL 등록 |
| API 404/500 | `VITE_APP_SCRIPT_URL` 미설정 | Netlify 환경 변수 확인 |
| "Apps Script URL이 설정되지 않았습니다" | Function에서 env 못 읽음 | `APP_SCRIPT_URL` 또는 `VITE_APP_SCRIPT_URL` 설정 |
| CORS 에러 | 프록시 미사용 | 배포 빌드는 `/.netlify/functions/proxy` 사용 확인 |
| 스프레드시트/폴더 찾을 수 없음 | Apps Script 초기화 미실행 | `initializeSystem()` 실행, 스크립트 속성 확인 |

---

## 8. 환경 변수 변경 시

1. Netlify 대시보드에서 환경 변수 수정
2. **Deploys** → **Trigger deploy** → **Clear cache and deploy site** (VITE_* 변경 시 캐시 클리어 권장)

---

## 관련 문서

| 문서 | 용도 |
|------|------|
| [INITIAL_SETUP_GUIDE.md](./INITIAL_SETUP_GUIDE.md) | 전체 초기 세팅 (Google API, Drive, Netlify) |
| [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md) | .env, Apps Script 스크립트 속성 |
| [CLASP_GUIDE.md](./CLASP_GUIDE.md) | Apps Script 코드 배포 |
