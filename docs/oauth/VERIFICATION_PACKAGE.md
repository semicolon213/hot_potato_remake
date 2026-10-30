# OAuth 인증 제출 자료

> 대상: Google Auth Platform > Verification Center의 민감한 범위 인증. 절차와 요건은 [OAUTH_PUBLISHING.md](../OAUTH_PUBLISHING.md).
> 전제: develop(drive.file 전환, 서버 측 인가 포함)이 운영(`https://yuhancse.netlify.app`)에 배포된 뒤 제출합니다. 배포 전 코드로 영상을 찍으면 요청 범위가 달라 반려됩니다.

## 1. 동의 화면 입력값

| 항목 | 값 |
|---|---|
| App name | `HP ERP (뜨거운 감자)` |
| User support email | 운영 계정 또는 운영 Google 그룹 (방침 문의처 `khk213624@gmail.com`과 맞춤) |
| App logo | `docs/oauth/logo-120.png` |
| Application home page | `https://yuhancse.netlify.app` (로그인 화면에 서비스 설명과 소개·방침·약관 링크가 있음) |
| Privacy policy | `https://yuhancse.netlify.app/privacy.html` |
| Terms of service | `https://yuhancse.netlify.app/terms.html` |
| Authorized domains | `yuhancse.netlify.app` |
| Developer contact | 실제로 메일을 읽는 운영자 주소 2개 이상 |

## 2. 요청 범위

코드(`src/` 로그인 요청, `public/install/` 설치용 로그인)와 Data Access 목록을 똑같이 맞춥니다.

| 범위 | 분류 | 제출 대상 |
|---|---|---|
| `email`, `profile` | 비민감 | 아니오 |
| `https://www.googleapis.com/auth/drive.file` | 비민감 | 아니오 |
| `https://www.googleapis.com/auth/spreadsheets` | 민감 | 예 |
| `https://www.googleapis.com/auth/calendar.events` | 민감 | 예 |
| `https://www.googleapis.com/auth/calendar.readonly` | 민감 | 예 |
| `https://www.googleapis.com/auth/script.projects` | 민감 | 예 (설치 마법사 전용) |
| `https://www.googleapis.com/auth/script.deployments` | 민감 | 예 (설치 마법사 전용) |

같은 프로젝트에 클라이언트가 둘 있습니다. 웹 앱은 `651515712118-v387…`, 설치 마법사(`/install/`)는 `651515712118-h5n9…`이며 설치용 클라이언트는 `script.projects`, `script.deployments`, `userinfo.email`만 요청합니다.

## 3. 범위별 사용 이유 (제출 양식에 그대로 붙여 넣는 영문)

**App overview**

> HP ERP is an internal web app for a university department (Yuhan University, Computer Software). Approved members (students, student council, teaching assistants, professors) sign in with Google to manage department notices, the academic calendar, document workflows, budget ledgers and member records. All department data lives in Google Sheets and Drive folders owned by the department's operating account; the app reads and updates them on behalf of the signed-in member.

**`https://www.googleapis.com/auth/spreadsheets`**

> The department stores its operational data in Google Sheets owned by the department account and shared with members through Google Groups: notices, member rosters, the academic calendar, budget ledgers and budget plans. The app reads these sheets to display them and writes rows when a member adds or edits a ledger entry, a calendar event, a student record or a budget plan. The app only opens spreadsheets whose IDs are returned by the department's backend; it does not list or read other spreadsheets in the user's Drive. A narrower scope is not available: `drive.file` cannot open spreadsheets the app did not create, and these sheets are created by the department account.

**`https://www.googleapis.com/auth/calendar.events`**

> Members see the department's academic schedule and their own events on one calendar screen. When a member creates, edits or deletes an event in the app, the change is written to the member's Google Calendar so it shows up in their own calendar apps. The app only touches events the member manages through the app.

**`https://www.googleapis.com/auth/calendar.readonly`**

> Used to read the user's calendar metadata (default calendar color and time zone via calendars.get) and the public Korean holidays calendar so the in-app calendar matches the user's Google Calendar. No event data is written with this scope.

**`https://www.googleapis.com/auth/script.projects`, `https://www.googleapis.com/auth/script.deployments`**

> Used only by the one-time installer page (/install) so a department admin can create, upload and deploy their own Apps Script backend from the browser; never used by the main app.

**짧은 통합 설명** (글자 수 제한이 있는 칸에 씀)

> HP ERP is an internal web app for a university department. Approved members sign in with Google to work with department data in Google Sheets and Google Calendar.
> spreadsheets: notices, rosters, calendar, ledgers and budget plans are Sheets owned by the department account and shared via Google Groups. The app reads them and writes rows when a member saves an entry. drive.file cannot open them because the app did not create them.
> calendar.events: events a member creates, edits or deletes in the app are written to their own Google Calendar.
> calendar.readonly: reads default calendar color/time zone and the public Korean holidays calendar.
> script.projects, script.deployments: used only by the one-time installer page (/install) so a department admin can create, upload and deploy their own Apps Script backend from the browser; never used by the main app.
> Data is never sold, used for ads, or shared with third parties (Limited Use).

**Data handling (공통)**

> Access tokens stay in the user's browser and are sent to the department's Google Apps Script backend only to verify the requester's identity with Google's tokeninfo endpoint; tokens are never stored or logged. User data is not sold, not used for advertising, and not transferred to third parties. The app complies with the Google API Services User Data Policy, including the Limited Use requirements (see section 6 of the privacy policy).

## 4. 시연 영상

- YouTube에 **일부 공개(Unlisted)**로 올립니다. 3~5분.
- 브라우저와 Google 계정 언어를 **English**로 바꾼 뒤 찍습니다(동의 화면이 영어로 보여야 함).
- 주소창이 보이게 찍습니다(OAuth 클라이언트 ID와 리디렉션 도메인 확인용).

| 순서 | 화면 | 보여 줄 것 |
|---|---|---|
| 1 | `https://yuhancse.netlify.app` | 로그인 화면의 서비스 설명, 개인정보처리방침·약관 링크 |
| 2 | "Google 계정으로 로그인" 클릭 | 동의 화면 전체. 앱 이름, 요청 범위 목록이 보이도록 잠시 멈춤. 주소창의 `client_id`가 보이도록 |
| 3 | 동의 후 대시보드 | 로그인한 계정 이메일 |
| 4 | 공지사항 목록과 상세 | `spreadsheets` 읽기 |
| 5 | 회계 > 장부 상세 > 항목 추가·저장 | `spreadsheets` 쓰기. 잔액이 바뀌는 모습 |
| 6 | 일정 화면 | 학사 일정과 개인 일정 표시(`calendar.readonly`로 기본 캘린더 색상·공휴일) |
| 7 | 일정 추가 → Google Calendar 새 탭에서 같은 일정 확인 | `calendar.events` 쓰기 |
| 8 | 일정 수정·삭제 → Google Calendar에서 반영 확인 | `calendar.events` 수정·삭제 |
| 9 | 문서 > 새 문서 > 나만 보기로 생성 | `drive.file`(비민감이지만 데이터 흐름 설명용) |
| 10 | `https://yuhancse.netlify.app/install/` 2단계 "로그인하고 백엔드 만들기" | 설치용 동의 화면(`script.projects`, `script.deployments`)과 주소창의 설치용 `client_id`. 프로젝트 생성 → 코드 업로드 → 배포 완료와 백엔드 주소 표시 |
| 11 | `https://myaccount.google.com/permissions`에서 앱 권한 철회 | 사용자가 언제든 철회할 수 있음 |

## 5. 제출 전 확인

- [ ] 운영 사이트가 develop 코드로 배포됨(요청 범위가 2절과 같음). 2026-10-31 main `05448e1`
- [ ] Search Console에서 `https://yuhancse.netlify.app/` 소유 확인
- [ ] Branding 저장 후 "Verify branding" 통과(결과는 7일 유효)
- [ ] Data Access에서 `drive`, `documents`, `gmail.compose` 제거, `script.projects`, `script.deployments` 추가(추가 완료)
- [ ] 개인정보처리방침이 실제 동작과 같음: `drive.file`, 토큰을 신원 확인용으로만 Apps Script에 보냄, 공지 첨부 공유 범위
- [ ] 시연 영상 링크, 3절 문구
- [ ] 심사 중 Google 메일을 받을 개발자 연락처 확인
