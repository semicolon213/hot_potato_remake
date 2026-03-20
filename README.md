# HP ERP (Hot Potato)

Google Workspace 기반 통합 ERP — 문서, 캘린더, 회계, 워크플로우, 공지·게시판을 한곳에서 다룹니다.

| | |
|---|---|
| **팀** | **김원일의 보석함** |
| **스택** | React 19 · TypeScript · Vite · Google Apps Script · Electron(선택) |
| **저장소** | Private |

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/license-Private-lightgrey)]()

---

## 목차

- [기능](#기능)
- [빠른 시작](#빠른-시작)
- [스크립트](#스크립트)
- [디렉터리 개요](#디렉터리-개요)
- [문서](#문서)
- [라이선스 · 팀](#라이선스--팀)

---

## 기능

| 영역 | 설명 |
|------|------|
| **인증** | Google OAuth 2.0, 역할·승인 기반 접근 |
| **문서** | Docs/Sheets 템플릿, 권한·폴더 연동 |
| **캘린더** | Google Calendar 연동, 일정·반복 규칙 |
| **회계** | 장부·예산·카테고리·증빙 폴더 연계 |
| **워크플로우** | 결재 라인·상태·이력 |
| **공지·게시** | 공지사항, 첨부·고정 등 |

---

## 빠른 시작

### 요구 사항

- **Node.js** 22.x 권장  
- **Google Cloud** 프로젝트(OAuth, Drive/Sheets/Calendar API)  
- 배포된 **Google Apps Script** 웹앱 URL

### 설치

```bash
git clone <저장소-URL>
cd hot_potato_remake
npm install
```

### 환경 변수

1. `.env.example`을 복사해 `.env`로 저장합니다.  
2. 최소한 다음을 채웁니다.
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_APP_SCRIPT_URL`
   - `VITE_FOLER_NAME`, `VITE_SPREADSHEET_NAME`, `VITE_SHEET_NAME` 등 JSON 형식 항목(예시는 `.env.example` 참고)

상세: **[`docs/README.md`](./docs/README.md)** 목차에서 환경 변수 항목 → [`ENVIRONMENT_VARIABLES_SETUP.md`](./docs/ENVIRONMENT_VARIABLES_SETUP.md), [`ENV_CONFIG_V2_전환_가이드.md`](./docs/ENV_CONFIG_V2_전환_가이드.md)

### 개발 서버

```bash
# 웹만 (브라우저 http://localhost:5173)
npm run dev:web

# 웹 + Electron 동시
npm run dev
```

### 빌드

```bash
npm run build          # 웹 정적 파일 → dist/
npm run electron:build # 웹 빌드 후 Electron 패키징
```

### 품질

```bash
npm run type-check
npm run lint
npm run test
```

---

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | Vite + Electron 개발 |
| `npm run dev:web` | Vite만 |
| `npm run build` | 프로덕션 웹 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run electron:dev` / `electron:build` | Electron 전용 |
| `npm run test` / `test:coverage` | Jest |
| `npm run format` / `format:check` | Prettier |

---

## 디렉터리 개요

```
hot_potato_remake/
├── src/                 # React 앱 (pages, components, hooks, utils, config)
├── appScript/           # Google Apps Script (Main.gs 등)
├── electron/            # Electron 메인 프로세스
├── public/
├── docs/                # 문서 목차 README.md + 가이드·레퍼런스 (+ archive/)
└── package.json
```

Apps Script 배포·연동: [`appScript/README.md`](./appScript/README.md)

---

## 문서

| 문서 | 내용 |
|------|------|
| **[`docs/README.md`](./docs/README.md)** | **전체 목차·빠른 찾기 (여기서 시작)** |
| [`docs/INSTALLATION_GUIDE.md`](./docs/INSTALLATION_GUIDE.md) | 설치 상세 |
| [`docs/DEPLOYMENT_GUIDE.md`](./docs/DEPLOYMENT_GUIDE.md) | 배포·CI |
| [`docs/PROJECT_DOCUMENTATION.md`](./docs/PROJECT_DOCUMENTATION.md) | 아키텍처·구조 레퍼런스 |
| [`appScript/README.md`](./appScript/README.md) | Google Apps Script |

---

## 라이선스 · 팀

- **라이선스:** 비공개(Private). 무단 복제·배포를 금합니다.  
- **팀:** **김원일의 보석함**

문의·기여 절차는 팀 내부 규정에 따릅니다.
