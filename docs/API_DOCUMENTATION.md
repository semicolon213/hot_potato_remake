# Hot Potato API 문서

> 전체 문서 목차: [docs/README.md](./README.md)

## 📚 개요

Hot Potato 프로젝트의 주요 API 및 컴포넌트 인터페이스 문서입니다.

## 🔧 핵심 훅 (Hooks)

### useAppState

전역 애플리케이션 상태를 관리하는 핵심 훅입니다.

```typescript
const {
  // 사용자 상태
  user,
  setUser,
  isLoading,
  
  // 페이지 상태
  currentPage,
  setCurrentPage,
  
  // 데이터 상태
  posts,
  announcements,
  calendarEvents,
  customTemplates,
  
  // 핸들러 함수들
  handleLogin,
  handleLogout,
  handlePageChange,
  handleAddPost,
  handleAddAnnouncement,
  handleAddCalendarEvent
} = useAppState();
```

**반환값:**
- `user`: 현재 로그인한 사용자 정보
- `isLoading`: 로딩 상태
- `currentPage`: 현재 활성 페이지
- `posts`: 게시글 목록
- `announcements`: 공지사항 목록
- `calendarEvents`: 캘린더 이벤트 목록

## 🎨 컴포넌트 API

### PageRenderer

페이지별 렌더링을 담당하는 컴포넌트입니다.

```typescript
interface PageRendererProps {
  currentPage: PageType;
  user: User;
  posts: Post[];
  announcements: Post[];
  calendarEvents: Event[];
  customTemplates: Template[];
  // ... 기타 props
}
```

### StudentList

학생 목록을 표시하는 컴포넌트입니다.

```typescript
interface StudentListProps {
  students: StudentWithCouncil[];
  onSort: (key: string) => void;
  sortConfig: {
    key: string | null;
    direction: 'asc' | 'desc';
  } | null;
}
```

### DocumentList (범용 테이블)

재사용 가능한 테이블 컴포넌트입니다.

```typescript
interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
}

interface DocumentListProps<T> {
  data: T[];
  columns: Column<T>[];
  onSort?: (key: string) => void;
  sortConfig?: {
    key: string | null;
    direction: 'asc' | 'desc';
  } | null;
}
```

## 🔌 Google API 유틸리티

### spreadsheetManager

Google Sheets와의 상호작용을 담당하는 유틸리티입니다.

```typescript
// 스프레드시트 검색
export const findSpreadsheetById = async (name: string): Promise<string | null>;

// 게시글 관리
export const fetchPosts = async (boardSpreadsheetId: string, boardSheetName: string): Promise<Post[]>;
export const addPost = async (boardSpreadsheetId: string, boardSheetName: string, post: Post): Promise<void>;

// 캘린더 이벤트 관리
export const fetchCalendarEvents = async (
  calendarProfessorSpreadsheetId: string | null,
  calendarStudentSpreadsheetId: string | null,
  calendarSheetName: string
): Promise<Event[]>;

export const addCalendarEvent = async (
  calendarSpreadsheetId: string,
  calendarSheetName: string,
  event: Event
): Promise<void>;
```

### googleApiInitializer

Google API 초기화를 담당하는 유틸리티입니다.

```typescript
// Google API 초기화
export const initializeGoogleAPIOnce = async (hotPotatoDBSpreadsheetId: string | null): Promise<void>;

// API 상태 리셋
export const resetGoogleAPIState = (): void;
```

## 📊 타입 정의

### User

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  isApproved: boolean;
  role: 'admin' | 'user';
}
```

### Post

```typescript
interface Post {
  id: string;
  author: string;
  title: string;
  contentPreview: string;
  createdAt: string;
}
```

### Event

```typescript
interface Event {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  description?: string;
  colorId?: string;
  startDateTime?: string;
  endDateTime?: string;
  type?: string;
  color?: string;
  isHoliday?: boolean;
  icon?: string;
}
```

### Template

```typescript
interface Template {
  id: string;
  name: string;
  type: string;
  title: string;
  description: string;
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

## 🎯 페이지 타입

```typescript
type PageType = 
  | "dashboard"
  | "students" 
  | "calendar"
  | "documents"
  | "admin"
  | "board"
  | "announcements"
  | "mypage";
```

## 🔄 상태 관리 패턴

### 로컬 상태
```typescript
const [localState, setLocalState] = useState<Type>(initialValue);
```

### 전역 상태 (useAppState)
```typescript
const { globalState, setGlobalState } = useAppState();
```

### 컨텍스트 상태 (Calendar)
```typescript
const { events, addEvent, updateEvent, deleteEvent } = useCalendarContext();
```

## 🎨 스타일 시스템

### CSS 변수
```css
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

### 테마 클래스
```css
.theme-default { /* 기본 테마 */ }
.theme-purple { /* 보라색 테마 */ }
.theme-green { /* 초록색 테마 */ }
.theme-gray { /* 회색 테마 */ }
```

## 🚀 사용 예시

### 새로운 페이지 추가
```typescript
// 1. PageType에 새 타입 추가
type PageType = "dashboard" | "students" | "newpage";

// 2. PageRenderer에 새 페이지 추가
case "newpage":
  return <NewPageComponent {...props} />;

// 3. Sidebar에 새 메뉴 추가
<SidebarItem 
  page="newpage" 
  icon={<NewIcon />} 
  label="새 페이지" 
/>
```

### 새로운 데이터 타입 추가
```typescript
// 1. 타입 정의
interface NewDataType {
  id: string;
  name: string;
  value: number;
}

// 2. useAppState에 상태 추가
const [newData, setNewData] = useState<NewDataType[]>([]);

// 3. API 함수 추가
export const fetchNewData = async (): Promise<NewDataType[]> => {
  // API 로직
};
```

### 새로운 컴포넌트 생성
```typescript
/**
 * @file NewComponent.tsx
 * @brief 새로운 컴포넌트
 * @details 컴포넌트의 기능 설명
 */

interface NewComponentProps {
  data: DataType[];
  onAction: (item: DataType) => void;
}

export const NewComponent: React.FC<NewComponentProps> = ({ data, onAction }) => {
  return (
    <div>
      {/* 컴포넌트 내용 */}
    </div>
  );
};
```

## 🔍 디버깅 가이드

### 일반적인 문제들

1. **Google API 초기화 실패**
   - 환경 변수 `VITE_GOOGLE_CLIENT_ID` 확인
   - 브라우저 콘솔에서 에러 메시지 확인

2. **시트 데이터 로딩 실패**
   - 스프레드시트 ID가 올바른지 확인
   - 시트 이름이 정확한지 확인
   - Google API 권한 확인

3. **컴포넌트 렌더링 문제**
   - Props 타입 확인
   - 상태 초기화 확인
   - useEffect 의존성 배열 확인

### 로그 확인
```typescript
// 개발자 도구 콘솔에서 확인할 수 있는 로그들
console.log('Google API 초기화 시작');
console.log('스프레드시트 데이터 로딩 중...');
console.log('캘린더 이벤트 가져오기 완료');
```

---

**문서 작성일**: 2024년 9월 25일  
**작성자**: Hot Potato Team  
**버전**: 2.0.0
