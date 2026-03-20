# 문서 안내

**HP ERP (Hot Potato)** 프로젝트 문서입니다. 팀 **김원일의 보석함**.

---

## 빠르게 찾기

| 하고 싶은 일 | 문서 |
|-------------|------|
| 처음 세팅·클론·빌드 | [설치 가이드](./INSTALLATION_GUIDE.md) |
| `.env`·JSON 환경변수 | [환경 변수](./ENVIRONMENT_VARIABLES_SETUP.md), [ENV V2 전환](./ENV_CONFIG_V2_전환_가이드.md) |
| 웹/Electron 배포·태그 릴리즈 | [배포 가이드](./DEPLOYMENT_GUIDE.md) |
| CI 워크플로우 수정·검증 기준 | [CI/CD 업데이트](./CI_CD_UPDATE_GUIDE.md), [검증 기준](./CI_CD_VALIDATION_CRITERIA.md) |
| 폴더·시트 이름 규칙 | [Drive 폴더 구조](./DRIVE_FOLDER_STRUCTURE.md) |
| `src/` 구조 | [프론트엔드 구조](./FRONTEND_STRUCTURE.md) |
| GAS 로컬 편집·배포 | [Clasp 가이드](./CLASP_GUIDE.md) |
| Apps Script 액션·엔드포인트 개요 | [API 문서](./API_DOCUMENTATION.md) |
| 캐시·동기화(IndexedDB, ApiClient) | [데이터 캐싱](./DATA_CACHING_STRATEGY.md) — *상세·장문* |
| 아키텍처·모듈 개요 | [프로젝트 문서](./PROJECT_DOCUMENTATION.md) |

백엔드 스크립트 일괄 배포·파일 설명: **[`../appScript/README.md`](../appScript/README.md)**

---

## 문서 구성

### 1. 온보딩

- **INSTALLATION_GUIDE** — 클론, `npm install`, `dev` / `build`
- **ENVIRONMENT_VARIABLES_SETUP** + **ENV_CONFIG_V2_전환_가이드** — `VITE_*`, JSON `.env`

### 2. 배포·자동화

- **DEPLOYMENT_GUIDE** — GitHub Actions, Electron 릴리즈, 태그
- **CI_CD_UPDATE_GUIDE**, **CI_CD_VALIDATION_CRITERIA** — 파이프라인 유지보수

### 3. 구조·연동

- **DRIVE_FOLDER_STRUCTURE** — Google Drive 디렉터리·폴더명 규칙
- **FRONTEND_STRUCTURE** — React 컴포넌트·훅 배치
- **PROJECT_DOCUMENTATION** — 기술 스택·디렉터리·리팩터링 요약
- **CLASP_GUIDE** — Apps Script ↔ 저장소 동기화

### 4. API·데이터

- **API_DOCUMENTATION** — 프록시·액션 문자열 개요
- **DATA_CACHING_STRATEGY** — 캐시 키, 무효화, DataSync (구현 상세)

---

## 보관 문서 (`archive/`)

과거 **이슈 분석·디자인 초안·리팩터링 기록**만 두었습니다. 일상 개발·온보딩에는 위 표의 문서만 보면 됩니다.

| 파일 | 비고 |
|------|------|
| [archive/BUG_FIXES_personalFavoriteManager.md](./archive/BUG_FIXES_personalFavoriteManager.md) | 즐겨찾기 버그 수정 기록 |
| [archive/TYPE_ERROR_FIXES.md](./archive/TYPE_ERROR_FIXES.md) | TS 타입 정리 이력 |
| [archive/REFACTORING_DOCUMENTATION.md](./archive/REFACTORING_DOCUMENTATION.md) | 대규모 리팩터링 노트 |
| [archive/DESIGN_ANALYSIS.md](./archive/DESIGN_ANALYSIS.md) | UI/디자인 분석 초안 |
| [archive/초기_로딩_분석.md](./archive/초기_로딩_분석.md) | 초기 로딩 성능 메모 |

자세한 안내: [archive/README.md](./archive/README.md)

---

## 루트 README

프로젝트 요약·팀명·빠른 시작: 저장소 루트 [**`README.md`**](../README.md).
