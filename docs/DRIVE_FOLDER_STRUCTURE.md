# Google Drive 폴더 구조

Hot Potato ERP의 Google Drive 폴더 및 스프레드시트 구조를 정의합니다.

---

## 목차

1. [개요](#1-개요)
2. [공유 드라이브 구조](#2-공유-드라이브-구조)
3. [개인 드라이브 구조](#3-개인-드라이브-구조)
4. [스프레드시트별 시트 구성](#4-스프레드시트별-시트-구성)
5. [변경 이력 (구 구조 → 신 구조)](#5-변경-이력-구-구조--신-구조)

---

## 1. 개요

### 드라이브 구분

| 구분 | 위치 | 용도 |
|------|------|------|
| **공유 드라이브** | `hot_potato_remake/` | 조직 공용 데이터 (회원, 공지, 워크플로우, 문서, 회계 등) |
| **개인 드라이브** | `hot_potato_remake/` | 사용자별 개인 설정, 개인 문서, 개인 양식 |

### 명명 규칙

- **폴더명**: 영문 snake_case (예: `hot_potato_remake`, `shared_documents`)
- **시트명**: 단일 시트는 `시트1`, 다중 시트는 snake_case (예: `workflow_templates`, `std_issue`)
- **테이블 필드**: snake_case (예: `start_time`, `end_date`)

---

## 2. 공유 드라이브 구조

```
hot_potato_remake/                    # 루트 폴더
│
├── hp_member                         # 회원 관리 (루트에만 위치)
│
├── notice/                           # 공지사항
│   ├── notice                        # 공지 스프레드시트
│   └── attached_file/                # 공지 첨부파일
│
├── account/                          # 회계
│   └── evidence/                     # 회계 증빙 자료
│
├── workflow/                         # 워크플로우(결재)
│   ├── workflow                      # 워크플로우 스프레드시트
│   └── attached_file/                # 결재 문서 첨부파일
│
├── document/                         # 문서
│   ├── static_tag                    # 문서 태그 스프레드시트
│   ├── shared_documents/            # 공유 문서
│   └── shared_forms/                 # 공유 양식(템플릿)
│
├── professor/                        # 교수
│   └── calendar_professor            # 교수 캘린더
│
├── student/                          # 학생
│   └── calendar_student              # 학생 캘린더
│
├── std_council/                      # 학생회
│   ├── calendar_council              # 학생회 캘린더
│   └── student                       # 학생 정보
│
├── adj_professor/                    # 겸임교수
│   └── calendar_adj_professor        # 겸임교수 캘린더
│
└── assistant/                        # 조교 (기존 staff, support 통합)
    ├── calendar_assistant           # 조교 캘린더
    └── staff                        # 교직원 정보
```

### 폴더별 용도

| 폴더 | 용도 |
|------|------|
| `notice` | 공지사항 게시판, 첨부파일 |
| `account` | 회계 장부, 증빙 자료 |
| `workflow` | 결재 워크플로우, 결재 문서 |
| `document` | 공유 문서/양식, 문서 태그 |
| `professor` | 교수 전용 캘린더 |
| `student` | 학생 전용 캘린더 |
| `std_council` | 학생회 캘린더, 학생 정보 |
| `adj_professor` | 겸임교수 캘린더 |
| `assistant` | 조교 캘린더, 교직원 정보 |

---

## 3. 개인 드라이브 구조

각 사용자의 **개인 Google Drive**에 다음 구조가 생성됩니다.

```
hot_potato_remake/                    # 루트 폴더
│
├── user_setting                      # 개인 설정 (즐겨찾기, 태그, 일정, 대시보드)
│
└── document/                         # 문서
    ├── personal_documents/           # 개인 문서
    └── personal_forms/               # 개인 양식(템플릿)
```

### 개인 드라이브 vs 공유 드라이브

| 항목 | 공유 드라이브 | 개인 드라이브 |
|------|---------------|---------------|
| `user_setting` | ❌ | ✅ (사용자별) |
| `personal_documents` | ❌ | ✅ (사용자별) |
| `personal_forms` | ❌ | ✅ (사용자별) |
| `shared_documents` | ✅ | ❌ |
| `shared_forms` | ✅ | ❌ |
| 기타 (notice, workflow 등) | ✅ | ❌ |

> **참고**: `personal_documents`, `personal_forms`는 InitialSetup에서 생성하지 않습니다. 사용자가 처음 접근할 때 `personalConfigManager` 또는 `googleSheetUtils`에서 자동 생성됩니다.

---

## 4. 스프레드시트별 시트 구성

### 4.1 hp_member (루트)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `user` | 회원 정보 | no_member, user_type, name_member, google_member, Approval, is_admin, approval_date |
| `group_management_log` | 그룹 관리 로그 | - |
| `admin_keys` | 관리자 키 | - |
| `admin_keys_backup` | 관리자 키 백업 | - |

### 4.2 user_setting (개인 드라이브)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `favorite` | 즐겨찾기 | type, favorite |
| `tag` | 개인 태그 | tag |
| `schedule` | 일정(시간표) | no, title, date, start_time, end_time, description, color |
| `dashboard` | 대시보드 위젯 | widget_id, widget_type, widget_order, widget_config |

### 4.3 notice (notice/)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `시트1` | 공지사항 | no_notice, writer_notice, writer_email, access_rights, title_notice, content_notice, date, view_count, file_notice, fix_notice |

### 4.4 workflow (workflow/)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `workflow_templates` | 결재 템플릿 | template_id, template_name, document_tag, review_line, payment_line, is_default, ... |
| `workflow_history` | 결재 이력 | history_id, workflow_id, action_type, actor_email, action_date, ... |
| `workflow_documents` | 결재 문서 | workflow_id, document_id, requester_email, workflow_status, ... |

### 4.5 static_tag (document/)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `시트1` | 문서 태그 | tag |

### 4.6 캘린더 (professor/, student/, std_council/, adj_professor/, assistant/)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `시트1` | 일정 | id_calendar, title_calendar, start_date, end_date, description_calendar, colorId_calendar, start_date_time, end_date_time, tag_calendar, recurrence_rule_calendar, attendees_calendar |

### 4.7 student (std_council/)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `info` | 학생 정보 | no, name, address, phone_num, grade, state, council, flunk |
| `std_issue` | 학생 이슈 | no_member, date_issue, type_issue, level_issue, content_issue |

### 4.8 staff (assistant/)

| 시트명 | 용도 | 주요 필드 |
|--------|------|-----------|
| `info` | 교직원 정보 | no, pos, name, tel, phone, email, date, note |
| `committee` | 위원회 | sortation, name, tel, email, position, career, company_name, ... |

---

## 5. 변경 이력 (구 구조 → 신 구조)

### 5.1 폴더명 영문화

| 구 (한글) | 신 (영문) |
|-----------|-----------|
| 뜨거운 감자 / hot potato | hot_potato_remake |
| 회계 | account |
| 문서 | document |
| 공유 문서 | shared_documents |
| 개인 문서 | personal_documents |
| 양식 / 공유 양식 | shared_forms |
| 개인 양식 | personal_forms |
| 첨부파일 | attached_file |
| 증빙 | evidence |

### 5.2 스프레드시트/파일명 변경

| 구 | 신 |
|----|-----|
| hp_potato_DB | user_setting |
| calendar_ADprofessor | calendar_adj_professor |
| staff, support 폴더 | assistant (통합) |

### 5.3 시트 삭제

| 항목 | 비고 |
|------|------|
| user_setting / user_custom | dashboard 시트로 통합 |
| workflow / 시트1 | workflow_templates, workflow_history, workflow_documents만 사용 |

### 5.4 구조 통합

| 구 (분산) | 신 (통합) |
|-----------|-----------|
| 공지 관련 파일/폴더 분산 | notice/attached_file (첨부), notice (스프레드시트) |
| 워크플로우 파일/폴더 분산 | workflow/attached_file (결재문서), workflow (스프레드시트) |

### 5.5 테이블 필드 snake_case 통일

| 대상 | 변경 예시 |
|------|-----------|
| schedule | startTime → start_time, endTime → end_time |
| 캘린더 | startDate_calendar → start_date, startDateTime_calendar → start_date_time |
| document/static_tag | 시트명 tag → 시트1 |

---

## 관련 문서

- [ENVIRONMENT_VARIABLES_SETUP.md](./ENVIRONMENT_VARIABLES_SETUP.md) - 환경변수 및 스크립트 속성 설정
- [appScript/README.md](../appScript/README.md) - Apps Script 코드 구조
- [appScript/InitialSetup.gs](../appScript/InitialSetup.gs) - 폴더/스프레드시트 자동 생성 로직
