# HP ERP 초기 환경 세팅 가이드

> 전체 문서 목차: [docs/README.md](./README.md)
>
> 이 문서는 **처음 프로젝트를 세팅**하거나 **Netlify로 웹 배포**를 진행할 때 필요한 모든 단계를 안내합니다.

---

## 📋 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [Google Cloud Console 설정](#2-google-cloud-console-설정)
3. [Google Apps Script 설정 및 배포](#3-google-apps-script-설정-및-배포)
4. [Google Drive 폴더/시트 초기화](#4-google-drive-폴더시트-초기화)
5. [프로젝트 로컬 환경 설정](#5-프로젝트-로컬-환경-설정)
6. [Netlify 배포](#6-netlify-배포)
7. [OAuth 리디렉션 URI 등록](#7-oauth-리디렉션-uri-등록)
8. [배포 후 확인](#8-배포-후-확인)
9. [트러블슈팅](#9-트러블슈팅)

---

## 1. 사전 요구사항

| 항목 | 버전/요구사항 |
|------|---------------|
| Node.js | 18 이상 (22.x 권장) |
| npm | 9 이상 |
| Git | 최신 버전 |
| Google 계정 | OAuth용 |
| Netlify 계정 | [netlify.com](https://netlify.com) 회원가입 |
| GitHub | 저장소 푸시용 |

---

## 2. Google Cloud Console 설정

### 2.1 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 상단 프로젝트 선택 → **새 프로젝트** 클릭
3. 프로젝트 이름 입력 (예: `HP ERP`)
4. **만들기** 클릭

### 2.2 OAuth 동의 화면 설정

1. 왼쪽 메뉴 **APIs & Services** → **OAuth 동의 화면**
2. **외부** 사용자 유형 선택 → **만들기**
3. 앱 정보 입력:
   - **앱 이름**: HP ERP (또는 원하는 이름)
   - **사용자 지원 이메일**: 본인 이메일
   - **개발자 연락처**: 본인 이메일
4. **저장 후 계속** → **저장 후 계속** (범위·테스트 사용자 단계는 건너뛰어도 됨)

### 2.3 OAuth 2.0 클라이언트 ID 생성

1. **APIs & Services** → **사용자 인증 정보**
2. **+ 사용자 인증 정보 만들기** → **OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. **이름**: `HP ERP Web` (또는 원하는 이름)
5. **승인된 JavaScript 원본** 추가:
   - `http://localhost:5173` (개발용)
   - `http://localhost:8888` (netlify dev용)
   - `https://YOUR_SITE.netlify.app` (배포 후 실제 Netlify URL로 교체)
6. **승인된 리디렉션 URI** 추가:
   - `http://localhost:5173`
   - `http://localhost:8888`
   - `https://YOUR_SITE.netlify.app`
7. **만들기** 클릭
8. **클라이언트 ID** 복사 (나중에 `.env`에 사용)

### 2.4 필요한 API 활성화

1. **APIs & Services** → **라이브러리**
2. 아래 API 검색 후 **사용 설정**:
   - **Google Sheets API**
   - **Google Drive API**
   - **Google Docs API**
   - **Google Calendar API** (캘린더 사용 시)

---

## 3. Google Apps Script 설정 및 배포

### 3.1 Apps Script 프로젝트 생성

1. [script.google.com](https://script.google.com) 접속
2. **새 프로젝트** 클릭
3. 프로젝트 이름을 `HP ERP Backend` 등으로 변경

### 3.2 Advanced Services 연결

1. 왼쪽 **+** 버튼 → **서비스** → 아래 API 추가:
   - **Drive API** (v2)
   - **Admin SDK** (워크스페이스 사용자 승인 시 그룹스 자동 멤버 추가용)
2. (선택) **Drive Activity API** 도 필요할 수 있음

> **워크스페이스** 사용 시: Admin SDK가 appsscript.json에 포함되어 있으면, 사용자 승인 시 그룹스에 자동으로 멤버가 추가됩니다.  
> 스크립트 속성 `GROUP_EMAIL_JSON`에 그룹 이메일을 설정하세요. (없으면 기본 매핑 사용)

### 3.3 코드 배포

1. 저장소의 `appScript/` 폴더 내용을 Apps Script 프로젝트에 복사
2. [Clasp 가이드](./CLASP_GUIDE.md) 참고하여 `clasp push`로 배포하거나, 수동으로 파일 복사

### 3.4 웹 앱으로 배포

1. **배포** → **새 배포**
2. 유형: **웹 앱**
3. 설명: `HP ERP API`
4. **실행 사용자**: **본인** (또는 서비스 계정에 맞게)
5. **액세스 권한**: **모든 사용자** (로그인한 사용자만 접근)
6. **배포** 클릭
7. **웹 앱 URL** 복사 (형식: `https://script.google.com/macros/s/XXXXX/exec`)

### 3.5 스크립트 속성 설정

1. **프로젝트 설정** (⚙️) → **스크립트 속성**
2. 아래 속성 추가:

| 키 | 값 |
|----|-----|
| `ROOT_FOLDER_NAME` | `hot_potato_remake` |
| `DOCUMENT_FOLDER_NAME` | `document` |
| `SHARED_DOCUMENT_FOLDER_NAME` | `shared_documents` |
| `TEMPLATE_FOLDER_NAME` | `shared_forms` |
| `WORKFLOW_FOLDER_NAME` | `workflow` |
| `ACCOUNT_FOLDER_NAME` | `account` |
| `SHEET_NAME_USER` | `user` |
| `SHEET_NAME_ADMIN_KEYS` | `admin_keys` |
| `NOTICE_SHEET_NAME` | `시트1` |
| `NOTICE_SPREADSHEET_NAME` | `notice` |
| `GROUP_EMAIL_JSON` | (선택) 워크스페이스 그룹 이메일 JSON, VITE_GROUP_EMAIL과 동일 형식 |

> `initializeSystem()` 실행 시 위 속성들이 자동 설정됩니다. (기존 값 유지)

> 상세 목록: [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md)

---

## 4. Google Drive 폴더/시트 초기화

### 4.1 InitialSetup 실행

1. Apps Script 에디터에서 `InitialSetup.gs` 파일 열기
2. 함수 선택: `initializeSystem`
3. **실행** (▶️) 클릭
4. 첫 실행 시 권한 승인 (본인 Google 계정)
5. 실행 로그에서 생성된 폴더/스프레드시트 ID 확인

### 4.2 스크립트 속성만 초기화 (선택)

폴더/시트는 이미 있고 스크립트 속성만 설정하고 싶을 때:
- 함수 선택: `setupScriptPropertiesOnly`
- 실행하면 필요한 모든 스크립트 속성을 기본값으로 설정 (기존 값은 유지)

### 4.3 hp_member 스프레드시트 연결

1. **InitialSetup** 실행 시 생성된 `hp_member` 스프레드시트 열기
2. 해당 스프레드시트를 **Apps Script 프로젝트에 연결**:
   - Apps Script 에디터 → **프로젝트 설정** → **Google 프로젝트** → 스프레드시트 ID 입력
   - 또는 `SPREADSHEET_ID` 스크립트 속성에 `hp_member` 스프레드시트 ID 추가

3. 스크립트 속성에 추가:
   - `ROOT_FOLDER_ID`: 초기화 시 생성된 루트 폴더 ID
   - `SPREADSHEET_ID`: hp_member 스프레드시트 ID

### 4.4 생성되는 구조

```
hot_potato_remake/
├── hp_member          (회원 관리)
├── notice/            (공지사항)
├── account/           (회계)
├── workflow/          (결재)
├── document/          (문서)
├── professor/         (교수 캘린더)
├── student/           (학생 캘린더)
├── std_council/       (학생회)
├── adj_professor/     (겸임교수 캘린더)
└── assistant/         (조교)
```

> 상세 구조: [DRIVE_FOLDER_STRUCTURE.md](./DRIVE_FOLDER_STRUCTURE.md)

---

## 5. 프로젝트 로컬 환경 설정

### 5.1 저장소 클론

```bash
git clone <저장소-URL>
cd hot_potato_remake
```

### 5.2 의존성 설치

```bash
npm install
```

### 5.3 환경 변수 (.env) 설정

1. `.env.example`을 `.env`로 복사
2. 필수 값 채우기:

```env
# Google OAuth (2.3에서 복사한 클라이언트 ID)
VITE_GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com

# Apps Script 웹 앱 URL (3.4에서 복사)
VITE_APP_SCRIPT_URL=https://script.google.com/macros/s/XXXXX/exec

# 아래 JSON들은 기본값 그대로 사용해도 됨
VITE_FOLER_NAME={ "ROOT": "hot_potato_remake", ... }
VITE_SPREADSHEET_NAME={ "CONFIG": "user_setting", ... }
VITE_SHEET_NAME={ "DEFAULT": "시트1", ... }
VITE_GROUP_EMAIL={ "STUDENT": "...", ... }
```

> 전체 환경변수: [.env.example](../.env.example), [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md)

### 5.4 로컬 동작 확인

```bash
npm run build
npm run dev:web
```

브라우저에서 `http://localhost:5173` 접속 후 Google 로그인 테스트.

**Netlify 환경 로컬 테스트** (선택):

```bash
npm run dev:netlify
```

`http://localhost:8888` 에서 Vite + Netlify Functions 동시 테스트 가능.

---

## 6. Netlify 배포

> 📋 **체크리스트**: [NETLIFY_DEPLOYMENT_CHECKLIST.md](./NETLIFY_DEPLOYMENT_CHECKLIST.md)에서 배포 작업 목록을 확인할 수 있습니다.

### 6.1 사이트 생성

1. [Netlify 대시보드](https://app.netlify.com/) 접속
2. **Add new site** → **Import an existing project**
3. **GitHub** 선택 후 저장소 연결
4. 브랜치: `main` (또는 배포할 브랜치)

### 6.2 빌드 설정

Netlify가 `netlify.toml`을 읽어 자동 설정합니다. 수동 확인 시:

| 항목 | 값 |
|------|-----|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Base directory | (비움) |

### 6.3 환경 변수 설정

**Site settings** → **Environment variables** → **Add a variable** (또는 **Import from .env**)

#### 필수 변수

| 변수명 | 값 | 비고 |
|--------|-----|------|
| `VITE_GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | Google OAuth 클라이언트 ID |
| `VITE_APP_SCRIPT_URL` | `https://script.google.com/macros/s/XXXXX/exec` | Apps Script 웹 앱 URL |
| `APP_SCRIPT_URL` | (同上) | Netlify Function에서 사용 (선택, VITE_* 있으면 됨) |

#### 선택 변수 (기본값 변경 시)

| 변수명 | 예시 |
|--------|------|
| `VITE_FOLER_NAME` | JSON 문자열 |
| `VITE_SPREADSHEET_NAME` | JSON 문자열 |
| `VITE_SHEET_NAME` | JSON 문자열 |
| `VITE_GROUP_EMAIL` | JSON 문자열 |

> ⚠️ **주의**: `VITE_APP_SCRIPT_URL`은 **빌드 시**와 **Netlify Functions**에서 모두 사용됩니다. Netlify 대시보드에서 반드시 설정하세요.

### 6.4 배포 트리거

- **Push to main** 시 자동 배포
- 또는 **Deploys** → **Trigger deploy** → **Deploy site**

### 6.5 커스텀 도메인 (선택)

1. **Domain settings** → **Add custom domain**
2. 도메인 입력 후 DNS 설정

---

## 7. OAuth 리디렉션 URI 등록

Netlify 배포 후 **실제 사이트 URL**을 Google OAuth에 등록해야 합니다.

### 7.1 Netlify 사이트 URL 확인

배포 후 `https://사이트이름.netlify.app` 또는 커스텀 도메인 URL 확인

### 7.2 Google Cloud Console에 추가

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **사용자 인증 정보**
2. 방금 만든 **OAuth 2.0 클라이언트 ID** 클릭
3. **승인된 JavaScript 원본**에 추가:
   - `https://사이트이름.netlify.app`
4. **승인된 리디렉션 URI**에 추가:
   - `https://사이트이름.netlify.app`
5. **저장**

---

## 8. 배포 후 확인

### 8.1 체크리스트

- [ ] Netlify 사이트 접속 시 로그인 화면 표시
- [ ] Google 로그인 버튼 클릭
- [ ] OAuth 동의 화면 후 리디렉션 성공
- [ ] 승인 대기 또는 메인 화면 진입
- [ ] 공지사항, 캘린더 등 데이터 로딩

### 8.2 API 연결 테스트

배포된 사이트에서 로그인 후:

1. **대시보드** 또는 **공지사항** 페이지 확인
2. 개발자 도구(F12) → **Console** 탭
3. `API 요청 시도`, `캐시에서 데이터 로드` 등의 로그 확인
4. 403, 500 등 에러가 없으면 정상

---

## 9. 트러블슈팅

### 로그인 후 빈 화면 / 리디렉션 실패

- **원인**: OAuth 리디렉션 URI 미등록 또는 오타
- **해결**: Google Cloud Console에서 Netlify URL이 **정확히** 등록되었는지 확인

### API 요청 404 / 500

- **원인**: `VITE_APP_SCRIPT_URL` 미설정 또는 잘못된 URL
- **해결**: Netlify 환경 변수 확인, Apps Script 웹 앱 URL 재확인

### CORS 에러

- **원인**: 브라우저에서 Apps Script URL로 직접 요청 (프록시 미사용)
- **해결**: 코드가 `/.netlify/functions/proxy`를 사용하는지 확인 (배포 빌드에서는 `import.meta.env.DEV === false`)

### "Apps Script URL이 설정되지 않았습니다"

- **원인**: Netlify Function `proxy.js`에서 `VITE_APP_SCRIPT_URL` 또는 `APP_SCRIPT_URL`을 못 읽음
- **해결**: Netlify Site settings → Environment variables에서 위 변수 설정

### 스프레드시트/폴더를 찾을 수 없음

- **원인**: InitialSetup 미실행, 또는 스크립트 속성 `ROOT_FOLDER_ID`/`SPREADSHEET_ID` 미설정
- **해결**: [4. Google Drive 폴더/시트 초기화](#4-google-drive-폴더시트-초기화) 절차 재실행

---

## 관련 문서

| 문서 | 용도 |
|------|------|
| [NETLIFY_DEPLOYMENT_CHECKLIST.md](./NETLIFY_DEPLOYMENT_CHECKLIST.md) | Netlify 배포 시 수행할 작업 체크리스트 |
| [INSTALLATION_GUIDE.md](./INSTALLATION_GUIDE.md) | 클론·빌드·개발 서버 |
| [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md) | 환경변수·스크립트 속성 |
| [DRIVE_FOLDER_STRUCTURE.md](./DRIVE_FOLDER_STRUCTURE.md) | Drive 폴더 구조 |
| [CLASP_GUIDE.md](./CLASP_GUIDE.md) | Apps Script 배포 |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Electron·GitHub Actions |

---

**작성일**: 2025  
**버전**: 1.0
