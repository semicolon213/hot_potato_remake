# clasp 가이드 - Apps Script 로컬 개발 및 배포

이 문서는 `appScript` 폴더의 Google Apps Script 코드를 clasp로 로컬에서 관리하고 배포하는 방법을 안내합니다.

---

## 목차

1. [사전 준비](#1-사전-준비)
2. [프로젝트 설정](#2-프로젝트-설정)
3. [일상 작업 (Push/Pull)](#3-일상-작업-pushpull)
4. [에디터 열기](#4-에디터-열기)
5. [배포](#5-배포)
6. [명령어 참조](#6-명령어-참조)
7. [문제 해결](#7-문제-해결)

---

## 1. 사전 준비

### clasp 설치

```bash
npm install -g @google/clasp
```

### 로그인

```bash
clasp login
```

브라우저가 열리면 Google 계정으로 로그인합니다.

### Apps Script API 활성화

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 → **API 및 서비스** → **라이브러리**
3. **Google Apps Script API** 검색 후 **사용 설정**

---

## 2. 프로젝트 설정

### 프로젝트 구조

```
hot_potato_remake/
├── .clasp.json          # clasp 설정 (스크립트 ID, rootDir)
├── appScript/           # Apps Script 소스 폴더
│   ├── appsscript.json  # Apps Script 매니페스트 (시간대 등)
│   ├── Main.gs
│   ├── CONFIG.gs
│   └── ...
└── docs/
```

### .clasp.json (프로젝트 루트)

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "appScript"
}
```

- `scriptId`: Apps Script 프로젝트 ID (script.google.com → 프로젝트 설정에서 확인)
- `rootDir`: 로컬 소스 폴더 경로

### appScript/appsscript.json

```json
{
  "timeZone": "Asia/Seoul",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

- `timeZone`: 한국 표준시 (Asia/Seoul)
- `.clasp.json`은 `.gitignore`에 포함되어 있습니다 (스크립트 ID 보안)

### 기존 프로젝트에 연결

스크립트 ID가 있을 때:

1. 프로젝트 루트에 `.clasp.json` 생성 (위 형식)
2. `appScript/appsscript.json` 생성 (없는 경우)

### 새 프로젝트로 연결

```bash
clasp create --type standalone --title "Hot Potato ERP" --rootDir appScript
```

---

## 3. 일상 작업 (Push/Pull)

### 로컬 → Apps Script (업로드)

```bash
clasp push
```

`appScript` 폴더의 `.gs` 파일들이 Apps Script 프로젝트로 업로드됩니다.

### Apps Script → 로컬 (다운로드)

```bash
clasp pull
```

웹 에디터에서 수정한 내용을 로컬로 가져옵니다. **주의**: 로컬 변경사항이 덮어쓰일 수 있습니다.

### 변경사항 미리보기

```bash
clasp status
```

push 시 업로드될 파일 목록을 확인합니다.

### 자동 업로드 (개발 중)

```bash
clasp push --watch
```

파일 저장 시 자동으로 push됩니다. `Ctrl+C`로 종료합니다.

---

## 4. 에디터 열기

### 웹 에디터에서 프로젝트 열기

```bash
clasp open-script
```

또는:

```bash
clasp open-container
```

> ⚠️ **참고**: 구 clasp에서는 `clasp open`이었으나, 최신 버전에서는 `clasp open-script` 또는 `clasp open-container`를 사용합니다.

### 로그 열기

```bash
clasp open-logs
```

### API 콘솔 열기

```bash
clasp open-api-console
```

---

## 5. 배포

### 5.1 코드 업로드

```bash
clasp push
```

### 5.2 버전 생성 (선택, 프로덕션 권장)

```bash
clasp version "버전 설명"
```

예: `clasp version "v1.0 - 초기 배포"`

### 5.3 배포 생성

```bash
clasp deploy --description "배포 설명"
```

예: `clasp deploy -d "Hot Potato API v1"`

### 5.4 웹앱 배포 (Web App URL 필요 시)

1. `clasp push`로 코드 업로드
2. `clasp open-script`로 웹 에디터 열기
3. **배포** → **새 배포** 클릭
4. **유형 선택** → **웹 앱** 선택
5. **액세스 권한** 설정:
   - **나**: 본인만
   - **내 조직**: 조직 내 사용자
   - **모든 사용자**: 익명 포함
6. **배포** 클릭 후 생성된 URL 복사

### 5.5 기존 배포 업데이트

```bash
# 배포 목록 확인
clasp deployments

# 특정 배포 ID로 재배포
clasp deploy -i <deploymentId> -d "업데이트 내용"
```

### 5.6 배포된 웹앱 열기

```bash
clasp open-web-app <deploymentId>
```

---

## 6. 명령어 참조

| 명령어 | 설명 |
|--------|------|
| `clasp login` | Google 로그인 |
| `clasp logout` | 로그아웃 |
| `clasp push` | 로컬 → Apps Script 업로드 |
| `clasp push --watch` | 파일 변경 시 자동 업로드 |
| `clasp pull` | Apps Script → 로컬 다운로드 |
| `clasp status` | push 대상 파일 목록 확인 |
| `clasp open-script` | 웹 에디터에서 프로젝트 열기 |
| `clasp open-container` | 웹 에디터에서 프로젝트 열기 |
| `clasp open-logs` | 실행 로그 열기 |
| `clasp version "설명"` | 새 버전 생성 |
| `clasp deploy -d "설명"` | 새 배포 생성 |
| `clasp deploy -i <ID> -d "설명"` | 기존 배포 업데이트 |
| `clasp deployments` | 배포 목록 조회 |
| `clasp open-web-app <ID>` | 배포된 웹앱 URL 열기 |
| `clasp logs` | 최근 로그 출력 |

---

## 7. 문제 해결

### "Unknown command clasp open"

최신 clasp에서는 `open` 대신 `open-script` 또는 `open-container`를 사용합니다.

```bash
clasp open-script
```

### "Read-only deployments may not be modified"

**원인**: `clasp deploy -i <deploymentId>`로 **Head 배포**(자동 생성된 최신 버전)나 **읽기 전용 배포**를 수정하려고 할 때 발생합니다.

**해결 방법**:

1. **새 배포 생성** (권장): `-i` 없이 새 배포를 만듭니다.
   ```bash
   clasp push
   clasp deploy -d "프로덕션 v1"
   ```
   새 배포가 생성되며, URL은 웹 에디터에서 확인할 수 있습니다.

2. **읽기 전용이 아닌 배포만 업데이트**: `clasp deployments`로 목록을 확인한 뒤, **Head**가 아닌 배포 ID만 `-i`로 사용합니다.

3. **버전을 지정해 배포**: 먼저 버전을 만들고, 그 버전으로 배포합니다.
   ```bash
   clasp push
   clasp version "v1.0"
   clasp deploy -V 1 -d "프로덕션"
   ```

> **참고**: Head 배포는 `clasp push`로 코드를 올리면 자동으로 최신 코드가 반영됩니다. 웹앱 URL을 유지하려면 웹 에디터에서 **배포** → **배포 관리** → 기존 배포에서 **버전**을 변경해 새 버전으로 업데이트하세요.

### "Permission denied" / 403 오류

- Apps Script API가 활성화되어 있는지 확인
- `clasp login` 다시 실행
- Google Cloud Console에서 해당 프로젝트에 Apps Script API 권한 확인

### push 시 "No files to push"

- `.clasp.json`의 `rootDir`가 `appScript`로 올바르게 설정되었는지 확인
- `appScript` 폴더에 `.gs` 파일이 있는지 확인

### .clasp.json을 Git에 올리지 않기

`.clasp.json`에는 스크립트 ID가 포함되어 있으므로 `.gitignore`에 추가하는 것을 권장합니다.  
팀원은 각자 `.clasp.json`을 로컬에 생성해야 합니다.

### package.json 스크립트 추가 (선택)

```json
{
  "scripts": {
    "appscript:push": "clasp push",
    "appscript:pull": "clasp pull",
    "appscript:open": "clasp open-script",
    "appscript:deploy": "clasp deploy -d \"Production\""
  }
}
```

---

## 관련 문서

- [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md) - Apps Script 스크립트 속성 설정
- [appScript/README.md](../appScript/README.md) - Apps Script 코드 구조 및 기능
