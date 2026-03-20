# ENV_CONFIG → ENV_CONFIG_V2 전환 가이드

> 전체 문서 목차: [docs/README.md](./README.md)

env(ver.2).txt 기준의 `environmentV2.ts`에 있는 **ENV_CONFIG_V2**를 **ENV_CONFIG**로 쓰려 할 때, 무엇이 바뀌고 어떻게 수정하면 되는지 정리한 문서입니다.

---

## 1. 무엇이 바뀌는지 (차이 요약)

### 1.1 환경 변수 소스 형식

| 구분 | 현재 (.env + environment.ts) | 전환 후 (env(ver.2).txt + environmentV2.ts) |
|------|------------------------------|---------------------------------------------|
| 형식 | 키 하나당 변수 하나 (플랫) | **JSON 4개**로 묶음 |
| 변수 예 | `VITE_ANNOUNCEMENT_SPREADSHEET_NAME=notice` | `VITE_SPREADSHEET_NAME={"NOTICE":"notice", ...}` |
| 읽기 | `getEnvVar('VITE_...')` | `getEnvJson('VITE_FOLER_NAME', DEFAULT)` 등 |

즉, **.env 플랫 키 여러 개** → **env(ver.2).txt의 JSON 4개**(`VITE_FOLER_NAME`, `VITE_SPREADSHEET_NAME`, `VITE_SHEET_NAME`, `VITE_GROUP_EMAIL`)로 바뀝니다.

### 1.2 키 이름 매핑 (ENV_CONFIG vs ENV_CONFIG_V2)

아래는 **현재 코드가 쓰는 ENV_CONFIG 키**와 **ENV_CONFIG_V2에 있는 키**의 대응입니다.  
전환 시 “기존 키 이름을 유지할지”, “V2 키 이름으로 통일할지”에 따라 수정 범위가 달라집니다.

| 현재 ENV_CONFIG 키 | ENV_CONFIG_V2 키 | 비고 |
|--------------------|------------------|------|
| `ANNOUNCEMENT_SPREADSHEET_NAME` | `NOTICE_SPREADSHEET_NAME` | 이름만 다름 |
| `CALENDAR_ADPROFESSOR_SPREADSHEET_NAME` | `CALENDAR_ADJ_PROFESSOR_SPREADSHEET_NAME` | ADJUNCT 표기 |
| `CALENDAR_SUPP_SPREADSHEET_NAME` | `CALENDAR_ASSISTANT_SPREADSHEET_NAME` | supp → assistant |
| `ANNOUNCEMENT_SHEET_NAME` | `DEFAULT_SHEET_NAME` | 공지 시트 = 기본 시트 |
| `CALENDAR_SHEET_NAME` | `DEFAULT_SHEET_NAME` | 동일 |
| `DOCUMENT_TEMPLATE_SHEET_NAME` | **(V2에 없음)** | 워크플로/설정 시트로 분리됨, 호환용 추가 필요 |
| `STUDENT_SHEET_NAME` | `INFO_SHEET_NAME` | 학생 정보 시트 |
| `STUDENT_ISSUE_SHEET_NAME` | `ISSUE_SHEET_NAME` | 동일 개념 |
| `STAFF_INFO_SHEET_NAME` | `INFO_SHEET_NAME` | 직원 정보 시트(이름만 다름) |
| `STAFF_COMMITTEE_SHEET_NAME` | `COMMITTEE_SHEET_NAME` | 동일 개념 |
| `DASHBOARD_SHEET_NAME` | `CONFIG_DASHBOARD_SHEET_NAME` | 대시보드 설정 시트 |
| `MENU_SHEET_NAME` | **(V2에 없음)** | 호환용으로 빈 문자열 등 처리 필요 |
| `DOCUMENT_FOLDER_NAME` | **(V2에 없음)** | 공유/개인 문서 폴더만 있음 → 공유 문서 등 하나로 매핑 필요 |
| `TEMPLATE_FOLDER_NAME` | `SHARED_TEMPLATE_FOLDER_NAME` 또는 `PERSONAL_TEMPLATE_FOLDER_NAME` | V2는 둘로 분리 |
| `ACCOUNTING_FOLDER_NAME` | `ACCOUNT_FOLDER_NAME` | 이름만 다름 |
| `EVIDENCE_FOLDER_NAME` | `PROOF_FOLDER_NAME` | 증빙 폴더 |
| `PERSONAL_CONFIG_FILE_NAME` | `PERSONAL_CONFIG_FILE_NAME` (SPREADSHEET.CONFIG) | V2는 `user_config` 등 |
| `HOT_POTATO_DB_SPREADSHEET_NAME` | **(V2에 없음)** | CONFIG 스프레드시트와 동일하게 둘지 결정 필요 |
| `PAPYRUS_DB_URL` / `PAPYRUS_DB_API_KEY` | **(env(ver.2).txt에 없음)** | .env에 그대로 두거나 V2에 옵션으로 추가 |
| `BOARD_SHEET_NAME` | **(현재 environment.ts에도 없음)** | V2에서는 `DEFAULT_SHEET_NAME` 등으로 통일 가능 |

정리하면:

- **키 이름이 바뀌는 것**: 공지→NOTICE, ADPROFESSOR→ADJ_PROFESSOR, SUPP→ASSISTANT, 시트/폴더 이름들 일부.
- **V2에 없는 것**: `DOCUMENT_TEMPLATE_SHEET_NAME`, `MENU_SHEET_NAME`, `DOCUMENT_FOLDER_NAME`, `HOT_POTATO_DB_SPREADSHEET_NAME`, Papyrus DB, `BOARD_SHEET_NAME` 등 → **호환 레이어**에서 매핑하거나 env(ver.2)에 필드를 추가해야 함.

---

## 2. 어떻게 할지 (두 가지 방법)

### 방법 A: environment.ts를 V2 기반으로 바꾸고, **기존 키 이름 유지** (추천)

- **environment.ts** 내용을 **env(ver.2).txt + environmentV2.ts 로직**으로 바꾼 뒤,  
  **export 하는 객체 이름만 `ENV_CONFIG`로 유지**하고,  
  **기존 코드가 쓰는 모든 키**를 그대로 노출합니다.
- 구현 방식:
  - `environmentV2.ts`의 파싱 로직(`getEnvJson`, `FOLER`, `SPREADSHEET`, `SHEET`, `GROUP_EMAIL`)을 그대로 쓰거나 `environment.ts`로 옮기고,
  - `ENV_CONFIG`에 **기존 키 이름**으로 매핑해서 넣습니다.  
    예: `ANNOUNCEMENT_SPREADSHEET_NAME: SPREADSHEET.NOTICE`, `DASHBOARD_SHEET_NAME: SHEET.CONFIG_DASHBOARD`, `EVIDENCE_FOLDER_NAME: FOLER.ACCOUNT_PROOF` 등.
  - V2에 없는 키(`DOCUMENT_TEMPLATE_SHEET_NAME`, `MENU_SHEET_NAME`, `DOCUMENT_FOLDER_NAME`, `HOT_POTATO_DB_SPREADSHEET_NAME`, `PAPYRUS_DB_*`, `BOARD_SHEET_NAME`)는
    - env(ver.2).txt에 필드를 추가하거나,
    - 기본값/다른 JSON 필드에서 파생해 채웁니다.
- **다른 파일 수정**: **거의 없음**. import는 그대로 `from './config/environment'`, `ENV_CONFIG.xxx` 그대로 사용.
- **검증**: `validateEnvironmentVariables()`를 V2 필수 항목 검증(`validateEnvironmentVariablesV2`)과 동일한 조건으로 동작하도록 바꿉니다.

### 방법 B: ENV_CONFIG_V2를 그대로 ENV_CONFIG로 노출하고, **코드 전부를 V2 키 이름으로 수정**

- **environment.ts**에서는 `ENV_CONFIG_V2`를 re-export 하거나, `environment.ts`를 없애고 `environmentV2.ts`에서 `ENV_CONFIG`로 export 합니다.
- **모든 사용처**에서:
  - `ANNOUNCEMENT_*` → `NOTICE_*`
  - `CALENDAR_ADPROFESSOR_*` → `CALENDAR_ADJ_PROFESSOR_*`
  - `CALENDAR_SUPP_*` → `CALENDAR_ASSISTANT_*`
  - `DASHBOARD_SHEET_NAME` → `CONFIG_DASHBOARD_SHEET_NAME`
  - `DOCUMENT_FOLDER_NAME` → `SHARED_DOCUMENT_FOLDER_NAME`(또는 용도에 맞는 쪽) 등  
  **키 이름을 ENV_CONFIG_V2에 맞게** 바꿉니다.
- **수정 파일 수**: 많음 (아래 “ENV_CONFIG를 쓰는 파일 목록” 전부).
- V2에 없는 키(Papyrus, BOARD_SHEET_NAME, DOCUMENT_TEMPLATE 등)는 **environmentV2.ts 쪽에 필드 추가**하거나, 해당 기능에서만 예외 처리해야 합니다.

---

## 3. ENV_CONFIG를 쓰는 파일 목록 (전환 시 수정 대상)

방법 A를 쓰면 대부분 **config 쪽만** 손대고, 방법 B를 쓰면 아래 **모든 파일**에서 키 이름을 V2에 맞게 바꿔야 합니다.

| 파일 | 사용 키 (요약) |
|------|----------------|
| `src/App.tsx` | `GOOGLE_CLIENT_ID` |
| `src/config/api.ts` | `APP_SCRIPT_URL`, `GOOGLE_CLIENT_ID` |
| `src/main.tsx` | (validateEnvironmentVariables만 사용) |
| `src/utils/google/googleApiInitializer.ts` | `GOOGLE_CLIENT_ID` |
| `src/utils/google/googleSheetUtils.ts` | `GOOGLE_CLIENT_ID`, `ROOT_FOLDER_NAME`, `DOCUMENT_FOLDER_NAME`, `PERSONAL_DOCUMENT_FOLDER_NAME` |
| `src/utils/google/documentUploader.ts` | (environment import만) |
| `src/utils/google/accountingFolderManager.ts` | `EVIDENCE_FOLDER_NAME` |
| `src/utils/database/papyrusManager.ts` | `ANNOUNCEMENT_SPREADSHEET_NAME`, `CALENDAR_*_SPREADSHEET_NAME`, `STUDENT/STAFF_*`, `DOCUMENT_TEMPLATE_SHEET_NAME`, `CALENDAR_SHEET_NAME`, `STUDENT_SHEET_NAME`, `STUDENT_ISSUE_SHEET_NAME`, `STAFF_*_SHEET_NAME` |
| `src/utils/database/accountingManager.ts` | `EVIDENCE_FOLDER_NAME` |
| `src/utils/database/personalConfigManager.ts` | `ROOT_FOLDER_NAME`, `PERSONAL_CONFIG_FILE_NAME`, `DOCUMENT_FOLDER_NAME`, `PERSONAL_TEMPLATE_FOLDER_NAME`, `DASHBOARD_SHEET_NAME` |
| `src/hooks/core/useAppState.ts` | `DASHBOARD_SHEET_NAME`, `ANNOUNCEMENT_SHEET_NAME`, `CALENDAR_SHEET_NAME`, `PAPYRUS_DB_API_KEY` |
| `src/hooks/features/dashboard/useWidgetManagement.ts` | `DASHBOARD_SHEET_NAME`, `PAPYRUS_DB_API_KEY` |
| `src/hooks/features/admin/useAdminPanel.ts` | `ANNOUNCEMENT_SPREADSHEET_NAME` |
| `src/hooks/features/templates/useTemplateUI.ts` | `GROUP_EMAILS` |
| `src/hooks/features/templates/usePersonalTemplates.ts` | `ROOT_FOLDER_NAME`, `DOCUMENT_FOLDER_NAME`, `PERSONAL_TEMPLATE_FOLDER_NAME` |
| `src/pages/DocumentManagement.tsx` | `GROUP_EMAILS` |
| `src/pages/NewDocument.tsx` | `GROUP_EMAILS`, `ROOT_FOLDER_NAME`, `DOCUMENT_FOLDER_NAME`, `PERSONAL_TEMPLATE_FOLDER_NAME` |
| `src/pages/Board/Board.tsx` | `BOARD_SHEET_NAME` |
| `src/pages/Announcements/AnnouncementView.tsx` | `ANNOUNCEMENT_SPREADSHEET_NAME` |
| `src/components/features/accounting/CreateAccountModal.tsx` | `GROUP_EMAILS` |
| `src/components/features/accounting/CreateLedgerModal.tsx` | (environment import) |
| `src/components/ui/StudentDetailModal.tsx` | (environment import) |
| `src/utils/helpers/loadDocumentsFromDrive.ts` | `ROOT_FOLDER_NAME`, `DOCUMENT_FOLDER_NAME`, `PERSONAL_DOCUMENT_FOLDER_NAME` |
| `src/config/__mocks__/environment.ts` | (테스트용 ENV_CONFIG 모킹) |

- **방법 A**: 위 파일들은 **키 이름 변경 없이** 그대로 두고, `environment.ts`만 V2 소스 + 호환 키로 채우면 됨.  
- **방법 B**: 위 파일들에서 `ENV_CONFIG.기존키` → `ENV_CONFIG.V2키` 로 모두 변경해야 함.

---

## 4. env(ver.2).txt 보정 사항

- `VITE_FOLER_NAME` 안에 `ACCOUNT` 다음에 **쉼표**가 빠져 있음:  
  `"ACCOUNT":"account"` 뒤에 `,` 추가 필요 (JSON 문법 오류 방지).
- Papyrus DB, 게시판 시트 이름 등을 쓰려면:
  - **env(ver.2).txt**에 JSON 필드 추가하거나,
  - 코드에서만 기본값/기존 .env 값을 읽도록 할지 정해야 함.

---

## 5. 권장 순서 (방법 A 기준)

1. **env(ver.2).txt** JSON 문법 수정 (쉼표 등).
2. **environmentV2.ts**에 호환용 키 추가 (필요 시):  
   `ANNOUNCEMENT_SPREADSHEET_NAME`, `DASHBOARD_SHEET_NAME`, `DOCUMENT_FOLDER_NAME`, `EVIDENCE_FOLDER_NAME`, `DOCUMENT_TEMPLATE_SHEET_NAME`, `MENU_SHEET_NAME`, `BOARD_SHEET_NAME`, `HOT_POTATO_DB_SPREADSHEET_NAME`, Papyrus 등 — 기존 ENV_CONFIG 키 이름으로 매핑.
3. **environment.ts**를 V2 기반으로 교체:  
   - env(ver.2).txt 형식(`getEnvJson`)으로 읽고,  
   - 위에서 만든 “기존 키 이름 호환 객체”를 `ENV_CONFIG`로 export.
4. **validateEnvironmentVariables**를 V2 필수 항목 검증과 동일하게 수정.
5. **main.tsx**는 그대로 `validateEnvironmentVariables()` 호출.
6. 나머지 소스는 **import와 ENV_CONFIG.xxx 호출 그대로** 두고, 테스트/실행으로 검증.

이렇게 하면 **다른 코드의 환경 변수 사용처는 거의 수정하지 않고**, ENV_CONFIG만 env(ver.2).txt 기준의 ENV_CONFIG_V2 내용으로 바꿀 수 있습니다.
