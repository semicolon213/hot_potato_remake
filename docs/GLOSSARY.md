# HP ERP 용어 사전

> 개발 단계: **② 요구사항** · 산출물: 용어 사전(Glossary)

문서와 코드에서 같은 대상을 같은 이름으로 부르기 위한 목록입니다. "코드 표기"는 시트 열 이름이나 코드상 값입니다.

## 업무 용어

| 용어 | 코드 표기 | 뜻 |
|---|---|---|
| 사전 등록 | `addUsersToSpreadsheet` | 관리자가 학번·이름만 미리 넣어 두는 것. 가입 신청은 이 행과 일치해야 함 |
| 가입 신청 | `registerUser` | 사용자가 가입유형을 골라 승인을 요청하는 것 |
| 승인 대기 | `Approval = X` | 가입 신청 후 관리자 승인을 기다리는 상태 |
| 가입유형 / 그룹 역할 | `user_type` | `student`(학생), `std_council`(집행부), `supp`(조교), `professor`(교수), `ad_professor`(겸임교원) |
| 관리자 | `is_admin = O` | 가입유형과 별개인 관리 권한 |
| 관리자 키 | `admin_keys` | 관리자 가입에 필요한 일회성 키. 매일 갱신 |
| 결재 | workflow | 문서를 검토·결재 단계를 거쳐 승인받는 절차 |
| 검토선 | `review_line` | 결재 전에 내용을 확인하는 사람 목록 (순서 있음) |
| 결재선 | `payment_line` | 최종 승인하는 사람 목록 (순서 있음). 코드의 `payment`는 '결재'를 뜻하며 돈과 무관 |
| 보류 | `검토보류`, `결재보류` | 담당자가 판단을 미룬 상태. 승인으로만 재개 가능 |
| 반려 | `검토반려`, `전체반려` | 담당자가 돌려보낸 상태. 요청자가 재상신 가능 |
| 재상신 | `resubmitWorkflow` | 반려된 결재를 고쳐서 다시 올리는 것 |
| 결재 문서 | `workflow_document_*` | 결재를 위해 시스템이 새로 만든 Google 문서 |
| 공유 양식 | `shared_forms` | 관리자가 올린 공용 템플릿 |
| 개인 양식 | `personal_forms` | 사용자가 자기 드라이브에 둔 템플릿 |
| 공용 태그 / 개인 태그 | `static_tag` / `user_setting.tag` | 문서·양식 분류 라벨 |
| 장부 | `{장부명}_장부` | 통장 하나의 입출금, 예산, 카테고리를 담은 스프레드시트 |
| 통장 | `통장` 시트 | 장부의 잔액과 관리인 정보 |
| 주관리인 / 부관리인 | `main_manager_id` / `sub_manager_ids` | 예산 계획을 승인 / 검토하는 사람 |
| 증빙 | `evidence` | 입출금 근거 파일(영수증 등). 장부별 `evidence/` 폴더에 저장 |
| 예산 계획 | `예산계획` 시트 | 집행 전에 승인받는 지출 계획 |
| 집행 | `executed` | 승인된 예산 계획을 실제 지출로 기록하는 것 |
| 고정 공지 | `fix_notice = O` | 목록 맨 위에 고정된 공지. 관리자 승인 필요 |
| 공개 범위 | `access_rights` | 공지를 볼 수 있는 그룹·개인. 비우면 전체 공개 |
| 유급 | `flunk` | 진급 대상에서 제외되는 학생 |
| 진학 | `advanced` | 졸업 후 상급 학교로 진학한 학생 |
| 졸업 학년 | `GRADUATION_GRADE_{id}` | 이 학년을 마치면 졸업 처리. 기본값 3 |
| 위원회 | `committee` | 학과 운영 위원회 구성원 |

## 기술 용어

| 용어 | 뜻 |
|---|---|
| Apps Script (GAS) | Google이 호스팅하는 서버리스 JavaScript 런타임. 이 시스템의 백엔드 |
| 웹앱 배포 | Apps Script를 HTTP로 호출할 수 있게 공개하는 것. `/exec` URL이 생김 |
| 스크립트 속성 | Apps Script의 키-값 설정 저장소 (`PropertiesService`) |
| action | 프론트가 Apps Script에 보내는 요청 종류. 예: `requestWorkflow` |
| 프록시 | Netlify Function `proxy.js`. 브라우저 요청을 Apps Script로 대신 전달 |
| papyrus-db | Google Sheets를 테이블처럼 읽고 쓰는 라이브러리 |
| 프리페치 | 로그인 직후 자주 쓰는 데이터를 미리 받아 캐시에 넣는 것 |
| TTL | 캐시 유효 시간 |
| 루트 폴더 | Drive의 `hot_potato_remake/`. 모든 공용 데이터가 이 아래에 있음 |
| `user_setting` | 사용자마다 개인 드라이브에 생기는 설정 스프레드시트 |
| ENV V2 | 폴더·시트 이름을 JSON 환경변수로 관리하는 현재 설정 방식 |
