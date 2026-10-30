# Google OAuth 앱 게시 체크리스트

HP ERP 웹 OAuth 클라이언트를 Google Auth Platform에서 "Testing"에서 "In production"으로 옮기고 인증(브랜드 인증, 범위 인증)을 받기 위한 요건과 현재 상태를 정리한 문서입니다. 2026-10-29 기준 Google 공식 문서와 코드를 대조했습니다.

- 운영 사이트: https://yuhancse.netlify.app
- OAuth 클라이언트 ID: `651515712118-v387na0c5qgv7mn174u41u8p151msqal.apps.googleusercontent.com` (2026-10-30 운영 계정 소유 프로젝트로 교체. 이전 `517955867919-…`는 다른 계정 소유 프로젝트)
- 인증 방식: 브라우저 리디렉션(implicit, `response_type=token`). 리프레시 토큰을 쓰지 않습니다.
- Apps Script 백엔드는 `executeAs: USER_DEPLOYING`으로 배포자 계정 권한으로 실행합니다. 백엔드 범위는 배포자 한 명만 동의하므로 이 문서의 대상이 아닙니다. 단, 브랜치 `feature/drive-file-scope`부터 양식 내보내기가 `UrlFetchApp`을 쓰므로 배포자가 `script.external_request`("외부 서비스에 연결")를 한 번 더 승인해야 합니다([DEPLOYMENT.md §2.2](./DEPLOYMENT.md#22-웹앱-배포)).

담당 표기: **사용자**는 Google Cloud Console, Search Console, Netlify 설정, 운영 정책 결정을 맡습니다. **Codex**는 코드 수정을 맡습니다(지시서는 별도 전달). **완료**는 `chore/oauth-publishing` 브랜치에서 처리한 항목입니다.

## 1. 결론

현실적인 경로는 다음 순서입니다.

1. 지금 당장은 **Testing을 유지**합니다. 테스트 사용자로 등록한 100명까지 쓸 수 있고, 로그인할 때 "Google에서 확인하지 않은 앱" 경고를 한 번 넘기면 됩니다. 다만 민감한 범위를 요청하므로 동의가 7일마다 만료되어 사용자가 주 1회 다시 동의해야 합니다.
2. Codex가 쓰지 않는 범위(`gmail.compose`, `documents`)를 지우고 `drive`를 `drive.file`로 바꿉니다. **브랜치 `feature/drive-file-scope`에 반영했습니다(develop에 반영, 운영 배포 전).** 웹 클라이언트가 요청하는 범위는 `drive.file`, `spreadsheets`, `calendar.events`, `calendar.readonly`, `profile`, `email`입니다.
3. 병합·배포 뒤 **브랜드 인증과 민감한 범위 인증**(`spreadsheets`, `calendar.events`, `calendar.readonly`)을 신청합니다. 보안 평가(CASA)는 필요 없습니다.

`drive`를 그대로 두면 restricted 범위 인증과 **매년 유료 보안 평가(CASA)**가 필요합니다. 학과 내부 서비스에는 비용과 운영 부담이 커서 권하지 않습니다. 인증 없이 "In production"으로만 바꾸면 "확인되지 않은 앱" 경고가 뜨고 신규 사용자 수가 프로젝트 평생 100명으로 묶이므로 Testing보다 나을 것이 거의 없습니다.

## 2. 범위 분류와 권장안

| 범위 | Google 분류 | 코드에서 쓰는 곳 | 권장 |
|---|---|---|---|
| `email`, `profile` | 비민감 | 로그인, 회원가입 | 유지 |
| `spreadsheets` | 민감 | 서비스 데이터 시트 읽기·쓰기(`sheetsClient`, 회계, 공지 등) | 유지 |
| `drive` | **제한(restricted)** | develop 코드: 사용자 폴더 생성, 공유 폴더 조회, 이름 검색, 템플릿 복사, 권한 부여 | `drive.file`로 교체. 브랜치 `feature/drive-file-scope`에 반영 |
| `drive.file` | 비민감 | 이 앱이 만든 파일만: 개인 폴더 `hot_potato_personal/`과 `user_setting`, 나만 보기 문서, 업로드한 문서 | 채택(브랜치) |
| `calendar.events` | 민감 | 일정 조회, 추가, 수정, 삭제 | 유지 |
| `calendar.readonly` | 민감 | 기본 캘린더 색상 조회(`calendars.get`) | 유지 또는 `calendar.calendars.readonly`로 교체 |
| `documents` | 민감 | **사용처 없음** | 제거(브랜치에 반영) |
| `gmail.compose` | **제한(restricted)** | **사용처 없음**(`src/utils/api/gmailApi.ts`는 import되지 않는 죽은 코드) | 제거(브랜치에서 파일도 삭제) |

`drive.file`로는 배포자 소유 공유 파일이 보이지 않습니다. 그래서 브랜치에서는 아래 작업을 Apps Script(배포자 권한)로 옮겼습니다.

| 작업 | Apps Script 액션 |
|---|---|
| 공지 첨부 업로드 (4MB 이하) | `uploadNoticeAttachment` |
| 공지 본문 이미지 업로드 (작성·수정) | `createAnnouncement`, `updateAnnouncement` 안에서 처리 |
| 공유 스프레드시트 ID 조회 | `getSpreadsheetIds` |
| 회계 증빙 업로드 (4MB 이하, 회계 폴더 아래만) | `uploadEvidenceFile` |
| 장부 정보·대시보드 장부 목록 | `getLedgerList` |
| 공유 양식으로 나만 보기 문서 만들기, 장부 Excel 내보내기 | `exportTemplateFile`(문서는 docx, 시트는 xlsx로 내보냄. 브라우저가 변환 업로드로 사용자 개인 폴더에 저장) |

근거: [Drive 범위 분류](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Gmail 범위 분류](https://developers.google.com/workspace/gmail/api/auth/scopes), [calendars.get 범위](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get), [colors.get 범위](https://developers.google.com/workspace/calendar/api/v3/reference/colors/get).

restricted 범위를 남길 때 생기는 일:

- 범위 인증에 더해 Google이 지정한 평가 기관의 CASA 보안 평가를 통과해 확인서(LOV)를 받아야 합니다. 매년 다시 받습니다. [Security Assessment](https://support.google.com/cloud/answer/13465431)
- 비용은 평가 기관에 직접 내며 Google 공식 가격표는 없습니다. 업체 공개 가격과 후기 기준으로 연 500~4,500달러 정도입니다(비공식 추정).
- Drive 문서는 "restricted 데이터를 서버에 저장하거나 전송하면" 보안 평가가 필요하다고 적고 있습니다. 이 앱은 파일 ID와 메타데이터를 Apps Script로 보내므로 면제를 기대하기 어렵습니다.
- 심사에서 "더 좁은 범위로는 안 되는 이유"를 설명해야 하는데, Google은 `drive.file`과 Picker를 권장하므로 반려될 가능성이 있습니다.

## 3. 요건별 체크리스트

| # | 요건 | 현재 상태 | 조치 | 담당 |
|---|---|---|---|---|
| 1 | 사용자 유형: Internal은 Google Workspace 또는 Cloud Identity 조직에 속한 프로젝트에서, 조직 구성원만 쓸 때 가능 | 사용자가 개인 Google 계정이고 그룹도 `googlegroups.com`이라 Internal 불가 | External 유지. 모든 구성원이 학교 Workspace 계정을 쓸 수 있다면 Internal로 인증 없이 운영하는 길도 있으니 결정 필요 | 사용자 |
| 2 | Testing 한도: 테스트 사용자 100명, 민감 범위 동의는 7일 뒤 만료 | Testing 상태 | 인증 전까지 사용 중인 구성원을 Audience > Test users에 등록 | 사용자 |
| 3 | 미인증 상태로 게시하면 경고 화면, 신규 사용자 평생 100명 제한 | 해당 없음 | 인증 없이 In production으로 바꾸지 않음 | 사용자 |
| 4 | 홈페이지: 공개 접근, 기능 설명, 개인정보처리방침 링크, 로그인 페이지만으로는 불가 | 루트(`/`)는 로그인 화면. `index.html` 상단 정적 바에 앱 이름과 약관 링크만 있었음 | `public/about.html`(`/about`) 소개 페이지 추가, 상단 바에 한 줄 설명과 "서비스 소개" 링크 추가 | 완료 |
| 5 | 홈페이지 URL을 루트로 쓰려면 로그인 화면에도 기능 설명 필요 | 로그인 카드에 설명 없음 | `Login.tsx`에 2~3문장 설명과 소개 링크 추가. 그 전에는 홈페이지 URL을 `https://yuhancse.netlify.app/about.html`로 등록 | develop에 반영(설명과 소개·방침·약관 링크). 운영 배포 전까지 홈페이지 URL은 `/about.html` |
| 6 | 개인정보처리방침: 홈페이지와 같은 도메인, 접근·사용·저장·공유 방식 공개 | 4줄짜리 일반 문구, Google 데이터 설명 없음 | 범위별 사용 목적, 저장 위치, 공유, 삭제, 권한 철회, 방침 변경 고지를 코드 기준으로 작성 | 완료 |
| 7 | Limited Use 준수 문구 | 없음 | 영문·국문 문구를 `privacy.html` 6절과 소개 페이지에 추가 | 완료 |
| 8 | 개인정보처리방침의 사실 정확성 | 관리자 키 메일 요청이 액세스 토큰을 Apps Script로 보내고 `appScript/Main.gs:15`가 요청 전체를 로그에 남김 | 토큰 전송 제거, 요청 로그 축소. **이 수정이 배포되기 전에는 새 `privacy.html`을 배포하지 않음** | develop에 반영(운영 배포 전) |
| 9 | 개인정보처리방침의 미확정 값 | 시행일, 운영 주체, 문의 이메일, 회원 정보 보관 기간이 TODO | 값을 정해 `public/privacy.html`, `public/terms.html`의 TODO 주석 위치를 바꿈 | 완료 (운영: 유한대학교 감자도리, 문의 khk213624@gmail.com, 보관 기간은 사용 기관 지침, 시행일 2026-11-01) |
| 10 | 범위 축소 후 방침 갱신 | 브랜치의 `privacy.html`에서 `documents`, `gmail.compose` 행은 지웠지만, 드라이브 행은 아직 `drive` 범위와 `hot_potato_remake` 폴더를 설명함 | 드라이브 행을 `drive.file`(이 앱이 만든 파일만, 개인 폴더 `hot_potato_personal`)과 Apps Script를 거치는 공유 파일 처리에 맞게 수정 | 완료(브랜치 `chore/oauth-verification`): 드라이브 행을 `drive.file`로, 토큰을 신원 확인용으로 Apps Script에 보내는 것과 공지 첨부 공유 범위를 반영 |
| 11 | 이용약관(선택) | 일반 문구 | Google 연동, 권한 철회, 책임 조항 보강 | 완료 |
| 12 | 승인된 도메인: 홈페이지, 방침, 약관, 리디렉션 URI의 최상위 비공개 도메인 | `netlify.app`은 공개 접미사 목록(PSL)에 있으므로 `yuhancse.netlify.app` 자체가 최상위 비공개 도메인 | Branding > Authorized domains에 `yuhancse.netlify.app` 추가 | 사용자 |
| 13 | 도메인 소유 확인: Search Console에서 프로젝트 소유자 또는 편집자 계정으로 확인 | 미확인 | Search Console에서 URL 접두어 속성 `https://yuhancse.netlify.app/` 추가 후 HTML 태그 또는 HTML 파일로 확인(DNS 방식은 netlify.app이라 불가) | 사용자 |
| 14 | 로고: JPG, PNG, BMP, 1MB 이하, 정사각형 120x120 권장 | `public/logo.svg`만 있음 | `docs/oauth/logo-120.png`(120x120, 흰 배경) 생성 | 완료 |
| 15 | 앱 이름: 다른 조직 브랜드와 혼동되면 안 됨, 동의 화면·홈페이지·방침에서 같은 이름 | 모든 페이지가 "HP ERP (뜨거운 감자)"로 통일 | "HP"가 HP Inc. 상표와 혼동될 수 있음. 심사에서 지적되면 "뜨거운 감자 ERP" 등으로 바꿀지 결정 | 사용자 |
| 16 | 사용자 지원 이메일: 로그인한 사용자 본인 주소 또는 그가 관리하는 Google 그룹 | 미정 | 운영 계정 또는 운영 Google 그룹으로 지정하고 방침 문의처와 같게 맞춤 | 사용자 |
| 17 | 개발자 연락처: Google 알림 수신, 최신 유지 | 미확인 | 실제로 메일을 읽는 운영자 주소 2개 이상 등록 | 사용자 |
| 18 | Google 로그인 버튼 브랜딩 가이드 준수 | 자체 버튼(G 로고, "Google로 로그인") | 가이드 문구("Google 계정으로 로그인")와 스타일 맞춤 확인 | 완료(브랜치 `chore/oauth-verification`): 문구를 "Google 계정으로 로그인"으로 통일, 검은 배경은 가이드의 dark 테마 |
| 19 | 최소 범위 요청 | `gmail.compose`, `documents` 미사용, `drive` 과다 | 2절 권장안 적용 | develop에 반영(운영 배포 전) |
| 20 | 민감 범위 인증 자료: 범위별 사용 이유, 영어 동의 화면이 보이는 시연 영상 | 없음 | 범위 축소 배포 후 시연 영상 촬영(로그인부터 각 기능까지, 동의 화면 언어 English), 범위별 설명 작성 | 자료 준비 완료([oauth/VERIFICATION_PACKAGE.md](./oauth/VERIFICATION_PACKAGE.md)). 영상 촬영과 제출은 사용자 |
| 21 | 파비콘 경로 | `index.html`이 `public/logo.svg`를 가리켜 배포 사이트에서 깨짐 | `/logo.svg`로 수정 | 완료 |

근거 문서:

- [Submit for brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification): 홈페이지, 방침, 승인된 도메인, Search Console, 심사 기간(자동 수 분, 수동 2~3 영업일)
- [Verification requirements](https://support.google.com/cloud/answer/13464321): 시연 영상, Limited Use, 최소 범위, restricted 범위 보안 평가
- [When is verification not needed](https://support.google.com/cloud/answer/13464323): 개인용(100명 미만), Testing, 내부용 면제
- [Manage App Audience](https://support.google.com/cloud/answer/15549945): Internal 조건, 테스트 사용자 100명, 7일 만료, 미인증 앱 평생 100명 제한
- [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049): 로고 규격, 앱 이름 규칙, 지원 이메일 조건
- [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy): 방침 공개, Limited Use
- [OAuth 2.0 개요](https://developers.google.com/identity/protocols/oauth2): Testing 상태 리프레시 토큰 7일 만료
- [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat): `netlify.app` 등재

## 4. Google Cloud Console 작업 순서

Codex 수정(범위 축소, 토큰 전송 제거)과 이 브랜치가 운영에 배포된 뒤에 진행합니다.

1. **Search Console 도메인 확인**
   1. https://search.google.com/search-console 에 Cloud 프로젝트 소유자 계정으로 로그인합니다.
   2. 속성 추가 > URL 접두어 > `https://yuhancse.netlify.app/` 를 입력합니다.
   3. "HTML 파일" 방식이면 받은 `google....html` 파일을 저장소 `public/`에 넣어 배포하고, "HTML 태그" 방식이면 `index.html`의 `<head>`에 메타 태그를 넣어 배포합니다. 배포 후 "확인"을 누릅니다. 확인 파일과 태그는 지우지 않습니다.
2. **Branding** (Google Auth Platform > Branding)
   1. App name: `HP ERP (뜨거운 감자)` (홈페이지, 방침과 같은 이름)
   2. User support email: 운영 계정 또는 운영 Google 그룹
   3. App logo: `docs/oauth/logo-120.png` 업로드
   4. Application home page: `https://yuhancse.netlify.app/about.html` (로그인 화면에 설명이 들어가면 `https://yuhancse.netlify.app`)
   5. Privacy policy: `https://yuhancse.netlify.app/privacy.html`
   6. Terms of service: `https://yuhancse.netlify.app/terms.html`
   7. Authorized domains: `yuhancse.netlify.app`
   8. Developer contact: 운영자 이메일
   9. 저장 후 "Verify branding"을 누릅니다. 결과는 7일간 유효하므로 그 안에 게시합니다.
3. **Data Access**: 범위를 코드와 똑같이 맞춥니다. `email`, `profile`, `spreadsheets`, `calendar.events`, `calendar.readonly`(또는 `calendar.calendars.readonly`), `drive.file`. `drive`, `documents`, `gmail.compose`는 목록에서 지웁니다.
4. **Audience**: "Publish app"으로 In production으로 바꿉니다.
5. **Verification Center**: 민감 범위 인증을 제출합니다. 범위별 사용 이유(이 문서 2절 참고), 시연 영상 YouTube 링크(비공개 목록), 동의 화면 언어 English를 준비합니다. 심사 중 Google이 개발자 연락처로 메일을 보내므로 확인합니다.
6. In production으로 바꾼 뒤 인증이 끝날 때까지는 경고 화면이 뜨고 신규 사용자 100명 제한이 적용됩니다. 사용자가 많다면 인증 승인 직전까지 Testing을 유지하고, 승인 메일을 받은 뒤 게시하는 순서도 가능합니다.

## 4-1. 새 Google 계정으로 처음부터 세팅하는 경우

운영 계정을 새 Google 계정으로 바꾸고 Cloud 프로젝트, Apps Script, Drive 데이터를 모두 새로 만드는 경우입니다. 이 경우 위 4절의 Console 작업은 새 프로젝트에서 처음부터 진행합니다.

| 순서 | 할 일 | 담당 |
|---|---|---|
| 1 | 새 계정으로 Google Cloud 프로젝트 생성, Sheets·Drive·Calendar API 사용 설정 | 사용자 |
| 2 | OAuth 클라이언트(웹) 생성. 승인된 JavaScript 원본에 운영 주소와 `http://localhost:5173` 등록 | 사용자 |
| 3 | 새 계정 Drive에 독립형 Apps Script 프로젝트 생성 후 `clasp push`. 그룹 주소가 기본값과 다르면 `GROUP_EMAIL_JSON`(한 줄 JSON)을 먼저 넣고 `initializeSystem()` 실행. 폴더·`hp_member`를 포함한 시트·스크립트 속성 생성과 역할 폴더 그룹 공유까지 처리됨 ([DEPLOYMENT.md §3](./DEPLOYMENT.md#3-초기-세팅-drive-폴더시트-생성)) | 사용자 (clasp는 대행 가능) |
| 4 | 편집기에서 아무 함수나 실행해 `script.external_request`를 포함한 권한 승인. 스크립트 속성 확인: `ROOT_FOLDER_ID`, `SPREADSHEET_ID`(자동으로 맞춰짐), `GROUP_EMAIL_JSON`, `LOG_LEVEL`. 관리자 키 갱신 트리거 등록 | 사용자 |
| 5 | 웹앱 배포(버전 고정) 후 `/exec` 주소를 Netlify `APP_SCRIPT_URL`에 입력 | 사용자 |
| 6 | Netlify 환경변수: `VITE_GOOGLE_CLIENT_ID`를 새 클라이언트 ID로, JSON 4개는 한 줄로 넣거나 비움 | 사용자 |
| 7 | Google 그룹 5개의 관리 권한을 새 계정에 부여 (그룹 자동 추가에 필요) | 사용자 |
| 8 | 범위는 처음부터 축소된 목록(`drive.file` 포함)으로 등록하고, 브랜드 인증과 민감한 범위 인증 진행 (4절 2~5단계) | 사용자 |
| 9 | 구성원 사전 등록 후 가입 승인 | 운영자 |

알아 둘 점:

- 새 프로젝트는 클라이언트 ID가 달라서 모든 사용자가 다시 동의합니다.
- `drive.file`은 프로젝트별로 접근 범위가 나뉩니다. 사용자 개인 Drive에 예전 프로젝트가 만든 개인 폴더가 있으면 새 앱에서는 보이지 않고, 같은 이름의 폴더가 새로 생깁니다. 예전 개인 폴더는 사용자가 직접 지우거나 그대로 두면 됩니다.
- 예전 계정의 데이터(회원, 공지, 일정, 장부)는 자동으로 옮겨지지 않습니다. 옮겨야 하면 시트 단위로 복사하는 별도 작업이 필요합니다.
- 새로 세팅하는 시점에 `drive.file` 전환 코드가 함께 배포되어야 처음부터 축소된 범위로 인증을 받을 수 있습니다.
- 배포 계정의 [myaccount.google.com/permissions](https://myaccount.google.com/permissions)에서 Apps Script 프로젝트 권한을 지우면 모든 웹앱 배포가 403을 돌려줍니다. 편집기에서 아무 함수나 실행해 다시 승인하면 풀립니다.

## 5. 확인이 필요한 질문

1. 학과 구성원 전원이 학교 Google Workspace 계정(`yuhan.ac.kr` 등)을 쓸 수 있습니까? 가능하면 Internal 유형으로 인증 없이 운영할 수 있습니다.
2. 현재 실제 사용자 수와 예상 최대 인원은 몇 명입니까? 100명 이내면 Testing 유지도 선택지입니다.
3. 운영 주체 명칭, 문의 이메일, 회원 정보 보관 기간, 방침 시행일은 무엇으로 합니까?
4. 앱 이름에서 "HP"를 유지합니까?
5. `drive.file` 전환(공유 폴더 접근을 Apps Script로 옮기는 작업)을 진행합니까, 아니면 `drive`를 유지하고 CASA 비용을 감수합니까? → `drive.file` 전환으로 진행. develop에 반영(운영 배포 전).
6. 별도 도메인(예: 학과 도메인)을 Netlify에 연결할 계획이 있습니까? 있으면 DNS로 도메인을 확인하는 편이 깔끔합니다.
7. CSP의 `dailykeyupdate-...run.app`(Cloud Run)은 프런트 코드에서 호출하지 않습니다. 사용자 데이터를 다루는 서비스라면 방침에 적어야 하니 용도를 알려 주세요.
