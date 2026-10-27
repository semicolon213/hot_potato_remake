# 데이터 캐싱 전략 및 백그라운드 동기화

## 빠른 참고 (요약)

- **목적**: Apps Script 호출 감소, 오프라인·재방문 시 체감 속도 개선.
- **핵심 코드**: `src/utils/cache/`, `src/utils/api/apiClient.ts`, 쓰기 후 무효화·`DataSyncService` 연동.
- **저장소**: 메모리 + IndexedDB(및 기획서에 명시된 localStorage 등) — 아래 본문에 단계별 상세.
- **문서 목차**: [docs/README.md](./README.md)에서 다른 가이드와 함께 보기.

아래부터는 **구현 계획·단계·API 목록 등 전체 기록**입니다. 일상 개발에는 위 요약 + `apiClient`의 `CACHEABLE_ACTIONS` / `getWriteCacheKeys` 정도만 알아도 충분합니다.

---

> **✅ 구현 상태**: Phase 1-6 모두 구현 완료 (2025년 1월)
> 
> 모든 핵심 기능이 구현되어 프로덕션 사용 가능한 상태입니다.
> - ✅ Phase 1: 캐시 인프라 구축 (메모리 + localStorage)
> - ✅ Phase 2: API 클라이언트 통합
> - ✅ Phase 3: 데이터 동기화 서비스
> - ✅ Phase 4: 로딩 UI 구현
> - ✅ Phase 5: Hook 통합
> - ✅ Phase 6: 백그라운드 동기화

## 📋 목차
1. [현재 데이터 페칭 구조 분석](#현재-데이터-페칭-구조-분석)
2. [전체 데이터 페칭 목록](#전체-데이터-페칭-목록)
3. [캐싱 전략](#캐싱-전략)
4. [구현 계획](#구현-계획)
5. [UI 컴포넌트 설계](#ui-컴포넌트-설계)
6. [갱신 트리거 전략](#갱신-트리거-전략)
7. [기술 스택](#기술-스택)
8. [단계별 구현](#단계별-구현)
9. [구현 완료 상태](#구현-완료-상태)

---

## 🔍 현재 데이터 페칭 구조 분석

### 1. 데이터 페칭 경로

#### A. Apps Script API를 통한 데이터 페칭 (`apiClient.ts`)
**위치**: `src/utils/api/apiClient.ts`

**주요 API 호출 메서드들**:
- **사용자 관리**
  - `getAllUsers()` - 전체 사용자 목록
  - `getPendingUsers()` - 승인 대기 사용자 목록
  - `getUserNameByEmail(email)` - 이메일로 사용자 이름 조회
  - `checkApprovalStatus(email)` - 사용자 승인 상태 확인

- **문서 관리**
  - `getDocuments(params)` - 문서 목록 조회
  - `getTemplates()` - 템플릿 목록
  - `getSharedTemplates()` - 공유 템플릿 목록
  - `getStaticTags()` - 기본 태그 목록

- **워크플로우**
  - `getMyRequestedWorkflows(userEmail)` - 내가 올린 결재 목록
  - `getMyPendingWorkflows(params)` - 내 담당 워크플로우
  - `getCompletedWorkflows(params)` - 결재 완료된 리스트
  - `getWorkflowTemplates()` - 워크플로우 템플릿 목록
  - `getWorkflowStatus(params)` - 워크플로우 상태 조회
  - `getWorkflowHistory(params)` - 워크플로우 이력

- **회계**
  - `getLedgerList()` - 장부 목록
  - `getAccountingCategories(spreadsheetId)` - 카테고리 목록
  - `getAccountingCategorySummary(spreadsheetId)` - 카테고리별 집계
  - `getPendingBudgetPlans(spreadsheetId, userEmail)` - 대기 중인 예산 계획
  - `getAccountingFolderId()` - 회계 폴더 ID

- **스프레드시트 관리**
  - `getSpreadsheetIds(spreadsheetNames)` - 스프레드시트 ID 목록 조회

#### B. Google Sheets API 직접 접근 (`papyrusManager.ts`)
**위치**: `src/utils/database/papyrusManager.ts`

**주요 데이터 페칭 함수들**:
- `initializeSpreadsheetIds()` - 스프레드시트 ID 초기화
- `getAnnouncements(spreadsheetId, limit, offset)` - 공지사항 목록
- `getAnnouncementById(spreadsheetId, announcementId)` - 공지사항 상세
- `getCalendarEvents(spreadsheetId, dateRange)` - 캘린더 이벤트
- `getStudentList(spreadsheetId)` - 학생 목록
- `getStaffList(spreadsheetId)` - 교직원 목록
- `getStudentIssues(spreadsheetId)` - 학생 이슈 목록

#### C. Google Sheets API 직접 접근 (`googleSheetUtils.ts`)
**위치**: `src/utils/google/googleSheetUtils.ts`

**주요 함수들**:
- `getSheetData(spreadsheetId, sheetName, range)` - 시트 데이터 직접 조회

#### D. 회계 데이터 관리 (`accountingManager.ts`)
**위치**: `src/utils/database/accountingManager.ts`

**주요 함수들**:
- `getAccounts(spreadsheetId)` - 통장 목록
- `getLedgerEntries(spreadsheetId, accountId, filters)` - 장부 항목 목록
- `getCategories(spreadsheetId)` - 카테고리 목록
- `getBudgetPlans(spreadsheetId, filters)` - 예산 계획 목록

### 2. 현재 데이터 로딩 패턴

#### A. 로그인 시 초기화 (`useAppState.ts`)
**위치**: `src/hooks/core/useAppState.ts`

```typescript
// 로그인 시 실행되는 초기화
useEffect(() => {
  if (user && user.isApproved && !isLoading) {
    const initAndFetch = async () => {
      await initializeGoogleAPIOnce(hotPotatoDBSpreadsheetId);
      const spreadsheetIds = await initializeSpreadsheetIds();
      // 스프레드시트 ID들 상태 업데이트
      // ...
    };
    initAndFetch();
  }
}, [user, isLoading]);
```

**로딩되는 데이터**:
- 스프레드시트 ID들 (공지사항, 캘린더, 학생, 교직원 등)
- 회계 폴더 ID

#### B. 페이지별 데이터 로딩

**대시보드** (`Dashboard.tsx` + `useWidgetManagement.ts`):
- 위젯별 데이터 (공지사항, 캘린더, 워크플로우 상태, 학생 요약, 교직원 요약 등)
- 각 위젯이 개별적으로 데이터 페칭

**문서 관리** (`DocumentManagement.tsx`):
- 문서 목록 (`loadAllDocuments()`)
- 템플릿 목록
- 태그 목록 (기본 태그 + 개인 태그)

**워크플로우 관리** (`WorkflowManagement.tsx`):
- 내가 올린 결재 목록
- 내 담당 워크플로우
- 결재 완료된 리스트
- 워크플로우 템플릿 목록

**회계** (`Accounting.tsx` + `LedgerEntryList.tsx`):
- 장부 목록
- 통장 목록
- 장부 항목 목록
- 카테고리 목록
- 예산 계획 목록

**학생 관리** (`Students.tsx` + `useStudentManagement.ts`):
- 학생 목록
- 학생 이슈 목록

**교직원 관리** (`Staff.tsx` + `useStaffManagement.ts`):
- 교직원 목록

**공지사항** (`Announcements.tsx`):
- 공지사항 목록

**캘린더** (`Calendar.tsx`):
- 캘린더 이벤트 목록

### 3. 현재 문제점

1. **중복 요청**: 같은 데이터를 여러 컴포넌트에서 개별적으로 요청
2. **로딩 지연**: 각 페이지 진입 시마다 데이터 페칭으로 인한 지연
3. **캐시 미활용**: 현재 `apiClient`에 캐시 구조는 있으나 비활성화됨 (`cacheableActions: []`)
4. **순차 로딩**: 병렬 처리 부족으로 인한 느린 초기 로딩
5. **백그라운드 갱신 없음**: 데이터가 오래된 상태로 유지될 수 있음

---

## 📊 전체 데이터 페칭 목록

### 1. Apps Script API를 통한 데이터 페칭 (`apiClient.ts`)

#### 읽기 전용 (캐싱 가능)

**사용자 관리**:
- `getAllUsers()` - 전체 사용자 목록
- `getPendingUsers()` - 승인 대기 사용자 목록
- `getUserNameByEmail(email)` - 이메일로 사용자 이름 조회

**문서 관리**:
- `getDocuments(params)` - 문서 목록 조회
  - params: `{ role, searchTerm?, author?, sortBy?, page?, limit? }`
- `getTemplates()` - 템플릿 목록
- `getSharedTemplates()` - 공유 템플릿 목록
- `getStaticTags()` - 기본 태그 목록

**워크플로우**:
- `getMyRequestedWorkflows(userEmail)` - 내가 올린 결재 목록
- `getMyPendingWorkflows(params)` - 내 담당 워크플로우
  - params: `{ userEmail, status? }`
- `getCompletedWorkflows(params)` - 결재 완료된 리스트
  - params: `{ userEmail, startDate?, endDate? }`
- `getWorkflowTemplates()` - 워크플로우 템플릿 목록
- `getWorkflowStatus(params)` - 워크플로우 상태 조회
  - params: `{ workflowId?, documentId?, workflowDocumentId? }`
- `getWorkflowHistory(params)` - 워크플로우 이력

**회계**:
- `getLedgerList()` - 장부 목록
- `getAccountingCategories(spreadsheetId)` - 카테고리 목록
- `getAccountingCategorySummary(spreadsheetId)` - 카테고리별 집계
- `getPendingBudgetPlans(spreadsheetId, userEmail)` - 대기 중인 예산 계획
- `getAccountingFolderId()` - 회계 폴더 ID

**시스템**:
- `getSpreadsheetIds(spreadsheetNames)` - 스프레드시트 ID 목록 조회
- `checkApprovalStatus(email)` - 사용자 승인 상태 확인

#### 쓰기 작업 (캐싱 불가, 캐시 무효화 필요)

**사용자 관리**:
- `approveUserWithGroup(studentId, groupRole)`
- `rejectUser(studentId)`
- `addUsersToSpreadsheet(users)`
- `clearUserCache()`

**문서 관리**:
- `createDocument(documentData)`
- `deleteDocuments(documentIds, role)`
- `uploadSharedTemplate(params)`
- `updateSharedTemplateMeta(params)`
- `deleteSharedTemplate(fileId)`
- `addStaticTag(tag)`
- `updateStaticTag(oldTag, newTag, confirm)`
- `deleteStaticTag(tag, confirm, deleteTemplates)`

**워크플로우**:
- `requestWorkflow(data)`
- `setWorkflowLine(data)`
- `grantWorkflowPermissions(data)`
- `approveReview(data)`
- `rejectReview(data)`
- `holdReview(data)`
- `approvePayment(data)`
- `rejectPayment(data)`
- `holdPayment(data)`
- `resubmitWorkflow(data)`
- `createWorkflowTemplate(data)`
- `updateWorkflowTemplate(data)`
- `deleteWorkflowTemplate(templateId)`

**회계**:
- `createLedger(data)`
- `updateAccountSubManagers(data)`

### 2. Google Sheets 직접 접근 (`papyrusManager.ts`)

#### 읽기 전용 (캐싱 가능)

**초기화**:
- `initializeSpreadsheetIds()` - 스프레드시트 ID 초기화
  - 내부적으로 `apiClient.getSpreadsheetIds()` 호출
  - 개인 설정 파일 ID 조회 (`findPersonalConfigFile()`)
  - 회계 폴더 ID 조회

**공지사항**:
- `fetchAnnouncements(userId, userType)` - 공지사항 목록
  - 내부적으로 `apiClient.request('getAnnouncements', ...)` 호출

**템플릿**:
- `fetchTemplates()` - 템플릿 목록 (개인 설정 파일에서)
- `fetchTags()` - 태그 목록 (개인 설정 파일에서)

**캘린더**:
- `fetchCalendarEvents()` - 캘린더 이벤트 목록
  - 사용자 타입에 따라 다른 스프레드시트에서 조회

**학생 관리**:
- `fetchStudents(spreadsheetId?)` - 학생 목록
- `fetchStudentIssues(studentNo)` - 학생 이슈 목록

**교직원 관리**:
- `fetchStaff()` - 교직원 목록
- `fetchAttendees()` - 참석자 목록 (학생 + 교직원)
- `fetchStaffFromPapyrus(spreadsheetId)` - Papyrus DB에서 교직원 조회
- `fetchCommitteeFromPapyrus(spreadsheetId)` - 위원회 목록 조회

#### 쓰기 작업 (캐싱 불가, 캐시 무효화 필요)

**공지사항**:
- `addAnnouncement(spreadsheetId, postData)`
- `updateAnnouncement(announcementId, userId, postData)`
- `deleteAnnouncement(spreadsheetId, announcementId, userId)`
- `incrementViewCount(announcementId)`
- `requestPinnedAnnouncementApproval(postData)`

**템플릿**:
- `addTemplate(newDocData)`
- `updateTemplate(rowIndex, newDocData)`
- `deleteTemplate(rowIndex)`
- `updateTemplateFavorite(rowIndex, favoriteStatus)`

**캘린더**:
- `addCalendarEvent(spreadsheetId, eventData, userType)`
- `updateCalendarEvent(spreadsheetId, eventId, eventData)`
- `deleteCalendarEvent(spreadsheetId, eventId)`

**학생 관리**:
- `deleteStudent(spreadsheetId, studentNo)`
- `addStudentIssue(issueData)`
- `saveAcademicScheduleToSheet(scheduleData)`

**교직원 관리**:
- `addStaff(spreadsheetId, staff)`
- `updateStaff(spreadsheetId, staffNo, staff)`
- `deleteStaff(spreadsheetId, staffNo)`
- `addCommittee(spreadsheetId, committee)`
- `updateCommittee(spreadsheetId, committeeName, committee)`
- `deleteCommittee(spreadsheetId, committeeName)`

### 3. 회계 데이터 관리 (`accountingManager.ts`)

#### 읽기 전용 (캐싱 가능)

- `getAccounts(spreadsheetId)` - 통장 목록
- `getLedgerEntries(spreadsheetId, accountId, filters)` - 장부 항목 목록
  - filters: `{ startDate?, endDate?, category?, transactionType? }`
- `getCategories(spreadsheetId)` - 카테고리 목록
- `getEvidenceFolderIdFromSpreadsheet(spreadsheetId)` - 증빙 폴더 ID

#### 쓰기 작업 (캐싱 불가, 캐시 무효화 필요)

- `createLedgerEntry(spreadsheetId, accountId, entryData)`
- `updateLedgerEntry(spreadsheetId, accountId, entryId, entryData)`
- `deleteLedgerEntry(spreadsheetId, accountId, entryId)`
- `uploadEvidenceFile(spreadsheetId, accountId, entryId, file)`
- `createCategory(spreadsheetId, categoryData)`
- `updateCategory(spreadsheetId, categoryId, categoryData)`
- `deleteCategory(spreadsheetId, categoryId)`

### 4. 예산 계획 관리 (`accountingBudgetManager.ts`)

#### 읽기 전용 (캐싱 가능)

- `getBudgetPlans(spreadsheetId, filters)` - 예산 계획 목록
  - filters: `{ status?, year?, month? }`

#### 쓰기 작업 (캐싱 불가, 캐시 무효화 필요)

- `createBudgetPlan(spreadsheetId, planData)`
- `reviewBudgetPlan(spreadsheetId, budgetId, reviewData)`
- `approveBudgetPlan(spreadsheetId, budgetId, approvalData)`
- `rejectBudgetPlan(spreadsheetId, budgetId, rejectionData)`
- `executeBudgetPlan(spreadsheetId, budgetId, executionData)`
- `updateBudgetPlanDetails(spreadsheetId, budgetId, details)`
- `deleteBudgetPlan(spreadsheetId, budgetId)`

### 5. 개인 설정 관리

#### 읽기 전용 (캐싱 가능)

**개인 설정 파일** (`personalConfigManager.ts`):
- `findPersonalConfigFile()` - 개인 설정 파일 ID 조회
- `getScheduleEvents()` - 일정 이벤트 목록

**개인 태그** (`personalTagManager.ts`):
- `fetchTags()` - 개인 태그 목록
- `findPersonalTemplatesByTag(tag)` - 태그별 템플릿 목록
- `checkTagUpdateImpact(oldTag, newTag)` - 태그 수정 영향 확인
- `checkTagDeletionImpact(tag)` - 태그 삭제 영향 확인

**개인 즐겨찾기** (`personalFavoriteManager.ts`):
- `fetchFavorites()` - 즐겨찾기 목록
- `getFavoritesByType(type)` - 타입별 즐겨찾기 목록
- `isFavorite(favoriteData)` - 즐겨찾기 여부 확인

#### 쓰기 작업 (캐싱 불가, 캐시 무효화 필요)

**개인 설정 파일**:
- `createPersonalConfigFile()` - 개인 설정 파일 생성
- `addScheduleEvent(event)`
- `updateScheduleEvent(event)`
- `deleteScheduleEvent(eventNo)`

**개인 태그**:
- `addTag(tag)`
- `removeTag(tag)`
- `updateTag(oldTag, newTag)`
- `updatePersonalTemplateMetadata(oldTag, newTag)`

**개인 즐겨찾기**:
- `addFavorite(favoriteData)`
- `removeFavorite(favoriteData)`
- `toggleFavorite(favoriteData)`

### 6. Google Sheets API 직접 호출 (`googleSheetUtils.ts`)

#### 읽기 전용 (캐싱 가능)

- `getSheetData(spreadsheetId, sheetName, range)` - 시트 데이터 직접 조회

#### 쓰기 작업 (캐싱 불가, 캐시 무효화 필요)

- `appendSheetData(spreadsheetId, sheetName, data)`

### 7. 로그인 시 초기 로딩 데이터 (`useAppState.ts`)

**초기화 단계**:
1. Google API 초기화 (`initializeGoogleAPIOnce()`)
2. 스프레드시트 ID 초기화 (`initializeSpreadsheetIds()`)
   - 공지사항 스프레드시트 ID
   - 캘린더 스프레드시트 ID들 (교수, 학생, 위원회, AD교수, 지원)
   - 학생 스프레드시트 ID
   - 교직원 스프레드시트 ID
   - 개인 설정 파일 ID
   - 회계 폴더 ID

**페이지별 초기 로딩** (현재는 각 페이지에서 개별 로딩):
- 대시보드: 위젯 데이터
- 문서 관리: 문서 목록, 템플릿 목록, 태그 목록
- 워크플로우: 워크플로우 목록, 템플릿 목록
- 회계: 장부 목록
- 학생 관리: 학생 목록
- 교직원 관리: 교직원 목록
- 공지사항: 공지사항 목록
- 캘린더: 캘린더 이벤트 목록

---

## 💾 캐싱 전략

## 🎯 최종 추천: 단계적 하이브리드 전략 (Phase 1 우선)

### 프로젝트 특성 분석

**현재 프로젝트 상황**:
- 데이터 양: 중간 규모 (수백~수천 개 항목)
- 사용자 수: 소규모~중규모 (10-30명)
- 데이터 변경 빈도: 낮음~중간
- 오프라인 필요성: 낮음 (항상 온라인)
- 기존 localStorage 사용: 이미 사용 중 (user, token 등)

**결론**: Phase 1 (메모리 + localStorage)로 시작하는 것이 최적

### Phase 1: 메모리 캐시 + localStorage ⭐ (우선 구현)

**목적**: 빠른 구현으로 즉시 효과 확인

**구조**:
- **메모리 캐시 (Map)**: 자주 사용하는 데이터, 빠른 접근 (LRU, 최대 100개)
- **localStorage**: 페이지 새로고침 후에도 유지할 데이터 (작은 데이터만, 100KB 이하)

**장점**:
- ✅ **구현 간단**: 1-2일 내 구현 가능
- ✅ **즉시 효과**: 캐싱 효과를 바로 확인
- ✅ **기존 활용**: 이미 localStorage 사용 중이므로 통합 용이
- ✅ **브라우저 호환성**: 모든 브라우저 지원
- ✅ **성능 우수**: 메모리 캐시로 빠른 접근
- ✅ **용량 충분**: 프로젝트 데이터 양이 localStorage 한도 내

**단점**:
- ⚠️ localStorage 용량 제한 (5-10MB) - 프로젝트 규모에서는 충분
- ⚠️ 동기 처리 - 작은 데이터는 성능 영향 미미

**적용 대상**:
- 모든 읽기 전용 데이터 (사용자 목록, 템플릿, 워크플로우, 장부 등)
- 작은 데이터 (100KB 이하)는 localStorage에 저장
- 큰 데이터도 메모리 캐시로 빠른 접근 가능

### Phase 2: IndexedDB 추가 (선택사항, 필요 시)

**목적**: 대용량 데이터 및 오프라인 지원 (현재는 불필요)

**구조**:
- **메모리 캐시**: 최근 사용한 데이터 (LRU 캐시) - Phase 1과 동일
- **IndexedDB**: 모든 캐시 데이터 영구 저장 (Phase 2에서 추가)
- **localStorage**: 작은 데이터만 저장 - Phase 1과 동일

**장점**:
- ✅ 대용량 데이터 지원 (수백 MB)
- ✅ 비동기 처리로 성능 우수
- ✅ 오프라인 지원 가능
- ✅ 구조화된 데이터 저장

**단점**:
- ⚠️ 구현 복잡도 높음 (추가 라이브러리 필요)
- ⚠️ 브라우저 호환성 확인 필요
- ⚠️ 현재 프로젝트에서는 과도한 기능

**Phase 1에서 Phase 2로 전환하는 시점**:
- localStorage 용량이 80% 이상 사용될 때
- 오프라인 지원이 필요할 때
- 데이터가 수만 개 이상으로 증가할 때
- 대용량 파일(이미지, 첨부파일 등) 캐싱이 필요할 때

### Phase 1 구현 구조 (우선 구현)

```typescript
// 2단계 캐시 계층 구조 (Phase 1)
class CacheManager {
  // 1단계: 메모리 캐시 (가장 빠름)
  private memoryCache: Map<string, CacheEntry> = new Map();
  private readonly MAX_MEMORY_CACHE_SIZE = 100; // 최대 100개 항목
  
  // 2단계: localStorage (작은 데이터, 빠른 접근)
  private readonly MAX_LOCALSTORAGE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly SMALL_DATA_THRESHOLD = 100 * 1024; // 100KB 이하
  
  // 캐시 조회 순서: 메모리 → localStorage → API
  async get<T>(key: string): Promise<T | null> {
    // 1. 메모리 캐시 확인
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.data as T;
    }
    
    // 2. localStorage 확인 (작은 데이터만)
    const localStorageEntry = this.getFromLocalStorage(key);
    if (localStorageEntry && !this.isExpired(localStorageEntry)) {
      // 메모리 캐시에도 저장 (다음 접근 시 빠름)
      this.memoryCache.set(key, localStorageEntry);
      this.evictMemoryCacheIfNeeded();
      return localStorageEntry.data as T;
    }
    
    return null; // 캐시 미스 → API 호출 필요
  }
  
  // 데이터 크기에 따라 저장 위치 결정
  async set<T>(key: string, data: T, ttl: number): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      version: 1
    };
    
    // 항상 메모리 캐시에 저장 (LRU로 관리)
    this.memoryCache.set(key, entry);
    this.evictMemoryCacheIfNeeded();
    
    // 작은 데이터는 localStorage에도 저장
    if (this.isSmallData(entry)) {
      this.saveToLocalStorage(key, entry);
    }
  }
  
  private isSmallData(entry: CacheEntry): boolean {
    const dataSize = JSON.stringify(entry.data).length;
    return dataSize < this.SMALL_DATA_THRESHOLD;
  }
  
  // LRU 캐시 관리
  private evictMemoryCacheIfNeeded(): void {
    if (this.memoryCache.size <= this.MAX_MEMORY_CACHE_SIZE) {
      return;
    }
    
    // 가장 오래된 항목 제거 (LRU)
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - this.MAX_MEMORY_CACHE_SIZE);
    toRemove.forEach(([key]) => this.memoryCache.delete(key));
  }
  
  // localStorage 관리
  private getFromLocalStorage(key: string): CacheEntry | null {
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (!stored) return null;
      return JSON.parse(stored) as CacheEntry;
    } catch {
      return null;
    }
  }
  
  private saveToLocalStorage(key: string, entry: CacheEntry): void {
    try {
      // localStorage 용량 체크
      const currentSize = this.getLocalStorageSize();
      const entrySize = JSON.stringify(entry).length;
      
      if (currentSize + entrySize > this.MAX_LOCALSTORAGE_SIZE) {
        this.cleanupLocalStorage();
      }
      
      localStorage.setItem(`cache_${key}`, JSON.stringify(entry));
    } catch (error) {
      console.warn('localStorage 저장 실패:', error);
    }
  }
  
  private getLocalStorageSize(): number {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache_')) {
        size += localStorage.getItem(key)?.length || 0;
      }
    }
    return size;
  }
  
  private cleanupLocalStorage(): void {
    // 만료된 항목 제거
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cache_')) {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || '{}') as CacheEntry;
          if (this.isExpired(entry)) {
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
  
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() >= entry.expiresAt;
  }
}
```

**Phase 2 확장 구조** (필요 시 추가):

```typescript
// Phase 2에서 IndexedDB 추가 시
class CacheManager {
  // ... Phase 1 코드 ...
  
  // 3단계: IndexedDB (Phase 2에서 추가)
  private db: IDBDatabase | null = null;
  
  async get<T>(key: string): Promise<T | null> {
    // 1. 메모리 캐시 확인
    // 2. localStorage 확인
    // 3. IndexedDB 확인 (Phase 2에서 추가)
    const indexedDBEntry = await this.getFromIndexedDB(key);
    if (indexedDBEntry && !this.isExpired(indexedDBEntry)) {
      this.memoryCache.set(key, indexedDBEntry);
      if (this.isSmallData(indexedDBEntry)) {
        this.saveToLocalStorage(key, indexedDBEntry);
      }
      return indexedDBEntry.data as T;
    }
    
    return null;
  }
}
```

### 2. 캐시 구조 설계

```typescript
interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
  version: number; // 데이터 구조 변경 시 버전 관리
}

interface CacheConfig {
  maxAge: number; // 캐시 유효 기간 (밀리초)
  staleWhileRevalidate: boolean; // 만료 후에도 캐시 사용하면서 백그라운드 갱신
  revalidateInterval: number; // 백그라운드 갱신 주기
}
```

### 3. 캐시 키 전략

**패턴**: `{category}:{action}:{paramsHash}`

예시:
- `users:getAllUsers:{}`
- `documents:getDocuments:{"role":"shared","page":1}`
- `workflow:getMyPendingWorkflows:{"userEmail":"user@example.com"}`
- `accounting:getLedgerEntries:{"spreadsheetId":"xxx","accountId":"yyy"}`

### 4. 캐시 만료 전략

**데이터 유형별 만료 시간** (주기적 갱신 주기와 일치):
- **자주 변경되는 데이터** (워크플로우 상태, 장부 항목): 3-5분
- **중간 빈도 데이터** (문서 목록, 공지사항): 10분
- **드물게 변경되는 데이터** (사용자 목록, 템플릿 목록): 1시간
- **거의 변경 안 되는 데이터** (스프레드시트 ID, 태그 목록): 2시간

**캐시 만료 시간 설정** (실제 구현 값):
```typescript
// src/utils/cache/cacheUtils.ts
const CACHE_TTL: Record<string, number> = {
  // 자주 변경되는 데이터 (중요도 높음)
  'getMyPendingWorkflows': 3 * 60 * 1000,      // 3분
  'getMyRequestedWorkflows': 3 * 60 * 1000,    // 3분
  'getCompletedWorkflows': 3 * 60 * 1000,      // 3분
  'getWorkflowStatus': 3 * 60 * 1000,          // 3분
  'getWorkflowHistory': 3 * 60 * 1000,         // 3분
  
  'getLedgerEntries': 5 * 60 * 1000,           // 5분
  'getAccounts': 5 * 60 * 1000,                // 5분
  'getAccountingCategorySummary': 5 * 60 * 1000, // 5분
  'getPendingBudgetPlans': 5 * 60 * 1000,      // 5분
  
  // 중간 빈도 데이터
  'getDocuments': 10 * 60 * 1000,              // 10분
  'getAllDocuments': 10 * 60 * 1000,          // 10분
  'getAnnouncements': 10 * 60 * 1000,           // 10분
  'fetchAnnouncements': 10 * 60 * 1000,        // 10분
  'fetchCalendarEvents': 15 * 60 * 1000,       // 15분
  'fetchStudentIssues': 10 * 60 * 1000,        // 10분
  
  // 드물게 변경되는 데이터 (토큰 만료 시간 고려하여 30분으로 제한)
  'getAllUsers': 30 * 60 * 1000,               // 30분
  'getPendingUsers': 30 * 60 * 1000,           // 30분
  'getTemplates': 30 * 60 * 1000,               // 30분
  'getSharedTemplates': 30 * 60 * 1000,        // 30분
  'getStaticTags': 30 * 60 * 1000,             // 30분
  'getWorkflowTemplates': 30 * 60 * 1000,      // 30분
  'fetchStudents': 30 * 60 * 1000,             // 30분
  'fetchStaff': 30 * 60 * 1000,                // 30분
  'fetchAttendees': 30 * 60 * 1000,            // 30분
  'fetchStaffFromPapyrus': 30 * 60 * 1000,    // 30분
  'fetchCommitteeFromPapyrus': 30 * 60 * 1000, // 30분
  
  // 거의 변경 안 되는 데이터 (토큰 만료 시간 고려하여 45분으로 제한)
  'getSpreadsheetIds': 45 * 60 * 1000,         // 45분
  'getAccountingFolderId': 45 * 60 * 1000,     // 45분
  'getAccountingCategories': 45 * 60 * 1000,    // 45분
  'getLedgerList': 45 * 60 * 1000,             // 45분
};
```

**Stale-While-Revalidate 전략**:
- 캐시가 만료되어도 즉시 캐시 데이터 반환
- 백그라운드에서 새 데이터 페칭
- 새 데이터 수신 시 캐시 업데이트 및 UI 갱신

---

## 🏗️ 구현 계획

### 1. 캐시 매니저 생성

**파일**: `src/utils/cache/cacheManager.ts`

**기능**:
- IndexedDB 초기화 및 관리
- 메모리 캐시 관리
- 캐시 읽기/쓰기/삭제
- 캐시 만료 관리
- 백그라운드 갱신 스케줄링

### 2. 데이터 동기화 서비스

**파일**: `src/services/dataSyncService.ts`

**기능**:
- 로그인 시 전체 데이터 초기 로딩
- 주기적 백그라운드 동기화
- 수동 갱신 (새로고침 버튼 클릭 시)
- 쓰기 작업 후 자동 갱신
- 병렬 데이터 페칭
- 로딩 진행률 추적
- 마지막 갱신 시간 관리
- 에러 처리

**주요 메서드**:
```typescript
class DataSyncService {
  // 초기 로딩
  async initializeData(user: User): Promise<void>
  
  // 수동 갱신 (새로고침 버튼)
  async refreshAllData(): Promise<void>
  
  // 선택적 갱신 (특정 카테고리만)
  async refreshCategory(category: string): Promise<void>
  
  // 쓰기 작업 후 관련 데이터 갱신
  async invalidateAndRefresh(cacheKeys: string[]): Promise<void>
  
  // 마지막 갱신 시간 조회
  getLastSyncTime(): Date | null
  
  // 주기적 갱신 시작/중지
  startPeriodicSync(interval: number): void
  stopPeriodicSync(): void
}
``` 및 재시도

### 3. API 클라이언트 수정

**파일**: `src/utils/api/apiClient.ts`

**변경 사항**:
- 캐시 매니저 통합
- DataSyncService 주입 메서드 추가
- 읽기 전용 API 호출 시 캐시 우선 확인
- 캐시 미스 시 API 호출 후 캐시 저장
- **쓰기 작업 자동 감지 및 캐시 무효화** (핵심 기능)
  - `request()` 메서드 내부에서 쓰기 작업 자동 감지
  - 성공 시 관련 캐시 키 자동 무효화
  - 액션별 캐시 키 매핑 테이블 구현
  - 비동기 처리로 응답 지연 최소화

### 4. 로딩 UI 컴포넌트

**파일**: `src/components/ui/LoadingProgress.tsx`

**기능**:
- 전체 로딩 진행률 표시
- 단계별 로딩 상태 표시
- 로그인 시 전체 화면 로딩 오버레이
- 백그라운드 동기화 시 토스트 알림

### 5. Hook 수정

**변경 대상**:
- `useAppState.ts`: 로그인 시 데이터 동기화 서비스 호출
- 각 페이지의 데이터 페칭 로직: 캐시 우선 조회로 변경

---

## 🎨 UI 컴포넌트 설계

### 1. DataSyncStatus 컴포넌트

**위치**: `src/components/ui/DataSyncStatus.tsx`

**배치**: 대시보드 상단, 검색창 왼쪽

**구성 요소**:
```
[마지막 갱신: 2025-01-15 14:30:25] [🔄 새로고침]
```

**기능**:
- 마지막 갱신 시간 표시
  - 절대 시간: "YYYY-MM-DD HH:mm:ss"
  - 상대 시간: "2분 전", "방금 전" (선택사항)
  - 실시간 업데이트 (1초마다 상대 시간 갱신)
- 새로고침 버튼
  - 아이콘: 회전하는 새로고침 아이콘 (Material Icons 또는 React Icons)
  - 클릭 시 전체 데이터 갱신
  - 갱신 중: 버튼에 로딩 스피너 표시
  - 갱신 완료: 토스트 알림 표시
  - 갱신 실패: 에러 메시지 표시

**Props**:
```typescript
interface DataSyncStatusProps {
  lastSyncTime: Date | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  refreshError: string | null;
}
```

**스타일**:
- 검색창과 같은 높이
- 간격: 검색창과 16px 간격
- 폰트 크기: 12-14px
- 색상: 회색 텍스트, 호버 시 진한 회색

### 2. 통합 위치

**대시보드** (`Dashboard.tsx`):
```tsx
<div className="dashboard-header">
  <DataSyncStatus 
    lastSyncTime={lastSyncTime}
    onRefresh={handleRefresh}
    isRefreshing={isRefreshing}
    refreshError={refreshError}
  />
  <SearchBar />
</div>
```

**기타 페이지** (선택사항):
- 각 페이지 헤더에 동일한 컴포넌트 추가 가능
- 또는 전역 헤더에 배치하여 모든 페이지에서 접근 가능

---

## 🔄 갱신 트리거 전략

### 1. 자동 갱신 (주기적)

**트리거**: 시간 기반
- 데이터 유형별 다른 주기
- 앱 포커스 시 즉시 갱신
- 백그라운드에서 조용히 실행

**주기 설정 (스마트 갱신 전략 - 페이지 활성 시에만 갱신)**:

```typescript
// Google OAuth Access Token 만료 시간: 약 1시간 (3600초)
// 토큰 만료 5분 전까지는 안전하게 사용 가능 (약 55분)
// 따라서 최대 갱신 주기는 50분 이내로 제한

// ⭐ 스마트 갱신: 페이지 활성 시에만 갱신하여 불필요한 API 호출 최소화
// - 앱이 비활성화되어 있으면 갱신 중단
// - 현재 페이지에서 사용하지 않는 카테고리는 갱신 스킵
// - 페이지 전환 시 해당 페이지의 카테고리만 즉시 갱신

const SYNC_INTERVALS = {
  // 자주 변경되는 데이터 (중요도 높음) - 페이지 활성 시에만
  'workflow': 2 * 60 * 1000,        // 2분 (스마트 갱신: workflow 페이지에서만)
  'accounting': 5 * 60 * 1000,     // 5분 (스마트 갱신: accounting 페이지에서만)
  
  // 중간 빈도 데이터 - 페이지 활성 시에만
  'announcements': 10 * 60 * 1000,  // 10분 (스마트 갱신: announcements/dashboard 페이지에서만)
  'documents': 10 * 60 * 1000,      // 10분 (스마트 갱신: documents 페이지에서만)
  'calendar': 10 * 60 * 1000,       // 10분 (스마트 갱신: calendar/dashboard 페이지에서만)
  
  // 드물게 변경되는 데이터 (토큰 만료 시간 고려) - 항상 갱신
  'users': 20 * 60 * 1000,          // 20분 (관리자용, 항상 갱신)
  'templates': 20 * 60 * 1000,      // 20분 (스마트 갱신: documents 페이지에서만)
  'students': 20 * 60 * 1000,      // 20분 (스마트 갱신: students 페이지에서만)
  'staff': 20 * 60 * 1000,          // 20분 (스마트 갱신: staff 페이지에서만)
  'spreadsheetIds': 30 * 60 * 1000, // 30분 (시스템 데이터, 항상 갱신)
};
```

**갱신 주기 요약 테이블**:

| 카테고리 | 갱신 주기 | 갱신 방식 | 활성 페이지 | 중요도 | 변경 빈도 |
|---------|----------|----------|------------|--------|----------|
| `workflow` | **2분** | 스마트 갱신 | `workflow`, `dashboard` | 높음 | 매우 자주 |
| `accounting` | **5분** | 스마트 갱신 | `accounting` | 높음 | 자주 |
| `announcements` | **10분** | 스마트 갱신 | `announcements`, `dashboard` | 중간 | 중간 |
| `documents` | **10분** | 스마트 갱신 | `documents` | 중간 | 중간 |
| `calendar` | **10분** | 스마트 갱신 | `calendar`, `dashboard` | 중간 | 중간 |
| `users` | **20분** | 항상 갱신 | 모든 페이지 | 낮음 | 드묾 |
| `templates` | **20분** | 스마트 갱신 | `documents` | 낮음 | 드묾 |
| `students` | **20분** | 스마트 갱신 | `students` | 낮음 | 드묾 |
| `staff` | **20분** | 스마트 갱신 | `staff` | 낮음 | 드묾 |
| `spreadsheetIds` | **30분** | 항상 갱신 | 모든 페이지 | 낮음 | 매우 드묾 |

**스마트 갱신 동작 방식**:
- **스마트 갱신**: 해당 페이지에 있을 때만 갱신 (앱 비활성 시 중단)
- **항상 갱신**: 페이지와 관계없이 주기적으로 갱신 (시스템 데이터, 관리자용)

**주기 조정 이유**:

1. **429 에러 방지**:
   - Google Apps Script: 분당 약 20-30회 제한
   - Google Sheets API: 분당 60회, 일일 300회 제한
   - 현재 프로젝트에서 429 에러가 자주 발생하는 것을 확인
   - 주기를 늘려 API 호출 빈도 감소

2. **동시 사용자 고려**:
   - 사용자 10명 기준: 각각 1분마다 호출 시 분당 10회
   - 사용자 30명 기준: 각각 1분마다 호출 시 분당 30회 (제한 근접)
   - 3분 주기로 변경 시: 30명 기준 분당 10회 (안전)

3. **액세스 토큰 만료 시간 고려** (중요):
   - Google OAuth Access Token: **약 1시간(3600초) 유효**
   - 토큰 만료 1분 전에 만료로 간주 (`tokenManager`에서 처리)
   - **안전한 사용 시간: 약 55분**
   - **최대 갱신 주기: 50분 이내** (토큰 만료 전 안전하게 갱신)
   - 토큰 만료 시 API 호출 실패 → 재로그인 필요
   - 따라서 1시간 이상의 주기는 토큰 만료 전에 갱신 불가능

4. **데이터 변경 빈도 고려**:
   - **워크플로우**: 결재 승인/반려는 실시간성이 중요하지만, 3분 지연은 허용 가능
   - **회계**: 장부 항목 추가는 자주 발생하지 않으므로 5분 주기 적절
   - **공지사항/문서**: 하루에 몇 번 변경되므로 10분 주기 충분
   - **사용자/템플릿**: 거의 변경되지 않지만, 토큰 만료 고려하여 30분 주기로 설정

5. **네트워크 및 배터리 최적화**:
   - 모바일 환경에서 배터리 소모 감소
   - 네트워크 트래픽 감소

**스마트 갱신 전략** (✅ 구현 완료):

```typescript
// ✅ 구현 완료: 사용자가 해당 페이지에 있을 때만 갱신
// - 앱 포커스/블러 감지 (window focus/blur, visibilitychange)
// - 페이지별 카테고리 매핑
// - 중복 갱신 방지 (마지막 갱신 시간 추적)

const PAGE_CATEGORY_MAP = {
  'dashboard': ['announcements', 'calendar', 'workflow'],
  'workflow': ['workflow'],
  'accounting': ['accounting'],
  'announcements': ['announcements'],
  'documents': ['documents', 'templates'],
  'students': ['students'],
  'staff': ['staff'],
  'calendar': ['calendar'],
};

// 동작 방식:
// 1. 앱이 비활성화되어 있으면 모든 갱신 중단
// 2. 현재 페이지에서 사용하지 않는 카테고리는 갱신 스킵
// 3. 페이지 전환 시 해당 페이지의 카테고리만 즉시 갱신
// 4. 앱 포커스 시 현재 페이지의 카테고리만 즉시 갱신
// 5. 중복 갱신 방지 (80% 이상 경과해야 갱신)

// 예상 효과:
// - API 호출 수: 70-90% 감소 (페이지 비활성 시 갱신 중단)
// - 배터리 소모: 크게 감소 (백그라운드 갱신 최소화)
// - 429 에러: 거의 발생하지 않음 (불필요한 갱신 제거)
```

**동적 주기 조정**:

```typescript
// 429 에러 및 토큰 만료 고려한 동적 주기 조정
class DataSyncService {
  private syncIntervals = { ...SYNC_INTERVALS };
  private errorCounts: Record<string, number> = {};
  private readonly MAX_INTERVAL = 50 * 60 * 1000; // 토큰 만료 고려 최대 주기: 50분
  
  private adjustIntervalOnError(category: string, error: Error) {
    this.errorCounts[category] = (this.errorCounts[category] || 0) + 1;
    
    // 429 에러가 3회 이상 발생하면 주기 2배로 연장 (단, 최대 50분 이내)
    if (this.errorCounts[category] >= 3) {
      const newInterval = Math.min(
        this.syncIntervals[category] * 2,
        this.MAX_INTERVAL // 토큰 만료 시간 고려
      );
      this.syncIntervals[category] = newInterval;
      console.warn(`⚠️ ${category} 갱신 주기를 ${newInterval / 60000}분으로 연장합니다.`);
      this.errorCounts[category] = 0; // 리셋
    }
  }
  
  // 성공 시 주기 점진적 복구
  private adjustIntervalOnSuccess(category: string) {
    if (this.errorCounts[category] > 0) {
      this.errorCounts[category] = Math.max(0, this.errorCounts[category] - 1);
    }
  }
  
  // 토큰 만료 체크 및 갱신 중단
  private shouldSkipSync(category: string): boolean {
    const { tokenManager } = require('../utils/auth/tokenManager');
    
    // 토큰이 없거나 만료되었으면 갱신 중단
    if (!tokenManager.isValid()) {
      console.warn(`⚠️ 토큰이 만료되어 ${category} 갱신을 건너뜁니다.`);
      return true;
    }
    
    // 토큰이 곧 만료되면(5분 이내) 갱신 중단 (재로그인 유도)
    if (tokenManager.isExpiringSoon()) {
      console.warn(`⚠️ 토큰이 곧 만료되어 ${category} 갱신을 건너뜁니다. 재로그인이 필요할 수 있습니다.`);
      return true;
    }
    
    return false;
  }
}
```

**권장 설정 (사용자 수별 - 토큰 만료 시간 고려)**:

```typescript
// 사용자 수에 따른 주기 조정 (최대 50분 이내로 제한)
const getSyncIntervalsByUserCount = (userCount: number) => {
  const MAX_INTERVAL = 50 * 60 * 1000; // 토큰 만료 고려 최대 주기: 50분
  
  if (userCount <= 10) {
    // 소규모: 더 자주 갱신 가능
    return {
      'workflow': 2 * 60 * 1000,      // 2분
      'accounting': 3 * 60 * 1000,    // 3분
      'announcements': 5 * 60 * 1000, // 5분
      'users': 30 * 60 * 1000,        // 30분 (토큰 만료 고려)
      'templates': 30 * 60 * 1000,     // 30분
      'spreadsheetIds': 45 * 60 * 1000, // 45분 (토큰 만료 고려)
      // ...
    };
  } else if (userCount <= 30) {
    // 중규모: 권장값 사용
    return SYNC_INTERVALS;
  } else {
    // 대규모: 주기 더 연장 (단, 최대 50분 이내)
    return {
      'workflow': 5 * 60 * 1000,      // 5분
      'accounting': 10 * 60 * 1000,   // 10분
      'announcements': 15 * 60 * 1000, // 15분
      'users': Math.min(45 * 60 * 1000, MAX_INTERVAL), // 45분 (토큰 만료 고려)
      'templates': Math.min(45 * 60 * 1000, MAX_INTERVAL), // 45분
      'spreadsheetIds': MAX_INTERVAL,  // 50분 (최대값)
      // ...
    };
  }
};
```

**토큰 만료 시 처리 전략**:

```typescript
// DataSyncService에서 토큰 만료 체크
class DataSyncService {
  async syncCategory(category: string) {
    // 1. 토큰 유효성 확인
    const { tokenManager } = require('../utils/auth/tokenManager');
    
    if (!tokenManager.isValid()) {
      console.warn(`⚠️ 토큰이 만료되어 ${category} 갱신을 건너뜁니다.`);
      // 토스트 알림: "세션이 만료되었습니다. 다시 로그인해주세요."
      return;
    }
    
    // 2. 토큰이 곧 만료되면(5분 이내) 경고
    if (tokenManager.isExpiringSoon()) {
      console.warn(`⚠️ 토큰이 곧 만료됩니다. (${Math.round(tokenManager.getTimeUntilExpiry() / 60000)}분 남음)`);
      // 토스트 알림: "세션이 곧 만료됩니다. 작업을 저장해주세요."
    }
    
    // 3. 정상 갱신 진행
    // ...
  }
}
```

### 2. 수동 갱신 (새로고침 버튼)

**트리거**: 사용자 클릭
- 모든 캐시 무효화
- 전체 데이터 재페칭
- 진행률 표시
- 완료 시 마지막 갱신 시간 업데이트

**구현**:
```typescript
const handleRefresh = async () => {
  setIsRefreshing(true);
  setRefreshError(null);
  try {
    await dataSyncService.refreshAllData();
    setLastSyncTime(new Date());
    showToast('데이터가 갱신되었습니다.');
  } catch (error) {
    setRefreshError('갱신 중 오류가 발생했습니다.');
    showToast('갱신 실패', 'error');
  } finally {
    setIsRefreshing(false);
  }
};
```

### 3. 쓰기 작업 후 자동 갱신

**트리거**: 데이터 저장/수정/삭제

**적용 대상 및 동작**:

#### 문서 관리
- `createDocument()` → 문서 목록 캐시 무효화 → 문서 목록 갱신
- `deleteDocuments()` → 문서 목록 캐시 무효화 → 문서 목록 갱신
- `updateSharedTemplateMeta()` → 템플릿 목록 캐시 무효화 → 템플릿 목록 갱신

#### 워크플로우
- `requestWorkflow()` → 내가 올린 결재 목록 캐시 무효화 → 목록 갱신
- `approveReview()`, `rejectReview()`, `holdReview()` → 내 담당 워크플로우 캐시 무효화 → 목록 갱신
- `approvePayment()`, `rejectPayment()`, `holdPayment()` → 내 담당 워크플로우 캐시 무효화 → 목록 갱신
- `createWorkflowTemplate()`, `updateWorkflowTemplate()`, `deleteWorkflowTemplate()` → 워크플로우 템플릿 목록 캐시 무효화 → 목록 갱신

#### 회계
- `createLedgerEntry()` → 장부 항목 캐시 무효화 → 장부 항목 갱신
- `updateLedgerEntry()` → 장부 항목 캐시 무효화 → 장부 항목 갱신
- `deleteLedgerEntry()` → 장부 항목 캐시 무효화 → 장부 항목 갱신
- `createCategory()`, `updateCategory()`, `deleteCategory()` → 카테고리 캐시 무효화 → 카테고리 갱신
- `createBudgetPlan()`, `reviewBudgetPlan()`, `approveBudgetPlan()` 등 → 예산 계획 캐시 무효화 → 예산 계획 갱신

#### 공지사항
- `addAnnouncement()` → 공지사항 목록 캐시 무효화 → 공지사항 목록 갱신
- `updateAnnouncement()` → 공지사항 목록 캐시 무효화 → 공지사항 목록 갱신
- `deleteAnnouncement()` → 공지사항 목록 캐시 무효화 → 공지사항 목록 갱신

#### 학생/교직원 관리
- `addStaff()`, `updateStaff()`, `deleteStaff()` → 교직원 목록 캐시 무효화 → 교직원 목록 갱신
- `deleteStudent()` → 학생 목록 캐시 무효화 → 학생 목록 갱신
- `addStudentIssue()` → 학생 이슈 캐시 무효화 → 학생 이슈 갱신

#### 캘린더
- `addCalendarEvent()` → 캘린더 이벤트 캐시 무효화 → 캘린더 이벤트 갱신
- `updateCalendarEvent()` → 캘린더 이벤트 캐시 무효화 → 캘린더 이벤트 갱신
- `deleteCalendarEvent()` → 캘린더 이벤트 캐시 무효화 → 캘린더 이벤트 갱신

**구현 방식: API 클라이언트 자동 캐시 무효화 (옵션 3 - 채택)**

**핵심 아이디어**: `apiClient.request()` 메서드 내부에서 쓰기 작업을 자동 감지하고 관련 캐시를 무효화

**구현 구조**:

```typescript
// apiClient.ts
class ApiClient {
  private dataSyncService: DataSyncService | null = null;
  
  // DataSyncService 주입 (초기화 시)
  setDataSyncService(service: DataSyncService) {
    this.dataSyncService = service;
  }
  
  // 공통 API 호출 메서드 (기존 메서드 수정)
  async request<T = unknown>(
    action: string,
    data: Record<string, unknown> = {},
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // ... 기존 요청 로직 ...
    
    const result = await response.json();
    
    // 쓰기 작업 성공 시 자동으로 캐시 무효화
    if (result.success && this.isWriteAction(action)) {
      const cacheKeys = this.getCacheKeysToInvalidate(action, data);
      if (cacheKeys.length > 0 && this.dataSyncService) {
        // 비동기로 처리하여 응답 지연 최소화
        this.dataSyncService.invalidateAndRefresh(cacheKeys).catch(err => {
          console.warn('캐시 무효화 실패:', err);
        });
      }
    }
    
    return result as ApiResponse<T>;
  }
  
  // 쓰기 작업 여부 판단
  private isWriteAction(action: string): boolean {
    const writeActions = [
      // 문서 관리
      'createDocument', 'deleteDocuments',
      'uploadSharedTemplate', 'updateSharedTemplateMeta', 'deleteSharedTemplate',
      'addStaticTag', 'updateStaticTag', 'deleteStaticTag',
      
      // 워크플로우
      'requestWorkflow', 'setWorkflowLine', 'grantWorkflowPermissions',
      'approveReview', 'rejectReview', 'holdReview',
      'approvePayment', 'rejectPayment', 'holdPayment',
      'resubmitWorkflow',
      'createWorkflowTemplate', 'updateWorkflowTemplate', 'deleteWorkflowTemplate',
      
      // 회계
      'createLedger', 'updateAccountSubManagers',
      
      // 사용자 관리
      'approveUserWithGroup', 'rejectUser', 'addUsersToSpreadsheet',
      'requestPinnedAnnouncementApproval',
      
      // 기타
      'migrateEmails', 'clearUserCache',
    ];
    return writeActions.includes(action);
  }
  
  // 액션별 무효화할 캐시 키 매핑
  private getCacheKeysToInvalidate(action: string, data: any): string[] {
    const cacheKeyMap: Record<string, (data: any) => string[]> = {
      // 문서 관리
      'createDocument': () => ['documents:getDocuments:*'],
      'deleteDocuments': () => ['documents:getDocuments:*'],
      'uploadSharedTemplate': () => ['templates:getTemplates:*', 'templates:getSharedTemplates:*'],
      'updateSharedTemplateMeta': () => ['templates:getSharedTemplates:*'],
      'deleteSharedTemplate': () => ['templates:getSharedTemplates:*'],
      'addStaticTag': () => ['tags:getStaticTags:*'],
      'updateStaticTag': () => ['tags:getStaticTags:*', 'templates:getSharedTemplates:*'],
      'deleteStaticTag': () => ['tags:getStaticTags:*', 'templates:getSharedTemplates:*'],
      
      // 워크플로우
      'requestWorkflow': (d) => [
        'workflow:getMyRequestedWorkflows:*',
        `workflow:getMyRequestedWorkflows:{"userEmail":"${d.requesterEmail || ''}"}`
      ],
      'approveReview': (d) => [
        'workflow:getMyPendingWorkflows:*',
        'workflow:getMyRequestedWorkflows:*',
        `workflow:getMyPendingWorkflows:{"userEmail":"${d.userEmail || ''}"}`
      ],
      'rejectReview': (d) => [
        'workflow:getMyPendingWorkflows:*',
        'workflow:getMyRequestedWorkflows:*',
        `workflow:getMyPendingWorkflows:{"userEmail":"${d.userEmail || ''}"}`
      ],
      'holdReview': (d) => [
        'workflow:getMyPendingWorkflows:*',
        `workflow:getMyPendingWorkflows:{"userEmail":"${d.userEmail || ''}"}`
      ],
      'approvePayment': (d) => [
        'workflow:getMyPendingWorkflows:*',
        'workflow:getMyRequestedWorkflows:*',
        'workflow:getCompletedWorkflows:*',
        `workflow:getMyPendingWorkflows:{"userEmail":"${d.userEmail || ''}"}`
      ],
      'rejectPayment': (d) => [
        'workflow:getMyPendingWorkflows:*',
        'workflow:getMyRequestedWorkflows:*',
        `workflow:getMyPendingWorkflows:{"userEmail":"${d.userEmail || ''}"}`
      ],
      'holdPayment': (d) => [
        'workflow:getMyPendingWorkflows:*',
        `workflow:getMyPendingWorkflows:{"userEmail":"${d.userEmail || ''}"}`
      ],
      'resubmitWorkflow': (d) => [
        'workflow:getMyRequestedWorkflows:*',
        `workflow:getMyRequestedWorkflows:{"userEmail":"${d.userEmail || ''}"}`
      ],
      'createWorkflowTemplate': () => ['workflow:getWorkflowTemplates:*'],
      'updateWorkflowTemplate': () => ['workflow:getWorkflowTemplates:*'],
      'deleteWorkflowTemplate': () => ['workflow:getWorkflowTemplates:*'],
      
      // 회계
      'createLedger': () => ['accounting:getLedgerList:*'],
      'updateAccountSubManagers': () => ['accounting:getLedgerList:*'],
      
      // 사용자 관리
      'approveUserWithGroup': () => ['users:getAllUsers:*', 'users:getPendingUsers:*'],
      'rejectUser': () => ['users:getPendingUsers:*'],
      'addUsersToSpreadsheet': () => ['users:getAllUsers:*'],
      'requestPinnedAnnouncementApproval': () => ['announcements:fetchAnnouncements:*'],
    };
    
    const getKeys = cacheKeyMap[action];
    return getKeys ? getKeys(data) : [];
  }
}
```

**Manager 함수에서의 처리**:

Manager 함수들(`accountingManager.ts`, `papyrusManager.ts` 등)에서도 `apiClient`를 사용하므로 자동으로 캐시 무효화가 적용됩니다:

```typescript
// accountingManager.ts
export const createLedgerEntry = async (...) => {
  // ... 기존 로직 ...
  
  // apiClient를 사용하지 않고 직접 Google Sheets API를 호출하는 경우
  // 별도로 캐시 무효화 필요
  if (dataSyncService) {
    await dataSyncService.invalidateAndRefresh([
      `accounting:getLedgerEntries:{"spreadsheetId":"${spreadsheetId}","accountId":"${accountId}"}`,
      `accounting:getAccounts:{"spreadsheetId":"${spreadsheetId}"}`
    ]);
  }
  
  return entry;
};
```

**papyrusManager.ts의 경우**:
- `apiClient.request('getAnnouncements', ...)` 같은 호출은 자동 처리됨
- 직접 Google Sheets API를 호출하는 경우(`getSheetData`, `append`, `update` 등)는 수동 무효화 필요

**장점**:
1. ✅ **자동 처리**: 모든 쓰기 작업에서 자동으로 캐시 무효화
2. ✅ **실수 방지**: 개발자가 수동으로 호출할 필요 없음
3. ✅ **일관성**: 모든 API 호출이 동일한 패턴으로 처리
4. ✅ **하위 호환성**: 기존 코드 변경 최소화
5. ✅ **Manager 함수 지원**: React 훅 없이도 사용 가능
6. ✅ **비동기 처리**: 응답 지연 최소화 (캐시 무효화는 백그라운드에서)

**초기화**:
```typescript
// useAppState.ts 또는 App.tsx
useEffect(() => {
  const dataSyncService = new DataSyncService();
  apiClient.setDataSyncService(dataSyncService);
}, []);
```

### 4. 캐시 무효화 전략

**관련 캐시 키 패턴**:
- 특정 키: `documents:getDocuments:{"role":"shared"}`
- 와일드카드: `documents:getDocuments:*` (모든 문서 목록 캐시 무효화)
- 카테고리 전체: `documents:*` (문서 관련 모든 캐시 무효화)

**무효화 후 갱신**:
- 즉시 무효화 (캐시에서 제거)
- 백그라운드에서 새 데이터 페칭
- UI는 낙관적 업데이트 (즉시 반영, 백그라운드에서 검증)

---

## 🛠️ 기술 스택

### Phase 1 (우선 구현)

**캐시 저장소**:
- ✅ **추가 라이브러리 불필요**
- ✅ 네이티브 `Map` (메모리 캐시)
- ✅ 네이티브 `localStorage` (영구 저장)

**병렬 처리**:
- 네이티브 `Promise.all()` 또는 `Promise.allSettled()`
- 필요 시 `p-limit`로 동시 요청 수 제한

**상태 관리**:
- React Context API (캐시 상태 관리)
- 또는 Zustand (경량 상태 관리)

### Phase 2 (선택사항, 필요 시)

**IndexedDB 래퍼**:
- **idb** (권장): 간단하고 타입스크립트 지원, 가벼움
- 또는 **Dexie.js**: 더 강력한 기능, 학습 곡선 높음

---

## 📝 단계별 구현

### Phase 1: 캐시 인프라 구축 ⭐ ✅ (구현 완료)

1. **메모리 캐시 구현** ✅
   - `Map` 기반 메모리 캐시
   - LRU (Least Recently Used) 캐시 관리
   - 최대 캐시 크기 제한 (100개 항목)
   - 만료 시간 관리
   - **구현 위치**: `src/utils/cache/cacheManager.ts`

2. **localStorage 통합** ✅
   - 작은 데이터만 localStorage에 저장 (100KB 이하)
   - 데이터 크기 체크
   - localStorage 용량 모니터링 (5MB 제한)
   - 만료된 데이터 자동 정리
   - **구현 위치**: `src/utils/cache/cacheManager.ts`

3. **캐시 매니저 구현** ✅
   - `CacheManager` 클래스 생성
   - 메모리 캐시 + localStorage 통합
   - 캐시 키 관리 (`{category}:{action}:{paramsHash}`)
   - 만료 시간 관리
   - 2단계 조회: 메모리 → localStorage → API
   - 와일드카드 패턴 지원
   - 싱글톤 패턴
   - **구현 위치**: `src/utils/cache/cacheManager.ts`

4. **캐시 유틸리티** ✅
   - 캐시 키 생성 함수 (`generateCacheKey`)
   - TTL 설정 (`CACHE_TTL`)
   - 액션별 카테고리 매핑 (`ACTION_CATEGORY_MAP`)
   - 캐시 가능한 액션 목록 (`CACHEABLE_ACTIONS`)
   - **구현 위치**: `src/utils/cache/cacheUtils.ts`

### Phase 1.5: IndexedDB 추가 (선택사항, 필요 시)

1. **IndexedDB 설정**
   - `idb` 라이브러리 설치
   - 데이터베이스 스키마 정의
   - 기본 CRUD 함수 구현

2. **3단계 캐시 계층 완성**
   - 메모리 캐시 (1단계) - 기존 유지
   - localStorage (2단계) - 기존 유지
   - IndexedDB (3단계) - 새로 추가
   - 조회 순서: 메모리 → localStorage → IndexedDB → API

3. **대용량 데이터 지원**
   - 큰 데이터는 IndexedDB에만 저장
   - 작은 데이터는 localStorage에도 저장
   - 메모리 캐시는 최근 사용한 데이터만 유지

### Phase 2: API 클라이언트 통합 ✅ (구현 완료)

1. **apiClient 수정** ✅
   - 캐시 매니저 통합
   - 읽기 전용 액션 식별 및 캐시 적용
   - 캐시 우선 조회 로직 추가
   - 쓰기 작업 시 캐시 무효화
   - DataSyncService 주입 메서드 (`setDataSyncService()`)
   - 쓰기 작업 자동 감지 (`isWriteAction()`)
   - 액션별 캐시 키 매핑 (`getCacheKeysToInvalidate()`)
   - **구현 위치**: `src/utils/api/apiClient.ts`

2. **캐시 가능한 액션 목록 정의** ✅
   - **구현 위치**: `src/utils/cache/cacheUtils.ts`
   - `CACHEABLE_ACTIONS` 배열에 모든 읽기 전용 액션 정의 완료
   - 사용자 관리, 문서 관리, 워크플로우, 회계, 공지사항, 캘린더, 학생/교직원 등 포함

3. **캐시 만료 시간 설정** ✅
   - **구현 위치**: `src/utils/cache/cacheUtils.ts`
   - `CACHE_TTL` 객체에 모든 액션별 TTL 설정 완료
   - 데이터 유형별 적절한 만료 시간 설정 (3분 ~ 45분)
   - 토큰 만료 시간(1시간) 고려하여 최대 45분으로 제한

### Phase 3: 데이터 동기화 서비스 ✅ (구현 완료)

1. **DataSyncService 구현** ✅
   - 초기 로딩 함수 (`initializeData()`)
   - 백그라운드 갱신 함수 (`refreshCategory()`)
   - 수동 갱신 함수 (`refreshAllData()`)
   - 선택적 갱신 함수 (`refreshCategory()`)
   - 쓰기 작업 후 자동 갱신 함수 (`invalidateAndRefresh()`)
   - 마지막 갱신 시간 관리 (`getLastSyncTime()`)
   - 진행률 추적 (`SyncProgressCallback`)
   - 에러 처리 및 토큰 만료 체크
   - **구현 위치**: `src/services/dataSyncService.ts`

2. **병렬 처리 최적화** ✅
   - 데이터 그룹별 병렬 페칭 (`Promise.allSettled()`)
   - 카테고리별 그룹화하여 병렬 처리
   - 에러 발생 시에도 계속 진행

3. **로딩 진행률 추적** ✅
   - 전체 작업 수 계산
   - 완료된 작업 수 추적
   - 진행률 콜백 (`SyncProgressCallback`)
   - 현재 작업 메시지 표시

4. **쓰기 작업 후 자동 갱신 통합** ✅
   - `apiClient.request()` 내부에서 자동 처리
   - 성공 시 관련 캐시 키 자동 무효화
   - 비동기 처리로 응답 지연 최소화
   - 액션별 캐시 키 매핑 테이블 구현 완료

### Phase 4: 로딩 UI 구현 ✅ (구현 완료)

1. **LoadingProgress 컴포넌트** ✅
   - 전체 화면 로딩 오버레이
   - 진행률 바
   - 단계별 상태 표시
   - 취소 버튼 (선택사항)
   - **구현 위치**: `src/components/ui/LoadingProgress.tsx`
   - **사용 위치**: `App.tsx` (로그인 시 초기 데이터 로딩 시 표시)

2. **데이터 갱신 상태 표시 UI** ✅
   - **위치**: 상단 검색창 왼쪽 (Header 컴포넌트)
   - **구현 위치**: `src/components/ui/DataSyncStatus.tsx`
   - **구성 요소**:
     - 마지막 갱신 시간 표시
       - 형식: 상대 시간 ("2분 전", "방금 전") + 절대 시간 (툴팁)
       - 실시간 업데이트 (1초마다 상대 시간 갱신)
       - 예: "2분 전" (마우스 오버 시 "2025-01-15 14:30:25" 표시)
     - 새로고침 버튼
       - 아이콘: 회전하는 새로고침 아이콘 (react-icons/fa)
       - 클릭 시 전체 데이터 수동 갱신
       - 갱신 중에는 로딩 스피너 표시
       - 갱신 완료 시 토스트 알림 및 성공 아이콘 표시
       - 에러 발생 시 에러 아이콘 표시

3. **useAppState 통합** ✅
   - 로그인 시 DataSyncService 호출 (`initializeData()`)
   - 로딩 상태 관리 (`isInitializingData`, `dataSyncProgress`)
   - 진행률 표시 (LoadingProgress 컴포넌트와 연동)
   - 마지막 갱신 시간 상태 관리 (`lastSyncTime`)
   - 수동 갱신 함수 (`handleRefreshAllData()`)
   - 페이지 변경 시 DataSyncService에 알림 (`setCurrentPage()`)

4. **백그라운드 동기화 알림** ✅
   - 토스트 알림 컴포넌트 (useNotification 훅 사용)
   - 수동 갱신 시작/완료 알림 (구현 완료)
   - 백그라운드 갱신은 콘솔 로그로만 표시 (사용자 방해 최소화)

### Phase 5: 페이지별 캐시 적용 ✅ (구현 완료)

1. **대시보드** ✅
   - 위젯 데이터 캐시 우선 조회 (apiClient 통합으로 자동 처리)
   - 캐시 미스 시 API 호출
   - **DataSyncStatus 컴포넌트 추가** ✅ (Header 컴포넌트에 통합 완료)

2. **문서 관리** ✅
   - 문서 목록 캐시 (자동 처리)
   - 템플릿 목록 캐시 (자동 처리)
   - 태그 목록 캐시 (자동 처리)
   - **자동 처리**: `apiClient.createDocument()`, `apiClient.deleteDocuments()` 등 호출 시 자동으로 관련 캐시 무효화 및 갱신

3. **워크플로우 관리** ✅
   - 워크플로우 목록 캐시 (자동 처리)
   - 템플릿 목록 캐시 (자동 처리)
   - **자동 처리**: `apiClient.requestWorkflow()`, `apiClient.approveReview()` 등 호출 시 자동으로 관련 캐시 무효화 및 갱신

4. **회계** ✅
   - 장부 목록 캐시 (자동 처리)
   - 장부 항목 캐시 (자동 처리)
   - 카테고리 캐시 (자동 처리)
   - **자동 처리**: `apiClient.createLedger()` 호출 시 자동 처리
   - **참고**: `accountingManager.createLedgerEntry()` 등 Manager 함수는 직접 Google Sheets API 호출하므로 수동 캐시 무효화 필요 (필요 시 추가 구현)

5. **기타 페이지** ✅
   - 학생 목록 캐시 (자동 처리)
   - 교직원 목록 캐시 (자동 처리)
   - 공지사항 캐시 (자동 처리)
   - 캘린더 이벤트 캐시 (자동 처리)
   - 각 페이지의 쓰기 작업 후 관련 캐시 무효화 및 갱신 (apiClient 통합으로 자동 처리)

### Phase 6: 백그라운드 동기화 ✅ (구현 완료)

1. **주기적 갱신** ✅
   - `setInterval` 사용
   - 데이터 유형별 다른 갱신 주기 (2분 ~ 30분)
   - 앱 포커스/블러 이벤트 감지 (`window.focus`, `visibilitychange`)
   - 스마트 갱신: 페이지 활성 시에만 갱신
   - 마지막 갱신 시간 업데이트
   - 토큰 만료 체크 및 중복 갱신 방지 (80% 이상 경과 시)
   - **구현 위치**: `DataSyncService.startPeriodicSync()`

2. **수동 갱신 (새로고침 버튼)** ✅
   - **트리거**: 사용자가 새로고침 버튼 클릭
   - **동작**:
     - 모든 캐시 무효화 (`cacheManager.clear()`)
     - 백그라운드에서 전체 데이터 재페칭
     - 진행률 표시 (LoadingProgress 컴포넌트)
     - 완료 시 마지막 갱신 시간 업데이트
   - **구현 위치**: `DataSyncService.refreshAllData()`
   - **UI 피드백**: 버튼 클릭 시 로딩 스피너, 완료 시 토스트 알림 ✅

3. **쓰기 작업 후 자동 갱신** ✅
   - **트리거**: 사용자가 데이터를 저장/수정/삭제할 때
   - **동작**:
     - 해당 데이터의 관련 캐시 무효화
     - 백그라운드에서 관련 데이터만 재페칭
     - 비동기 처리로 응답 지연 최소화
     - 백그라운드 갱신 완료 시 마지막 갱신 시간 업데이트
   - **적용 대상**:
     - 문서 생성/수정/삭제 ✅
     - 워크플로우 요청/승인/반려 ✅
     - 장부 항목 추가/수정/삭제 ✅
     - 공지사항 작성/수정/삭제 ✅
     - 학생/교직원 정보 수정 ✅
     - 기타 모든 쓰기 작업 ✅
   - **구현 위치**: `apiClient.request()` 내부에서 자동 처리 ✅

4. **스마트 갱신** ✅
   - 사용자가 해당 페이지에 있을 때만 갱신 ✅
   - 앱 포커스/블러 감지 ✅
   - 마지막 갱신 시간 기반 스마트 갱신 (80% 이상 경과해야 갱신) ✅
   - 페이지별 카테고리 매핑 (`PAGE_CATEGORY_MAP`)
   - 토큰 만료 체크 및 갱신 중단

### Phase 7: 최적화 및 테스트

1. **성능 최적화**
   - 캐시 히트율 모니터링
   - 불필요한 API 호출 제거
   - 메모리 사용량 최적화

2. **에러 처리**
   - 캐시 오류 시 API 폴백
   - 네트워크 오류 처리
   - 데이터 일관성 보장

3. **테스트**
   - 단위 테스트
   - 통합 테스트
   - 성능 테스트
   - 사용자 테스트

---

## 📊 예상 효과

### 성능 개선
- **초기 로딩 시간**: 50-70% 감소 (병렬 처리 + 캐시)
- **페이지 전환 속도**: 80-90% 개선 (캐시 우선 조회)
- **API 호출 수**: 60-80% 감소 (중복 요청 제거)

### 사용자 경험 개선
- 즉각적인 데이터 표시 (캐시 히트 시)
- 로딩 상태 명확한 표시
- 오프라인 지원 가능성

---

## 🔄 마이그레이션 전략

### 점진적 적용
1. 먼저 읽기 전용 데이터만 캐싱 적용
2. 쓰기 작업은 기존 방식 유지
3. 점진적으로 페이지별 적용
4. 수동 갱신 기능 추가
5. 쓰기 작업 후 자동 갱신 추가
6. 사용자 피드백 수집 및 개선

### 롤백 계획
- 캐시 기능 비활성화 플래그
- 캐시 클리어 기능
- 기존 API 호출 방식으로 폴백
- 수동 갱신 버튼으로 언제든지 최신 데이터 확보 가능

---

## 📌 주의사항

1. **데이터 일관성**
   - 쓰기 작업 후 관련 캐시 무효화 필수
   - 동시성 문제 고려

2. **캐시 크기 관리**
   - IndexedDB 용량 모니터링
   - 오래된 캐시 자동 정리

3. **보안**
   - 민감한 데이터는 캐시하지 않기
   - 사용자별 캐시 분리

4. **호환성**
   - IndexedDB 미지원 브라우저 대비
   - 폴백 전략 필요

---

## ✅ 구현 완료 상태

### Phase 1: 캐시 인프라 구축 ✅
- **CacheManager**: `src/utils/cache/cacheManager.ts` - 완료
- **캐시 유틸리티**: `src/utils/cache/cacheUtils.ts` - 완료
- 메모리 캐시 + localStorage 2단계 계층 구조 구현 완료

### Phase 2: API 클라이언트 통합 ✅
- **apiClient 수정**: `src/utils/api/apiClient.ts` - 완료
- 캐시 우선 조회 로직 구현 완료
- 쓰기 작업 자동 캐시 무효화 구현 완료

### Phase 3: 데이터 동기화 서비스 ✅
- **DataSyncService**: `src/services/dataSyncService.ts` - 완료
- 초기 로딩, 백그라운드 동기화, 수동 갱신 모두 구현 완료
- 스마트 갱신 전략 (페이지 활성 시에만) 구현 완료

### Phase 4: 로딩 UI 구현 ✅
- **LoadingProgress**: `src/components/ui/LoadingProgress.tsx` - 완료
- **DataSyncStatus**: `src/components/ui/DataSyncStatus.tsx` - 완료
- Header 컴포넌트에 통합 완료

### Phase 5: Hook 통합 ✅
- **useAppState**: `src/hooks/core/useAppState.ts` - 완료
- DataSyncService 초기화 및 통합 완료
- 로그인 시 자동 데이터 로딩 구현 완료

### Phase 6: 백그라운드 동기화 ✅
- 주기적 갱신 (스마트 갱신) 구현 완료
- 수동 갱신 구현 완료
- 쓰기 작업 후 자동 갱신 구현 완료

## 🎯 다음 단계 (선택사항)

### Phase 1.5: IndexedDB 추가 (필요 시)
1. **IndexedDB 설정**: 대용량 데이터 지원이 필요할 때
2. **3단계 캐시 계층 완성**: 메모리 → localStorage → IndexedDB
3. **오프라인 지원**: 오프라인 기능이 필요할 때

### 최적화 및 개선
1. **동적 주기 조정**: 429 에러 발생 시 자동으로 갱신 주기 연장
2. **캐시 히트율 모니터링**: 성능 분석을 위한 통계 수집
3. **에러 복구 전략**: 네트워크 오류 시 자동 재시도 로직 개선

---

## 📚 참고 자료

- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [idb 라이브러리](https://github.com/jakearchibald/idb)
- [Stale-While-Revalidate 패턴](https://web.dev/stale-while-revalidate/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

