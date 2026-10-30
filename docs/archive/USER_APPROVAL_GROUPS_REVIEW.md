# 사용자 승인 및 그룹스 동작 검토 보고서

## 환경변수 정합성

사용자 env(`VITE_GROUP_EMAIL`)와 Apps Script `GROUP_EMAIL_JSON` 형식 일치:
- STUDENT, COUNCIL, PROFESSOR, ADJ_PROFESSOR, ASSISTANT
- 상세: [docs/ENV_ALIGNMENT_REVIEW.md](./ENV_ALIGNMENT_REVIEW.md)

---

## 📋 코드 검토 결과 (최종)

| 항목 | 상태 | 비고 |
|------|------|------|
| Admin SDK appsscript.json | ✅ | AdminDirectory v1 정상 추가 |
| CONFIG.gs GROUP_EMAIL_JSON | ✅ | VITE_GROUP_EMAIL 형식 + 역할키 형식 지원 |
| addMemberToGroupViaAdminApi | ✅ | Member already exists → 성공 처리 |
| approveUserWithGroup 흐름 | ✅ | 성공 시 자동 추가, 실패 시 알림 이메일 |
| 프론트엔드 오류 메시지 | ✅ | result.message \|\| result.error 사용 |

### 수정 반영 사항
- 프론트엔드: 실패 시 `result.message` 우선 표시 (백엔드는 message 필드 사용)
- addMemberToGroupViaAdminApi: "Member already exists" 예외 시 성공으로 처리

---

## 워크스페이스 자동 멤버 추가 (2024 추가)

- **워크스페이스 환경**에서 사용자 승인 시 Admin SDK로 **그룹스에 자동 멤버 추가**
- 비워크스페이스 또는 Admin SDK 권한 없으면 → 기존대로 **그룹 관리자에게 수동 추가 알림 이메일** 전송
- 그룹 이메일: **스크립트 속성 `GROUP_EMAIL_JSON`** (없으면 CONFIG.gs 기본값 사용)
- 형식: `{"STUDENT":"...", "COUNCIL":"...", "PROFESSOR":"...", "ADJ_PROFESSOR":"...", "ASSISTANT":"..."}` 또는 역할키 형식

---

## 1. 전체 흐름 요약

### 1.1 프론트엔드 흐름
1. **관리자 패널** (`useAdminPanel.ts`) → `fetchAllUsers()` → Apps Script `getAllUsers`
2. 사용자 데이터에 `userType` (= `user_type`) 포함
3. **승인 클릭** → `GroupRoleModal` 오픈 (사용자 요청 권한 `user_type`이 기본 선택됨)
4. 관리자가 권한 수정 가능 후 **승인 및 그룹스 추가** 클릭
5. `approveUserWithGroup(studentId, selectedRole)` 호출

### 1.2 백엔드 흐름 (Apps Script)
1. **Main.gs**: `approveUserWithGroup` 액션 → `GroupManagement.gs`의 `approveUserWithGroup()` 호출
2. **approveUserWithGroup**:
   - `approveUser(studentId)` → 스프레드시트 Approval 컬럼 'O', approval_date 설정
   - `getGroupEmailByRole(groupRole)` → `CONFIG.gs`의 `GROUP_ROLE_MAPPING`에서 그룹 이메일 조회
   - `decryptEmailMain()` → 사용자 이메일 복호화
   - `sendGroupNotificationEmail()` → **그룹스 관리자에게** 이메일 전송 (수동 추가 안내)
   - `logGroupManagement()` → `group_management_log` 시트에 기록

---

## 2. 정상 동작 확인 항목

### ✅ 정상 동작하는 부분

| 항목 | 상태 | 설명 |
|------|------|------|
| API 라우팅 | ✅ | Main.gs에서 `approveUserWithGroup` 액션 정상 라우팅 |
| 프론트→백엔드 파라미터 | ✅ | `studentId`, `groupRole` 정상 전달 |
| `GROUP_ROLE_MAPPING` 매핑 | ✅ | student, std_council, supp, professor, ad_professor → 그룹 이메일 매핑 일치 |
| 사용자 요청 권한 표시 | ✅ | `user_type` 컬럼 기반으로 요청 권한 UI 표시 |
| 승인 처리 | ✅ | `approveUser()` 통해 스프레드시트 Approval/approval_date 정상 업데이트 |
| 그룹 이메일 조회 | ✅ | `getGroupEmailByRole(groupRole)`로 역할별 그룹 이메일 정상 반환 |
| 알림 이메일 전송 | ✅ | Gmail API로 그룹 주소로 알림 전송 |

### ⚠️ 현재 구현 방식의 한계 (의도된 설계)

**Google 그룹스에 자동으로 멤버 추가하지 않음**

- 현재: 그룹 이메일 주소로 알림만 전송 → **그룹 관리자가 수동으로 멤버 추가**
- `appsscript.json`에 포함된 `AdminGroupsSettings`(groupssettings API)는 **그룹 설정용**이며, 멤버 추가용이 아님
- **멤버 자동 추가**를 하려면 **Admin SDK (Admin Directory API)** 필요:
  - `AdminDirectory.Members.insert` 등
  - 도메인 위임(Domain-wide delegation) 또는 워크스페이스 관리자 권한 필요

즉, **워크스페이스 환경에서도 현재 코드는 “수동 추가 안내” 방식**이며, API로 직접 멤버를 추가하는 코드는 없음.

---

## 3. 발견된 버그 및 수정 사항

### 🐛 버그 1: `logGroupManagement`에 `userName` 미전달

**위치**: `GroupManagement.gs` 64~72행

**문제**: `logGroupManagement()` 호출 시 `userName`을 전달하지 않아 `group_management_log`의 "사용자 이름" 컬럼이 비어 있음.  
`sendReminderEmail` 등 후속 로직에서 `userData[2]`(사용자 이름)를 사용할 때 빈 값이 될 수 있음.

**수정**: `approvalResult.user.name_member`를 `userName`으로 전달

```javascript
logGroupManagement({
  studentId: studentId,
  userEmail: userEmail,
  userName: approvalResult.user.name_member,  // 추가
  groupEmail: groupEmail,
  groupName: groupName,
  groupRole: groupRole,
  status: 'NOTIFICATION_SENT',
  approvalDate: new Date().toISOString().split('T')[0]
});
```

---

## 4. 권한/역할 매핑 정합성

| 프론트 `GROUP_ROLES` (GroupRoleModal) | CONFIG `GROUP_ROLE_MAPPING` | 일치 |
|---------------------------------------|-----------------------------|------|
| student                                | student                     | ✅   |
| std_council                           | std_council                 | ✅   |
| supp                                  | supp                        | ✅   |
| professor                             | professor                   | ✅   |
| ad_professor                          | ad_professor                | ✅   |

프론트와 백엔드 역할 코드가 일치함.

---

## 5. 워크스페이스 환경에서의 동작

### 현재 동작
1. 사용자 승인 → 스프레드시트 업데이트 ✅
2. 그룹 이메일로 알림 전송 → 그룹 관리자에게 수동 추가 안내 ✅
3. `group_management_log` 기록 ✅

### 자동 멤버 추가를 원할 경우
- Admin SDK (`admin` 서비스) 활성화
- 도메인 위임 또는 관리자 계정에서 스크립트 실행
- `approveUserWithGroup` 내부에 `AdminDirectory.Members.insert` 등으로 멤버 추가 로직 구현 필요

---

## 6. 결론

- **현재 설계(수동 추가 안내 방식)는 의도대로 동작**하는 것으로 보임.
- **버그 1**: `logGroupManagement`에 `userName` 미전달 → 수정 권장.
- **자동 멤버 추가**: 현재 구현에는 없으며, 워크스페이스에서 자동 추가가 필요하면 Admin SDK 도입이 필요함.
