# HP ERP 아키텍처

> 개발 단계: **④ 구조 생성**(Component·Deployment) · **③ 설계**(Sequence·Class) · **⑤ 구현**(State) · **⑥ 테스트**(Communication) · **⑦ 문서화**(Package)
> 기준: `main` 브랜치 코드 (2026-10-27)

설계 결정의 **이유**는 [ADR.md](./ADR.md)에, 데이터 구조는 [DATA_MODEL.md](./DATA_MODEL.md)에 있습니다. 이 문서는 시스템이 **어떻게 생겼고 어떻게 움직이는지**를 다룹니다.

## 1. 시스템 개요

```mermaid
flowchart LR
    U["사용자<br/>브라우저 / Electron"] --> FE["React SPA<br/>Netlify 정적 호스팅"]
    FE -- "action 기반 RPC" --> PX["Netlify Function<br/>proxy.js"]
    PX --> GAS["Google Apps Script 웹앱<br/>doPost"]
    GAS --> WS[("Google Workspace<br/>Sheets · Drive · Docs · Gmail · Groups")]
    FE -- "OAuth 토큰으로 직접 호출<br/>papyrus-db / gapi" --> WS
    FE -- "OAuth 2.0" --> G["Google 로그인"]
```

| 계층 | 기술 | 역할 |
|---|---|---|
| 클라이언트 | React 19, TypeScript, Vite 5, Zustand, Tiptap, Recharts | 화면, 상태, 캐시 |
| 데스크톱 셸 (선택) | Electron 38 | 같은 번들을 데스크톱 앱으로 실행 |
| 프록시 | Netlify Functions | CORS 처리, Apps Script URL 은닉 |
| 백엔드 | Google Apps Script (V8) | 회원·공지·결재·문서 처리, Drive 권한 조작 |
| 저장소 | Google Sheets, Google Drive | 데이터(시트), 파일(Drive) |
| 인증 | Google OAuth 2.0 | 로그인, Sheets·Drive·Calendar 직접 접근 토큰 |

## 2. Component 다이어그램

모듈 경계와 의존 방향입니다. 프론트엔드에서 백엔드로 가는 길은 **apiClient(Apps Script 경유)**와 **papyrusManager(Sheets 직접)** 두 가지입니다.

```mermaid
flowchart TB
    subgraph Client["React SPA"]
        direction TB
        UI["Pages / Feature Components"]
        HK["Hooks<br/>useAppState · useAuth · useLedgerManagement ..."]
        SYNC["DataSyncService<br/>프리페치 · 주기 동기화"]
        CACHE["CacheManager<br/>메모리 LRU + localStorage"]
        API["ApiClient<br/>재시도 · 캐시 · 무효화"]
        DB["Database Managers<br/>papyrusManager · accountingManager · personalConfigManager"]
        TOK["TokenManager"]
        UI --> HK
        HK --> SYNC
        HK --> API
        HK --> DB
        SYNC --> API
        SYNC --> DB
        API --> CACHE
        DB --> TOK
    end

    subgraph Proxy["Netlify"]
        FN["proxy.js"]
    end

    subgraph Backend["Apps Script"]
        MAIN["Main.gs<br/>doPost 라우터"]
        USR["User*<br/>가입 · 승인 · 인증"]
        NOTI["AnnouncementManagement"]
        WF["DocumentWorkflow*<br/>WorkflowTemplateManager"]
        DOC["Document*<br/>StaticTagManager"]
        ACC["AccountingManagement"]
        STU["StudentManagement<br/>StudentEmployment"]
        ENC["Encryption* · Key*"]
        CORE["SpreadsheetCore / Utils<br/>CONFIG"]
        MAIN --> USR & NOTI & WF & DOC & ACC & STU & ENC
        USR & NOTI & WF & DOC & ACC & STU --> CORE
        USR & NOTI --> ENC
    end

    API -->|POST action| FN --> MAIN
    DB -->|Sheets/Drive API| GWS[("Google Sheets / Drive")]
    CORE --> GWS
```

## 3. Deployment 다이어그램

```mermaid
flowchart TB
    subgraph Device["사용자 기기"]
        BR["웹 브라우저"]
        EL["Electron 앱 (선택)<br/>dist/ 번들 로드"]
    end

    subgraph Netlify["Netlify (yuhancse.netlify.app)"]
        CDN["정적 호스팅<br/>dist/ · privacy.html · terms.html"]
        FUNC["Function: proxy<br/>env APP_SCRIPT_URL"]
    end

    subgraph Google["Google Cloud / Workspace"]
        OAUTH["OAuth 2.0<br/>Client ID"]
        GAS["Apps Script 웹앱<br/>배포자 권한 실행"]
        DRIVE[("배포자 Drive<br/>hot_potato_remake/")]
        PDRIVE[("사용자 개인 Drive<br/>user_setting, 개인 문서")]
        GMAIL["Gmail / Groups"]
    end

    BR -- HTTPS --> CDN
    BR -- "HTTPS /.netlify/functions/proxy" --> FUNC
    FUNC -- HTTPS --> GAS
    GAS --> DRIVE
    GAS --> GMAIL
    BR -- "OAuth implicit flow" --> OAUTH
    BR -- "Sheets/Drive API (사용자 토큰)" --> DRIVE
    BR -- "Sheets/Drive API (사용자 토큰)" --> PDRIVE
    EL -.-> FUNC
```

| 노드 | 배포 방식 | 설정 |
|---|---|---|
| Netlify 정적 호스팅 | `main` 푸시 시 Netlify가 `npm run build` 후 `dist/` 게시 | `netlify.toml` |
| Netlify Function | 같은 빌드에 포함 (`netlify/functions/`) | 대시보드 환경변수 `APP_SCRIPT_URL` |
| Apps Script | `clasp push` 후 기존 웹앱 배포의 버전 교체 | `appScript/appsscript.json`, 스크립트 속성 |
| Electron | 로컬에서 `npm run electron:build` | `package.json`의 `build` 항목 |

절차는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

## 4. Sequence 다이어그램

### 4.1 로그인 → 가입 → 승인 → 첫 진입

```mermaid
sequenceDiagram
    actor User as 사용자
    participant FE as React (useAuth)
    participant G as Google OAuth
    participant GAS as Apps Script
    participant S as hp_member.user
    actor Admin as 관리자

    Note over Admin,S: 사전 준비: 관리자가 학번·이름 사전 등록 (addUsersToSpreadsheet)
    User->>FE: Google로 로그인
    FE->>G: 리다이렉트 (response_type=token)
    G-->>FE: access_token (URL hash)
    FE->>G: userinfo 조회
    G-->>FE: email, name
    FE->>GAS: checkApprovalStatus(email)
    GAS->>S: 암호화 이메일로 행 검색
    alt 미등록
        GAS-->>FE: not_registered
        FE-->>User: 가입 폼 (학번·이름·가입유형)
        User->>FE: 제출 (+관리자 키 선택)
        FE->>GAS: registerUser
        GAS->>S: 학번·이름 일치 행에 기록, Approval=X
        GAS-->>FE: 성공
        FE-->>User: 승인 대기 화면
        Admin->>GAS: approveUserWithGroup(studentId, groupRole)
        GAS->>S: Approval=O, approval_date
        GAS->>GAS: Google 그룹 추가 (실패 시 안내 메일)
    else 승인 대기
        GAS-->>FE: pending
        FE-->>User: 승인 대기 화면
    else 승인됨
        GAS-->>FE: approved (+isAdmin, userType)
        FE->>GAS: getSpreadsheetIds
        FE->>FE: initializeDataFull (Phase 1 → Phase 2 프리페치)
        FE-->>User: 대시보드
    end
```

### 4.2 결재 요청과 처리

```mermaid
sequenceDiagram
    actor R as 요청자
    actor A as 검토자/결재자
    participant FE as React
    participant GAS as Apps Script
    participant WS as workflow 시트
    participant D as Drive

    R->>FE: 결재 요청 (문서, 검토선, 결재선)
    FE->>GAS: requestWorkflow
    GAS->>D: (필요 시) 결재 문서 생성, 참여자 열람 권한 부여
    GAS->>WS: workflow_documents 추가 (검토중, review step 1)
    GAS->>WS: workflow_history 추가 (요청)
    GAS-->>FE: workflowId
    A->>FE: 내 결재함에서 승인/반려/보류
    FE->>GAS: approveReview / rejectReview / holdReview
    GAS->>GAS: 현재 단계 담당자 확인, 이전 단계 완료 확인
    GAS->>WS: 상태·단계 갱신, 이력 추가
    GAS-->>FE: 갱신된 결재 정보
    FE->>FE: 캐시 무효화 후 목록 재조회
```

## 5. Class 다이어그램 (프론트엔드 핵심 타입)

```mermaid
classDiagram
    class User {
        +string email
        +string name
        +string studentId
        +boolean isAdmin
        +boolean isApproved
        +string userType
        +string accessToken
    }
    class ApiClient {
        -string baseUrl
        +request(action, data, options) ApiResponse
        +checkApprovalStatus(email)
        +registerUser(data)
        +requestWorkflow(data)
        +approveReview(data)
        +createLedger(data)
        -invalidateAndRefresh(action)
    }
    class ApiResponse {
        +boolean success
        +any data
        +string message
        +string error
    }
    class CacheManager {
        -Map memory
        +get(key)
        +set(key, value, ttl)
        +invalidate(pattern)
        +clear()
    }
    class DataSyncService {
        +initializeDataFull(user, onProgress)
        +startPeriodicSync()
        +invalidateAndRefresh(keys)
    }
    class TokenManager {
        +save(token, expiresIn)
        +get() string
        +isExpired() boolean
    }
    class WorkflowInfo {
        +string workflowId
        +string workflowType
        +string workflowStatus
        +ReviewStep[] reviewLine
        +ReviewStep[] paymentLine
        +int currentReviewStep
        +int currentPaymentStep
    }
    class ReviewStep {
        +int step
        +string email
        +string name
        +string status
        +string opinion
    }
    class LedgerEntry {
        +string entryId
        +string accountId
        +number amount
        +number balanceAfter
        +string transactionType
        +string evidenceFileId
    }
    class BudgetPlan {
        +string budgetId
        +string accountId
        +number totalAmount
        +string status
    }

    ApiClient ..> ApiResponse : returns
    ApiClient --> CacheManager : uses
    DataSyncService --> ApiClient : prefetch
    DataSyncService --> CacheManager : invalidate
    ApiClient ..> WorkflowInfo
    WorkflowInfo "1" *-- "1..*" ReviewStep
    BudgetPlan "1" o-- "0..*" LedgerEntry : 집행
```

## 6. 상태 다이어그램

### 6.1 회원 승인

```mermaid
stateDiagram-v2
    state "사전등록" as PRE
    state "승인대기 (Approval=X)" as PENDING
    state "승인 (Approval=O)" as APPROVED
    state "거부" as REJECTED
    [*] --> PRE : 관리자 addUsersToSpreadsheet
    PRE --> PENDING : 사용자 registerUser
    PENDING --> APPROVED : 관리자 approveUserWithGroup
    PENDING --> REJECTED : 관리자 rejectUser
    APPROVED --> [*]
```

`checkUserStatus`는 사전등록 상태도 `not_registered`로 돌려줍니다. 사용자 입장에서는 "가입 폼이 뜨는 상태"입니다.

### 6.2 결재 (`workflow_documents.workflow_status`)

```mermaid
stateDiagram-v2
    state "검토중" as REVIEW
    state "검토보류" as REVIEW_HOLD
    state "검토반려" as REVIEW_REJECT
    state "결재중" as PAYMENT
    state "결재보류" as PAYMENT_HOLD
    state "결재완료" as DONE
    state "전체반려" as ALL_REJECT
    [*] --> REVIEW : requestWorkflow
    REVIEW --> REVIEW : approveReview (다음 검토자 있음)
    REVIEW --> PAYMENT : approveReview (마지막 검토자)
    REVIEW --> REVIEW_HOLD : holdReview
    REVIEW_HOLD --> REVIEW : 승인으로 재개
    REVIEW --> REVIEW_REJECT : rejectReview
    PAYMENT --> PAYMENT : approvePayment (다음 결재자 있음)
    PAYMENT --> DONE : approvePayment (마지막 결재자)
    PAYMENT --> PAYMENT_HOLD : holdPayment
    PAYMENT_HOLD --> PAYMENT : 승인으로 재개
    PAYMENT --> ALL_REJECT : rejectPayment
    REVIEW_REJECT --> REVIEW : resubmitWorkflow (요청자)
    ALL_REJECT --> REVIEW : resubmitWorkflow (요청자)
    DONE --> [*]
```

- 결재선의 각 단계는 `대기 → 승인 | 반려 | 보류`이며, 보류 단계는 승인(재개)만 할 수 있습니다.
- 검토 단계가 **모두 승인**되어야 결재 단계로 넘어갑니다.
- 모든 전이는 `workflow_history`에 한 줄씩 남습니다.

### 6.3 예산 계획 (`예산계획.status`)

```mermaid
stateDiagram-v2
    [*] --> pending : createBudgetPlan (총액 ≤ 잔액)
    pending --> pending : 부관리인 일부 검토
    pending --> reviewed : 부관리인 전원 검토
    reviewed --> approved : 주관리인 승인
    reviewed --> rejected : 주관리인 반려 (사유)
    approved --> executed : executeBudgetPlan (장부에 지출 자동 기록)
    rejected --> pending : 내용 수정
    approved --> pending : 내용 수정 (검토·승인 초기화)
    executed --> [*]
```

### 6.4 공지 고정 (`notice.fix_notice`)

```mermaid
stateDiagram-v2
    state "일반 ('')" as NORMAL
    state "고정 요청 ('-')" as REQUESTED
    state "고정 (O)" as PINNED
    state "거절 (X)" as DENIED
    [*] --> NORMAL : createAnnouncement
    [*] --> REQUESTED : createAnnouncement (isPinned)
    NORMAL --> REQUESTED : requestPinnedAnnouncement
    REQUESTED --> PINNED : 관리자 승인
    REQUESTED --> DENIED : 관리자 거절
    DENIED --> REQUESTED : 다시 요청
    PINNED --> NORMAL : 고정 해제
```

## 7. Communication 다이어그램 (결재 승인)

테스트 단계에서 객체 사이의 메시지 순서를 점검할 때 쓰는 그림입니다. 번호는 메시지 순서입니다.

```mermaid
flowchart LR
    A(("검토자")) -- "1: 승인 클릭" --> WM["WorkflowManagement"]
    WM -- "2: open(workflow, step)" --> AM["WorkflowActionModal"]
    AM -- "3: approveReview()" --> AC["ApiClient"]
    AC -- "4: POST {action}" --> PX["Netlify proxy"]
    PX -- "5: forward" --> MAIN["Main.gs"]
    MAIN -- "6: initializeWorkflowSheets()" --> WSS["WorkflowSpreadsheet.gs"]
    MAIN -- "7: processReviewAction()" --> WFA["DocumentWorkflowActions.gs"]
    WFA -- "8: 상태 갱신" --> SH[("workflow_documents")]
    WFA -- "9: recordWorkflowHistory()" --> HI[("workflow_history")]
    AC -- "10: invalidateAndRefresh()" --> DS["DataSyncService"]
    AM -- "11: onSuccess()" --> WM
    WM -- "12: 목록 3종 재조회" --> AC
```

## 8. Package 다이어그램

### 8.1 프론트엔드 (`src/`)

```mermaid
flowchart TB
    APP["App.tsx"] --> LAYOUT["components/layout<br/>PageRenderer · Sidebar · Header"]
    LAYOUT --> PAGES["pages"]
    PAGES --> FEAT["components/features"]
    PAGES --> UIC["components/ui"]
    FEAT --> HOOKS["hooks<br/>core · features · data · ui"]
    PAGES --> HOOKS
    HOOKS --> SERVICES["services<br/>dataSyncService"]
    HOOKS --> STORES["stores<br/>zustand"]
    HOOKS --> UTILS["utils<br/>api · database · google · cache · auth"]
    SERVICES --> UTILS
    UTILS --> CONFIG["config<br/>api · environment"]
    UTILS --> TYPES["types"]
    STORES --> TYPES
```

| 폴더 | 책임 |
|---|---|
| `pages/` | 화면 단위 컨테이너, `React.lazy`로 지연 로딩 |
| `components/layout/` | 앱 셸. `PageRenderer`가 `currentPage`에 따라 페이지를 고름 |
| `components/features/<도메인>/` | accounting, admin, auth, calendar, dashboard, documents, staff, students, templates, timetable, workflow |
| `components/ui/` | 공통 UI (ErrorBoundary, OfflineBanner, LoadingProgress, TiptapEditor, VirtualList 등) |
| `hooks/core/` | `useAppState`: 사용자, 현재 페이지, 스프레드시트 ID, 공용 데이터 |
| `hooks/features/` | 도메인 로직 (`useAuth`, `useLedgerManagement`, `useWidgetManagement` …) |
| `services/` | `dataSyncService`: 로그인 후 프리페치, 주기 동기화, 쓰기 후 무효화 |
| `utils/api/` | `apiClient`: Apps Script 호출 |
| `utils/database/` | Sheets 직접 접근 (`papyrusManager`, `accountingManager`, `personal*Manager`) |
| `utils/cache/` | 2단계 캐시 |
| `config/` | API 설정, 환경변수(`ENV_CONFIG`) 파싱 |

정리할 의존성: `dataSyncService ↔ papyrusManager` 순환 참조, `utils → components/hooks` 역방향 참조 몇 건이 있습니다 ([STATUS.md](./STATUS.md#4-기술-백로그)).

### 8.2 Apps Script (`appScript/`)

Apps Script는 모든 파일이 **전역 스코프 하나**를 공유합니다. 아래 화살표는 "다른 파일에 정의된 전역 함수를 호출한다"는 뜻입니다.

```mermaid
flowchart TB
    MAIN["Main.gs (doPost)"] --> USER["UserAuth · UserRegistration<br/>UserApproval · GroupManagement"]
    MAIN --> NOTICE["AnnouncementManagement"]
    MAIN --> WORK["DocumentWorkflow · DocumentWorkflowActions<br/>WorkflowTemplateManager"]
    MAIN --> DOCS["DocumentCreation · DocumentTemplates<br/>DocumentSpreadsheet · StaticTagManager"]
    MAIN --> ACCT["AccountingManagement"]
    MAIN --> STUD["StudentManagement · StudentEmployment"]
    WORK --> WSHEET["WorkflowSpreadsheet"]
    WORK --> PERM["DocumentPermissions"]
    DOCS --> FOLDER["DocumentFolder"]
    USER & NOTICE & STUD --> EMAIL["EncryptionEmail"]
    EMAIL --> ECORE["EncryptionCore → EncryptionAlgorithms"]
    USER --> KEY["KeyGeneration · KeyVerification"]
    KEY --> ECORE
    USER & NOTICE & DOCS & STUD & WSHEET --> SCORE["SpreadsheetCore · SpreadsheetUtils"]
    SCORE --> CONFIG["CONFIG (PropertiesService)"]
    INIT["InitialSetup<br/>(독립 실행)"]
```

## 9. 프론트엔드 동작 방식

### 9.1 화면 전환

- 라우터 라이브러리 없이 `currentPage` 상태와 `?page=` 쿼리로 화면을 바꿉니다 (`useAppState.ts`, `App.tsx`).
- 진입 순서: 인증 확인 → 미로그인이면 `Login` → 미승인이면 `PendingApproval` → 앱 셸(`Sidebar` + `PageRenderer`).
- 메뉴 노출은 역할에 따라 달라집니다. 회계는 `std_council`·`professor`·`supp`, 관리자 메뉴는 `is_admin`, 학년 관리는 `supp`만 봅니다.

### 9.2 데이터 로딩과 캐시

Apps Script는 응답이 느리고 호출 할당량이 있어서, **호출 수를 줄이는 것**을 프론트엔드 설계의 기준으로 삼았습니다.

| 단계 | 내용 | 위치 |
|---|---|---|
| 1. 스프레드시트 ID 해석 | 이름 목록을 한 번에 보내 ID를 받음 | `papyrusManager.initializeSpreadsheetIds` |
| 2. Phase 1 프리페치 | 공지, 캘린더, 템플릿, 태그, 결재 템플릿, 장부 목록을 **동시 8개씩** 가져옴 | `dataSyncService.initializeDataFull` |
| 3. Phase 2 프리페치 | 문서, 학생, 교직원, 내 결재, (관리자) 사용자 목록을 화면을 막지 않고 가져옴 | 같은 파일 |
| 4. 화면 표시 | 각 화면이 같은 API를 다시 부르면 **캐시 적중** | `apiClient`, `cacheManager` |
| 5. 주기 동기화 | 카테고리별 간격으로 캐시만 갱신, 탭이 비활성이면 멈춤 | `dataSyncService` |
| 6. 쓰기 후 | 관련 캐시 키 무효화 후 재조회 (800ms 디바운스) | `apiClient.invalidateAndRefresh` |

| 데이터 | 캐시 TTL | 주기 동기화 |
|---|---|---|
| 결재 | 3분 | 5분 |
| 회계 | 5분 | 10분 |
| 공지·문서 | 10분 | 15분 |
| 캘린더 | 15분 | 15분 |
| 사용자·템플릿·학생 | 30분 | 30분 |
| 스프레드시트 ID·장부 목록 | 45분 | 60분 |

- 캐시 저장소: 메모리 `Map`(LRU 100개) + `localStorage`(`cache_*`, 항목 100KB 미만, 전체 5MB)
- 429(호출 초과) 응답이 오면 해당 카테고리 동기화를 30~120분 쉽니다.
- 오프라인이면 `OfflineBanner`를 띄우고, TTL 안의 캐시로 일부 화면을 보여 줍니다.
