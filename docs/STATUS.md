# HP ERP 구현 상태

> 개발 단계: **⑤ 구현 / ⑦ 수정 및 문서화** · 산출물: 구현 현황, 기술 백로그
> **구현 상태는 이 문서에서만 관리합니다.** 다른 문서에는 상태를 적지 않고 여기로 링크합니다.

## 1. 기준 시점

| 항목 | 값 |
|---|---|
| 기준일 | 2026-10-27 |
| 커밋 | `main` @ `6ad8486` (netlify 빌드 수정) |
| 운영 주소 | https://yuhancse.netlify.app |
| 마지막 검증 | [TEST_PLAN.md §4](./TEST_PLAN.md#4-자동-검사-결과-2026-10-27-main--6ad8486). 브랜치 `feature/drive-file-scope` 화면 검증은 [TEST_PLAN.md §9](./TEST_PLAN.md#9-drivefile-전환-화면-검증-2026-10-30-featuredrive-file-scope) |
| 진행 중 브랜치 | `feature/loading-performance` (미병합). 로딩 병목·API 재시도 정리. 검증 결과는 [TEST_PLAN.md §8](./TEST_PLAN.md#8-로딩-성능-개선-검증-2026-10-29-featureloading-performance) |
| 진행 중 브랜치 | `feature/drive-file-scope` (기능 브랜치에 반영, develop 병합 전). `feature/loading-performance`를 포함합니다. OAuth 범위를 `drive.file`로 줄이고 공유 파일 접근을 Apps Script로 옮겼습니다. 내용은 §3 표 마지막 행 |

## 2. 기능별 상태

✅ 동작 · ⚠️ 동작하지만 알려진 결함 있음 · ⏳ 미구현

| 영역 | 기능 | 상태 | 비고 |
|---|---|---|---|
| 인증 | Google 로그인, 최근 계정 로그인 | ✅ | 세션 최대 약 1시간 |
| 인증 | 가입 신청, 사전 등록, 승인 | ✅ | 승인 후 재로그인 필요 (BUG-08) |
| 인증 | 가입 거부 | ⚠️ | BUG-02 |
| 인증 | 관리자 키 갱신·발송 | ✅ | 트리거 수동 등록 필요 |
| 인증 | 로그인 화면 서비스 설명, 소개·개인정보처리방침·이용약관 링크 | ✅ | 기능 브랜치에 반영, develop 병합 전 |
| 대시보드 | 위젯 추가·삭제·정렬, 개인 드라이브 저장 | ✅ | |
| 공지 | 목록·상세·작성·수정·삭제, 공개 범위, 첨부·이미지 | ✅ | |
| 공지 | 고정 요청·승인 | ✅ | |
| 문서 | 공유·개인 문서 목록, 업로드 | ✅ | |
| 문서 | 양식으로 생성 (나만 보기 / 권한 부여) | ⚠️ | 권한 부여 경로는 태그 메타데이터를 저장하지 않음. develop에서는 공유 문서 생성이 Apps Script 오류(`Blob is not defined`)로 실패하고, 옛 문서 목록 시트가 없으면 공유 문서 삭제도 실패함. 둘 다 기능 브랜치에 반영, develop 병합 전 |
| 문서 | 공유 양식·공용 태그·개인 태그·즐겨찾기 | ✅ | |
| 결재 | 요청 3유형, 검토·결재 승인, 보류·재개 | ✅ | |
| 결재 | 검토 단계 반려 | ⚠️ | BUG-01 |
| 결재 | 결재 단계 반려, 재상신, 이력, 결재선 템플릿 | ✅ | |
| 회계 | 장부 생성, 입출금, 증빙, 잔액 계산 | ✅ | |
| 회계 | 카테고리 | ⚠️ | BUG-07 |
| 회계 | 예산 계획 검토·승인·집행 | ⚠️ | BUG-04. 부관리인이 없는 통장은 검토 단계로 못 넘어감 |
| 회계 | 장부 내보내기 | ✅ | 브랜치 `feature/drive-file-scope`에서 양식 미리보기를 Apps Script로 옮김 ([TEST_PLAN.md §9](./TEST_PLAN.md#9-drivefile-전환-화면-검증-2026-10-30-featuredrive-file-scope)) |
| 일정 | 역할별 캘린더 통합, 일정 CRUD, 반복 일정, 학사 일정 | ⚠️ | BUG-03 (집행부·겸임교원 캘린더). 수정은 기능 브랜치에 반영, develop 병합 전 |
| 일정 | 개인 시간표 | ✅ | |
| 학생 | 목록·상세·추가·수정, 학생회 | ✅ | |
| 학생 | 학년 갱신·유급·진학 (조교) | ✅ | 되돌리기 없음 |
| 학생 | 비로그인 취업 정보 입력, 직종 분야 | ✅ | |
| 교직원 | 교직원·위원회 관리 | ⚠️ | develop에서는 교직원 목록 조회(`fetchStaff`)가 학생 시트를 읽음. 수정은 기능 브랜치에 반영, develop 병합 전 |
| 공통 | 오프라인 배너, 오류 경계, 캐시·프리페치 | ⚠️ | BUG-13 (결재·문서관리 화면에서 페이지 기반 자동 갱신 안 됨). 첫 로딩 지연과 BUG-06은 `feature/loading-performance`에서 수정 (미병합) |
| 공통 | 개인정보처리방침·이용약관 페이지 | ✅ | |
| 공통 | 만들기·수정·삭제 후 즉시 갱신, 서버 대기 중 표시, 공통 확인 모달 | ✅ | 기능 브랜치에 반영, develop 병합 전. BUG-13 포함 ([TEST_PLAN.md §9](./TEST_PLAN.md#9-drivefile-전환-화면-검증-2026-10-30-featuredrive-file-scope)) |
| 배포 | 웹 (Netlify) | ⚠️ | JSON 환경변수 4개가 `{`만 저장되어 있어 코드 기본값으로 동작 중 (2026-10-29 확인, §4 백로그) |
| 배포 | 데스크톱 (Electron) | ⚠️ | 패키징 앱의 로그인·API 경로 미검증 |
| 미사용 | 채팅(`Chat.tsx`), 회의록(`proceedings`) | ⏳ | 메뉴에 연결 안 됨 |

결함 상세는 [TEST_PLAN.md §6](./TEST_PLAN.md#6-결함-리포트-테스트코드-점검으로-발견)에 있습니다.

## 3. 프로젝트 이력

```mermaid
timeline
    title Hot Potato → HP ERP
    section 원본 (hot_potato, 6명)
        2025-07 : 저장소 생성 : 캘린더 · 문서관리 · 공지 · 대시보드 위젯
        2025-08 : 문서 템플릿
        2025-09 : 학생 관리 · 관리자 화면 : 디자인 시스템 · Electron
        2025-10 : Apps Script 코드 저장소 관리 : 교직원 관리 · 캐시
        2025-11 : 결재 · 회계 · 시간표 : Netlify 배포 · 인사 로딩 최적화
    section 리메이크 (hot_potato_remake)
        2025-11 : 리메이크 저장소 생성
        2026-02 : React 보안 업데이트 : CI 정리 : 환경변수 V2 전환
        2026-03 : 이메일 암호화 보완 : 취업·학년 관리 : 관리자 키 인증 수정 : 초기 세팅 자동화 : 개인정보처리방침·약관
        2026-10 : Netlify 프록시 ESM 전환 : 문서 재정리 : 로딩 병목·API 재시도 정리 (브랜치 feature/loading-performance, 미병합) : drive.file 전환 (브랜치 feature/drive-file-scope, 미병합)
```

| 구분 | 기간 | 커밋 | 참여 |
|---|---|---|---|
| 원본 `semicolon213/hot_potato` | 2025-07-08 ~ 2025-12-01 | 666 | 6명 |
| 리메이크 `semicolon213/hot_potato_remake` | 2025-11-26 ~ 진행 중 | 35 (2026-10-22 기준) | 4명 |

리메이크에서 바뀐 것:

| 변경 | 내용 |
|---|---|
| 환경변수 V2 | 폴더·시트 이름을 JSON 환경변수 4개로 통합. Apps Script는 스크립트 속성으로 이전 ([ADR-006](./ADR.md#adr-006-폴더시트-이름을-json-환경변수로-관리한다)) |
| 루트 폴더 기준 탐색 | 스프레드시트를 드라이브 전체가 아니라 루트 폴더 아래에서만 찾도록 변경. 환경변수 값 우선 |
| 초기 세팅 자동화 | `initializeSystem()` 한 번으로 폴더·시트·스크립트 속성 생성 |
| 학적 기능 추가 | 학년 갱신, 유급, 진학, 비로그인 취업 정보 입력 |
| 관리자 가입 검증 | 관리자 가입 요청을 서버에서도 확인하도록 보강 |
| 프록시 개선 | ESM 전환, 서버 전용 `APP_SCRIPT_URL`, 비JSON 응답 처리, 405·400 응답 |
| 법적 고지 | 개인정보처리방침, 이용약관 페이지 |
| CI | GitHub Actions 삭제, Netlify 빌드로 대체 ([ADR-012](./ADR.md#adr-012-ci를-걷어내고-netlify-빌드를-배포-게이트로-쓴다)) |
| drive.file 전환 (브랜치 `feature/drive-file-scope`, develop 병합 전) | OAuth 범위를 `drive.file`, `spreadsheets`, `calendar.events`, `calendar.readonly`, `profile`, `email`로 축소하고 `gmail.compose`, `documents` 제거 ([OAUTH_PUBLISHING.md](./OAUTH_PUBLISHING.md)). 배포자 소유 공유 파일을 다루는 일(공지 첨부·본문 이미지, 회계 증빙 업로드, 장부 목록, 공유 양식으로 나만 보기 문서 만들기, 장부 내보내기)을 Apps Script 경유로 전환. 개인 데이터는 내 드라이브 `hot_potato_personal/`로 분리. `papyrus-db`를 자체 모듈 `sheetsClient.ts`로 교체. 루트 폴더를 `hp_member` 부모 폴더로 감지. `initializeSystem`이 역할 폴더를 그룹스에 공유. 그룹 이메일 기본값을 `student_hp`, `std_council_hp`, `professor_hp`, `adj_professor_hp`, `assistant_hp`(@googlegroups.com)로 정리. 장부 목록을 접근 대상에게만 표시. 캘린더 역할 키 통일(BUG-03). 공지 등록·결재 상태 변경·학년 갱신에 `LockService` 적용. Drive 권한 호출을 v3 형식으로 정리. 로그 수준 정리 |
| 로딩 성능 (브랜치 `feature/loading-performance`, 미병합) | 스프레드시트 ID를 Drive 검색 1회 + 서버 캐시 6시간으로 조회 ([ADR-013](./ADR.md#adr-013-스프레드시트-id를-drive-검색-1회와-서버-캐시로-찾는다)). `apiClient` 재시도 재설계(시도마다 타임아웃 30초, 최대 2회 재시도, 쓰기 요청 재시도 안 함). 프록시 상류 타임아웃 약 9초 → 504. 프론트 그룹 이메일 기본값 수정(이 값은 `feature/drive-file-scope`에서 다시 고침). 측정 결과는 [TEST_PLAN.md §8](./TEST_PLAN.md#8-로딩-성능-개선-검증-2026-10-29-featureloading-performance) |

## 4. 기술 백로그

우선순위: **P1** 다음 배포 전 · **P2** 이번 학기 · **P3** 여유 있을 때

| 우선순위 | 항목 | 관련 |
|---|---|---|
| P1 | Netlify의 JSON 환경변수 4개(`VITE_FOLER_NAME`, `VITE_SPREADSHEET_NAME`, `VITE_SHEET_NAME`, `VITE_GROUP_EMAIL`)를 한 줄 JSON으로 고치거나 삭제. 지금은 값이 `{`뿐이라 파싱이 조용히 실패하고 코드 기본값이 쓰임 | [DEPLOYMENT.md §4](./DEPLOYMENT.md#4-netlify) |
| P1 | Netlify에 `APP_SCRIPT_URL`이 있는지 확인. 브랜치의 프록시는 `VITE_APP_SCRIPT_URL`을 대신 읽지 않음 | [RUNBOOK.md RB-01](./RUNBOOK.md#rb-01-모든-기능에서-데이터가-안-불러와짐) |
| P1 | `feature/loading-performance` 병합과 재배포: Apps Script 운영 배포(@34, 고정 버전)를 새 버전으로 편집 → 편집기에서 `clearSpreadsheetIdCache()` 1회 실행 → 프론트 병합(Netlify 자동 배포). 매니페스트의 AdminDirectory 고급 서비스 때문에 재승인이 필요할 수 있음 | [DEPLOYMENT.md §7](./DEPLOYMENT.md#7-변경-배포) |
| P1 | `feature/drive-file-scope` 병합과 재배포: Apps Script 새 버전 배포 → 편집기에서 아무 함수나 실행해 추가 범위(`script.external_request`, "외부 서비스에 연결") 승인 → 기존 설치는 `applyRoleFolderSharing`, `applyLedgerSharing`을 1회 실행 → 프론트 병합. 범위가 바뀌므로 사용자는 다시 동의함 | [DEPLOYMENT.md §7](./DEPLOYMENT.md#7-변경-배포) |
| P1 | 서버 측 인가 강화 (비공개 보안 과제) | [SECURITY.md §5](./SECURITY.md#5-개선-계획) |
| P1 | 검토 반려 오류 수정 | BUG-01 |
| P1 | 가입 거부를 현재 시트 구조로 수정 | BUG-02 |
| P1 | 예산계획 열 순서 통일 + 기존 장부 마이그레이션 | BUG-04 |
| P2 | 캘린더 역할 키 통일. **해결(브랜치 `feature/drive-file-scope`, 미병합)** | BUG-03 |
| P2 | 결재 상태 타입을 서버 값과 일치 | BUG-05 |
| P2 | `apiClient` 재시도: 시도마다 새 타임아웃, 쓰기 요청은 재시도 안 함. **해결(브랜치 `feature/loading-performance`, 미병합)** | BUG-06 |
| P2 | 카테고리 조회 시트 수정 | BUG-07 |
| P2 | 페이지 단위 권한 검사 | [ADR-010](./ADR.md#adr-010-라우터-없이-상태-기반으로-화면을-전환한다) |
| P2 | 로그아웃 시 캐시·사용자 데이터 삭제. 브랜치에서 `clearAllUserData`가 API 캐시도 비우도록 보강했지만, `handleLogout`이 이 함수를 아직 호출하지 않음 | [ADR-005](./ADR.md#adr-005-클라이언트-캐시와-2단계-프리페치) |
| P2 | 백그라운드 갱신 페이지 키를 실제 페이지 이름과 일치 | BUG-13 |
| P2 | `type-check` 스크립트 수정, 테스트 스위트 복구, CI 재도입 | [TEST_PLAN.md §7](./TEST_PLAN.md#7-회귀-테스트-자동화-계획) |
| P2 | 승인 대기 화면 자동 재확인 | BUG-08 |
| P2 | `initializeSystem` 실패 집계 | BUG-09 |
| P3 | Authorization Code + PKCE 로그인으로 전환 (세션 유지) | [SECURITY.md §5](./SECURITY.md#5-개선-계획) |
| P3 | Apps Script 응답 형식 `{success, data, message}` 통일, 중복 분기·중복 전역 함수 제거 | [API_SPEC.md §3](./API_SPEC.md#3-정리가-필요한-부분) |
| P3 | 백엔드에 없는 프론트 액션 상수 정리 | [API_SPEC.md §3](./API_SPEC.md#3-정리가-필요한-부분) |
| P3 | `dataSyncService ↔ papyrusManager` 순환 참조 제거 (브랜치에서 `papyrusManager`는 내부적으로 `sheetsClient`를 씀) | [ARCHITECTURE.md §8.1](./ARCHITECTURE.md#81-프론트엔드-src) |
| P3 | 레거시 문서 시트(`학생_문서관리` 등) 참조 제거 | [DATA_MODEL.md §6](./DATA_MODEL.md#6-알려진-불일치-정리-대상) |
| P3 | Apps Script 동시 쓰기에 `LockService` 적용. 공지 등록·결재 상태 변경·학년 갱신은 브랜치 `feature/drive-file-scope`에서 적용(미병합). 나머지 쓰기는 남음 | |
| P3 | 스프레드시트 파일을 교체·이동한 뒤 `clearSpreadsheetIdCache()`를 잊으면 서버가 최대 6시간 옛 ID를 돌려줌. 자동 무효화 방법 검토 | [ADR-013](./ADR.md#adr-013-스프레드시트-id를-drive-검색-1회와-서버-캐시로-찾는다) |
| P3 | 프록시 타임아웃이 Apps Script 응답 본문 읽기까지는 제한하지 않음 (위험 낮음) | [ADR-004](./ADR.md#adr-004-apps-script-앞에-netlify-function-프록시를-둔다) |
| P3 | Electron 패키징 앱의 OAuth·API 경로 지원 | [ADR-011](./ADR.md#adr-011-electron은-같은-번들을-감싸는-선택-배포로-둔다) |
| P3 | `package-lock.json`과 `bun.lock` 중 하나로 정리 | |
