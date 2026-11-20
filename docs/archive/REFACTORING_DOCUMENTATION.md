# Hot Potato 프로젝트 리팩터링 문서

## 📋 개요

이 문서는 Hot Potato 프로젝트의 큰 파일을 기능별로 나누고 공통 컴포넌트와 훅을 정리한 작업을 기록합니다.

## 🎯 리팩터링 목표

- **기능 보존**: 기존 기능의 완전한 보존
- **재사용성 향상**: 컴포넌트의 모듈화 및 재사용 가능한 구조
- **CSS 표준화**: 일관된 스타일링 시스템 구축
- **협업 효율성**: 병합 충돌 최소화를 위한 파일 분리
- **코드 품질**: Doxygen 형식의 문서화

## 🏗️ 새로운 폴더 구조

```
src/
├── components/           # UI 컴포넌트
│   ├── layout/          # 레이아웃 컴포넌트
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── PageRenderer.tsx
│   ├── features/        # 기능별 컴포넌트
│   │   ├── auth/        # 인증 관련
│   │   ├── calendar/    # 캘린더 기능
│   │   ├── students/    # 학생 관리
│   │   ├── documents/   # 문서 관리
│   │   ├── admin/       # 관리자 기능
│   │   └── templates/   # 템플릿 관리
│   └── ui/             # 공통 UI 컴포넌트
├── hooks/              # 커스텀 훅
│   ├── core/           # 핵심 훅
│   └── features/       # 기능별 훅
├── pages/              # 페이지 컴포넌트
├── styles/             # 스타일 파일
│   ├── variables.css   # CSS 변수
│   └── pages/          # 페이지별 스타일
├── types/              # TypeScript 타입 정의
├── utils/              # 유틸리티 함수
│   └── google/         # Google API 관련
└── assets/             # 정적 자산
```

## 🔧 주요 개선사항

### 1. App.tsx 모듈화

**이전**: 1600+ 라인의 거대한 단일 파일
**현재**: 기능별로 분리된 모듈 구조

```typescript
// 이전: 모든 로직이 App.tsx에 집중
const App = () => {
  // 1600+ 라인의 모든 로직
};

// 현재: 관심사 분리
const App = () => {
  const appState = useAppState();
  // 간결한 렌더링 로직만
};
```

**분리된 모듈들:**
- `useAppState.ts`: 상태 관리 로직
- `PageRenderer.tsx`: 페이지 렌더링 로직
- `spreadsheetManager.ts`: Google Sheets API
- `googleApiInitializer.ts`: Google API 초기화

### 2. 컴포넌트 재사용성 향상

#### 공통 UI 컴포넌트
```typescript
// DocumentList.tsx - 범용 테이블 컴포넌트
interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

// Button.tsx - 표준화된 버튼
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'small' | 'medium' | 'large';
  // ...
}
```

#### 학생 관리 컴포넌트 분리
```typescript
// 이전: Students.tsx (단일 거대 컴포넌트)
// 현재: 기능별 분리
├── StudentHeader.tsx      # 헤더 영역
├── StudentSearchFilter.tsx # 검색 필터
├── StudentActionButtons.tsx # 액션 버튼들
├── StudentList.tsx        # 학생 목록
└── CouncilSection.tsx     # 학생회 섹션
```

### 3. CSS 표준화

#### CSS 변수 시스템
```css
/* variables.css */
:root {
  --primary-color: #6366f1;
  --secondary-color: #8b5cf6;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  
  --main-font: 'SUITE-Regular', sans-serif;
  --heading-font: 'GmarketSansMedium', sans-serif;
}
```

#### 테마 시스템
```css
/* 기본 테마 */
.theme-default {
  --bg-primary: #f8f8f7;
  --bg-secondary: #f8fafc;
  --text-primary: #1f2937;
}

/* 보라색 테마 */
.theme-purple {
  --bg-primary: #f3f4f6;
  --bg-secondary: #e5e7eb;
  --accent-color: #8b5cf6;
}
```

### 4. 상태 관리 개선

#### 중앙화된 상태 관리
```typescript
// useAppState.ts
export const useAppState = () => {
  // 사용자 인증 상태
  const [user, setUser] = useState<User | null>(null);
  
  // 페이지 상태
  const [currentPage, setCurrentPage] = useState<PageType>("dashboard");
  
  // 데이터 상태
  const [posts, setPosts] = useState<Post[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);
  
  // Google API 초기화
  useEffect(() => {
    initializeGoogleAPIOnce(hotPotatoDBSpreadsheetId);
  }, []);
  
  return {
    // 상태와 핸들러들을 반환
  };
};
```

### 5. Google API 통합 개선

#### 중앙화된 API 관리
```typescript
// googleApiInitializer.ts
export const initializeGoogleAPIOnce = async (
  hotPotatoDBSpreadsheetId: string | null
): Promise<void> => {
  // 중복 초기화 방지
  if (isGoogleAPIInitialized) return;
  
  // 환경 변수 검증
  if (!GOOGLE_CLIENT_ID) {
    console.warn('Google Client ID가 설정되지 않았습니다.');
    return;
  }
  
  // API 초기화 로직
};
```

#### 에러 처리 개선
```typescript
// spreadsheetManager.ts
export const fetchCalendarEvents = async (
  calendarProfessorSpreadsheetId: string | null,
  calendarStudentSpreadsheetId: string | null,
  calendarSheetName: string
): Promise<Event[]> => {
  try {
    // 시트 존재 확인
    const sheetResponse = await gapi.client.sheets.spreadsheets.get({
      spreadsheetId: spreadsheetId,
      ranges: [calendarSheetName]
    });
    
    // 헤더 데이터 확인
    const headerResponse = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${calendarSheetName}!A1:I1`
    });
    
    // 전체 데이터 가져오기
    const fullResponse = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: `${calendarSheetName}!A:I`
    });
    
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
};
```

## 📁 파일별 상세 설명

### 핵심 파일들

#### `src/App.tsx`
- **역할**: 애플리케이션의 진입점
- **개선사항**: 
  - 1600+ 라인에서 500라인으로 축소
  - 인증 상태별 렌더링 로직 분리
  - GoogleOAuthProvider 통합

#### `src/hooks/core/useAppState.ts`
- **역할**: 전역 상태 관리
- **기능**:
  - 사용자 인증 상태 관리
  - Google API 초기화
  - 데이터 로딩 및 캐싱
  - 페이지 네비게이션

#### `src/components/layout/PageRenderer.tsx`
- **역할**: 페이지별 렌더링 로직
- **개선사항**:
  - 조건부 렌더링 최적화
  - Props 타입 안전성 향상
  - 컴포넌트 분리

### 기능별 컴포넌트

#### 인증 시스템 (`src/components/features/auth/`)
```
├── Login.tsx              # 로그인 컴포넌트
├── Login.css              # 로그인 스타일
├── PendingApproval.tsx    # 승인 대기 화면
└── GoogleLoginButton.tsx  # Google 로그인 버튼
```

**개선사항:**
- 로그인 페이지 전용 컨테이너 분리
- 메인 앱 레이아웃과 독립적인 스타일링
- 완벽한 중앙 정렬 구현

#### 학생 관리 (`src/components/features/students/`)
```
├── StudentHeader.tsx       # 학생 관리 헤더
├── StudentSearchFilter.tsx # 검색 및 필터링
├── StudentActionButtons.tsx # 액션 버튼들
├── StudentList.tsx         # 학생 목록 테이블
├── CouncilSection.tsx     # 학생회 섹션
└── index.ts              # 컴포넌트 내보내기
```

**개선사항:**
- 단일 거대 컴포넌트를 기능별로 분리
- 재사용 가능한 테이블 컴포넌트 구현
- 검색 및 필터링 로직 분리

#### 캘린더 시스템 (`src/components/features/calendar/`)
```
├── Calendar/
│   ├── Calendar.tsx           # 메인 캘린더
│   ├── CalendarProvider.tsx   # 캘린더 컨텍스트
│   ├── CalendarSidebar.tsx    # 사이드바
│   ├── AddEventModal.tsx      # 이벤트 추가 모달
│   └── EventDetailModal.tsx   # 이벤트 상세 모달
├── WeeklyCalendar.tsx        # 주간 캘린더
├── ScheduleView.tsx          # 일정 보기
└── MiniCalendar.tsx          # 미니 캘린더
```

**개선사항:**
- 무한 리렌더링 루프 해결
- 컨텍스트 API 최적화
- 이벤트 관리 로직 분리

### 유틸리티 시스템

#### `src/utils/google/spreadsheetManager.ts`
- **역할**: Google Sheets API 중앙 관리
- **기능**:
  - 스프레드시트 검색 및 접근
  - 데이터 CRUD 작업
  - 에러 처리 및 로깅

#### `src/utils/google/googleApiInitializer.ts`
- **역할**: Google API 초기화 관리
- **기능**:
  - 중복 초기화 방지
  - 환경 변수 검증
  - API 상태 관리

### 스타일 시스템

#### `src/styles/variables.css`
```css
:root {
  /* 색상 시스템 */
  --primary-color: #6366f1;
  --secondary-color: #8b5cf6;
  
  /* 폰트 시스템 */
  --main-font: 'SUITE-Regular', sans-serif;
  --heading-font: 'GmarketSansMedium', sans-serif;
  
  /* 간격 시스템 */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
}
```

## 🚀 성능 개선

### 1. 번들 크기 최적화
- 코드 스플리팅을 통한 지연 로딩
- 불필요한 의존성 제거
- Tree shaking 최적화

### 2. 렌더링 성능
- React.memo를 통한 불필요한 리렌더링 방지
- useMemo, useCallback을 통한 계산 최적화
- 무한 리렌더링 루프 해결

### 3. 메모리 관리
- useEffect 정리 함수 추가
- 이벤트 리스너 정리
- 상태 초기화 로직 개선

## 🔍 코드 품질 개선

### 1. TypeScript 타입 안전성
```typescript
// 엄격한 타입 정의
interface User {
  id: string;
  name: string;
  email: string;
  isApproved: boolean;
  role: 'admin' | 'user';
}

// 제네릭을 활용한 재사용 가능한 컴포넌트
interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}
```

### 2. 에러 처리 개선
```typescript
// Google API 에러 처리
try {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: range
  });
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
} catch (error) {
  console.error('Google API Error:', error);
  // 사용자 친화적 에러 메시지
}
```

### 3. Doxygen 형식 문서화
```typescript
/**
 * @file App.tsx
 * @brief Hot Potato 메인 애플리케이션 컴포넌트
 * @details React 애플리케이션의 진입점으로, 인증 상태에 따라 다른 화면을 렌더링합니다.
 * @author Hot Potato Team
 * @date 2024
 */

/**
 * @brief 메인 애플리케이션 컴포넌트
 * @details 사용자 인증 상태에 따라 로그인, 승인 대기, 메인 애플리케이션 화면을 렌더링합니다.
 * @returns {JSX.Element} 렌더링된 컴포넌트
 */
```

## 🧪 테스트 및 검증

### 1. 기능 테스트
- ✅ 로그인/로그아웃 기능
- ✅ 페이지 네비게이션
- ✅ 데이터 로딩 및 표시
- ✅ Google API 연동

### 2. 성능 테스트
- ✅ 초기 로딩 시간 개선
- ✅ 메모리 사용량 최적화
- ✅ 렌더링 성능 향상

### 3. 사용자 경험 테스트
- ✅ 로그인 화면 중앙 정렬
- ✅ 반응형 디자인
- ✅ 에러 처리 및 사용자 피드백

## 📈 향후 개선 계획

### 1. 추가 모듈화
- [ ] 더 많은 공통 컴포넌트 추출
- [ ] 비즈니스 로직과 UI 로직 분리
- [ ] 상태 관리 라이브러리 도입 검토

### 2. 성능 최적화
- [ ] 가상화를 통한 대용량 데이터 처리
- [ ] 이미지 최적화 및 지연 로딩
- [ ] 서비스 워커를 통한 오프라인 지원

### 3. 개발자 경험 개선
- [ ] Storybook 도입
- [ ] 자동화된 테스트 구축
- [ ] CI/CD 파이프라인 구축

## 📝 결론

이번 리팩터링에서 바꾼 내용은 다음과 같습니다.

1. 1,600줄이 넘던 파일을 기능별 모듈로 나눴습니다.
2. 공통 컴포넌트와 훅을 분리했습니다.
3. 폴더별 책임을 구분했습니다.
4. 여러 사람이 같은 파일을 고칠 때 생기는 충돌을 줄였습니다.
5. 로그인 화면과 주요 UI를 정리했습니다.

---

**문서 작성일**: 2024년 9월 25일  
**작성자**: Hot Potato Team  
**버전**: 2.0.0
