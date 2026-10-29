# 환경변수 정합성 검토

> 사용자 제공 환경변수와 코드베이스 매핑 검증 결과

## 1. 제공된 환경변수 구조

```
VITE_GOOGLE_CLIENT_ID, VITE_APP_SCRIPT_URL
VITE_FOLER_NAME (JSON)
VITE_SPREADSHEET_NAME (JSON)
VITE_SHEET_NAME (JSON)
VITE_GROUP_EMAIL (JSON)
```

## 2. 매핑 검증

### 2.1 VITE_FOLER_NAME

| env 키 | 코드 사용처 | 값 예시 |
|--------|-------------|---------|
| ROOT | ROOT_FOLDER_NAME | hot_potato_remake |
| DOCUMENT | DOCUMENT_FOLDER_NAME | document |
| S_DOC | SHARED_DOCUMENT_FOLDER_NAME | shared_documents |
| P_DOC | PERSONAL_DOCUMENT_FOLDER_NAME | personal_documents |
| S_TEMP | TEMPLATE_NAME, SHARED_TEMPLATE | shared_forms |
| P_TEMP | PERSONAL_TEMPLATE_FOLDER_NAME | personal_forms |
| WORKFLOW | (워크플로우) | workflow |
| ACCOUNT | ACCOUNTING_FOLDER_NAME | account |
| ACCOUNT_EVIDENCE | EVIDENCE_FOLDER_NAME | evidence |
| NOTICE_PARENT | NOTICE_ATTACH_PARENT | notice |
| NOTICE_ATTACH | NOTICE_ATTACH_FOLDER_NAME | attached_file |

✅ **일치**: environment.ts DEFAULT_FOLER 및 파싱 로직과 완전 일치

### 2.2 VITE_SPREADSHEET_NAME

| env 키 | ENV_CONFIG 필드 |
|--------|-----------------|
| CONFIG | HOT_POTATO_DB_SPREADSHEET_NAME, PERSONAL_CONFIG_FILE_NAME |
| NOTICE | ANNOUNCEMENT_SPREADSHEET_NAME |
| CALENDAR_* | CALENDAR_PROFESSOR 등 |
| STUDENT, STAFF | STUDENT_SPREADSHEET_NAME, STAFF_SPREADSHEET_NAME |
| TAG | (static_tag) |

✅ **일치**

### 2.3 VITE_SHEET_NAME

| env 키 | ENV_CONFIG 필드 |
|--------|-----------------|
| DEFAULT | ANNOUNCEMENT_SHEET_NAME, CALENDAR_SHEET_NAME |
| WORKFLOW_* | WORKFLOW_TEMPLATE 등 |
| INFO, ISSUE, COMMITTEE | STUDENT_SHEET_NAME 등 |
| CONFIG_* | CONFIG_FAVORITE, CONFIG_TAG, CONFIG_DASHBOARD, CONFIG_SCHEDULE |
| EMPLOYMENT, FIELD | STUDENT_EMPLOYMENT_SHEET_NAME, STUDENT_FIELD_SHEET_NAME |

✅ **일치**

### 2.4 VITE_GROUP_EMAIL

| env 키 | ENV_CONFIG.GROUP_EMAILS | CONFIG.gs (Apps Script) |
|--------|-------------------------|--------------------------|
| STUDENT | STUDENT | → student |
| COUNCIL | COUNCIL | → std_council |
| PROFESSOR | PROFESSOR | → professor |
| ADJ_PROFESSOR | ADJUNCT_PROFESSOR | → ad_professor |
| ASSISTANT | ASSISTANT | → supp |

✅ **일치**: CreateAccountModal roleMap, useTemplateUI, DocumentManagement, NewDocument 등에서 동일 키 사용

### 2.5 Apps Script GROUP_EMAIL_JSON

- **출처**: Apps Script 스크립트 속성 (프론트 .env와 별개)
- **형식**: VITE_GROUP_EMAIL과 동일 JSON (`{"STUDENT":"...", "COUNCIL":"...", ...}`)
- **용도**: 워크스페이스 사용자 승인 시 그룹스 자동 멤버 추가
- **설정**: 프로젝트 설정 → 스크립트 속성에 `GROUP_EMAIL_JSON` = VITE_GROUP_EMAIL 값 복사

## 3. 그룹스 워크스페이스 자동 추가 플로우

1. **프론트** (.env) → `VITE_GROUP_EMAIL` → 문서 공유, 계정 접근권 등
2. **Apps Script** (스크립트 속성) → `GROUP_EMAIL_JSON` → `getGroupEmailByRole()` → 그룹 이메일 조회
3. **승인 시**: `approveUserWithGroup()` → `addMemberToGroupViaAdminApi()` → Admin SDK `Members.insert`
4. **성공**: status `MEMBER_ADDED`  
   **실패** (비워크스페이스 등): 관리자 알림 이메일 전송

## 4. 결론

| 항목 | 상태 |
|------|------|
| 환경변수 구조 | ✅ 제공 env와 코드 매핑 일치 |
| GROUP_EMAILS | ✅ VITE_GROUP_EMAIL → ENV_CONFIG 정상 |
| Apps Script 연동 | ✅ GROUP_EMAIL_JSON 형식 호환 |
| 워크스페이스 자동 멤버 추가 | ✅ Admin SDK 추가, addMemberToGroupViaAdminApi 구현 |
