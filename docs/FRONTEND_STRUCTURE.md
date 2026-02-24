# Hot Potato 프론트엔드 폴더·규칙

프론트엔드(React) 코드 구조와 개발 시 지켜야 할 규칙을 정리한 문서입니다.

## 폴더 구조

```
src/
├── pages/                    # 라우트별 페이지 (컨테이너)
├── components/
│   ├── layout/               # 레이아웃 (Sidebar, Header, PageRenderer)
│   ├── features/             # 도메인별 UI (auth, calendar, documents, ...)
│   └── ui/                   # 공통 UI (Button, Card, Modal, ...)
├── hooks/
│   ├── core/                 # 앱 전역 훅 (useAppState)
│   └── features/             # 도메인별 훅 (auth, calendar, admin, ...)
├── stores/                   # Zustand 도메인 스토어 (appDataStore 등)
├── services/                 # 비즈니스 로직·동기화 (dataSyncService)
├── utils/
│   ├── api/                  # API 클라이언트
│   ├── auth/                 # 토큰·인증 (tokenManager)
│   ├── database/             # Papyrus·스프레드시트
│   ├── google/               # Google API (Drive, Sheets 초기화 등)
│   ├── cache/                # 캐시
│   └── helpers/              # 순수 유틸
├── types/                    # 타입 정의
├── config/                   # 환경·API 설정
└── styles/                   # 전역·페이지 스타일
```

## 규칙

### 1. pages/ (페이지 = 컨테이너)

- **역할**: URL/라우트에 대응하는 **컨테이너**만 둡니다.
- **할 일**: 라우트 파라미터 처리, 데이터 페칭/훅 호출, 레이아웃 구성.
- **하지 말 것**: 복잡한 도메인 UI는 `components/features/<domain>/`에 두고, 페이지는 그걸 불러서 배치합니다.
- **예**: `pages/Calendar.tsx`는 캘린더 데이터·컨텍스트를 준비한 뒤 `components/features/calendar/`를 렌더합니다.

### 2. components/features/<domain>/

- **역할**: 해당 도메인의 **재사용 가능한 UI**와 하위 feature 컴포넌트.
- **예**: `auth`, `calendar`, `documents`, `accounting`, `admin`, `templates` 등.
- 페이지는 여기 있는 컴포넌트를 조합해 화면을 만듭니다.

### 3. hooks/core vs hooks/features

- **hooks/core/**: 앱 전역에 쓰는 훅 (예: `useAppState`). 최소한의 전역 상태·알림 등만 두는 것을 권장.
- **hooks/features/<domain>/**: 해당 도메인 전용 상태·로직 (예: `useAuth`, `useAdminPanel`, `useWidgetManagement`).

### 4. stores/ (Zustand 도메인 스토어)

- **역할**: 도메인별 상태를 분리해, 구독 단위를 줄이고 리렌더를 줄이기 위함.
- **예**: `appDataStore` — 공지(announcements), 캘린더 이벤트(calendarEvents) 등.
- **사용**: `useAppState`는 이런 스토어를 조합해 반환하고, 필요한 컴포넌트는 `useAppDataStore(selector)`로 필요한 필드만 구독할 수 있습니다.

### 5. 토큰·인증 (단일 소스)

- **액세스 토큰**: 앱 전역에서 **오직 `utils/auth/tokenManager`**만 사용합니다.
- **읽기**: API·Google 호출 시 항상 `tokenManager.get()` 사용.
- **쓰기**: 로그인 시에만 `tokenManager.save()` 호출.
- **저장소**: `useAuthStore`(Zustand)에는 **user 메타데이터만** 두고, `googleAccessToken`은 저장하지 않거나 사용하지 않습니다. 토큰은 tokenManager만 참조합니다.

### 6. 페이지 로딩 (코드 스플리팅)

- `PageRenderer`에서 페이지 컴포넌트는 `React.lazy(() => import('...'))`로 로드합니다.
- `Suspense`로 감싸고, fallback으로 로딩 UI를 넣습니다.
- 새 페이지 추가 시 해당 경로도 `lazy` + `import()`로 등록합니다.

### 7. 초기 데이터 로딩 (로그인 후)

- **1단계(진입용)**: 스프레드시트 ID + 공지·캘린더만 로드. 완료 시 메인(대시) 렌더링.
- **2단계(백그라운드)**: 문서, 템플릿, 워크플로우, 학생/교직원 등은 백그라운드에서 병렬 로드.
- `DataSyncService.initializeDataPhase1` / `initializeDataPhase2`를 사용하며, Apps Script API는 변경하지 않습니다.

## 참고

- 앱스크립트(Google Apps Script)는 수정하지 않고, 위 규칙은 **React 프론트엔드에만** 적용됩니다.
- 더 자세한 API·타입 설명은 `docs/API_DOCUMENTATION.md`, `docs/PROJECT_DOCUMENTATION.md`를 참고하세요.
