/**
 * @file dataSyncService.ts
 * @brief 데이터 동기화 서비스
 * @details 초기 로딩, 백그라운드 동기화, 수동 갱신 등을 관리합니다.
 */

import { apiClient } from '../utils/api/apiClient';
import { getCacheManager } from '../utils/cache/cacheManager';
import { generateCacheKey, getActionCategory, CACHEABLE_ACTIONS } from '../utils/cache/cacheUtils';
import { tokenManager } from '../utils/auth/tokenManager';
import { initializeSpreadsheetIds } from '../utils/database/papyrusManager';
import type { User } from '../types/app';

type InitialDataScope = 'global' | 'dashboard' | 'page';
type InitialDataPhase = 1 | 2;

interface InitialDataTaskConfig {
  key: string;
  name: string;
  category: string;
  scope: InitialDataScope;
  phase: InitialDataPhase;
  required: boolean;
  runIf: (user: User) => boolean;
  fn: (user: User) => Promise<unknown>;
}

const INITIAL_DATA_TASKS: InitialDataTaskConfig[] = [
  {
    key: 'announcements',
    name: '공지사항',
    category: 'announcements',
    scope: 'global',
    phase: 1,
    required: true,
    runIf: (user) => !!(user.studentId && user.userType),
    fn: async (user) => {
      const { fetchAnnouncements } = await import('../utils/database/papyrusManager');
      return fetchAnnouncements(user.studentId!, user.userType!);
    }
  },
  {
    key: 'calendar-events',
    name: '캘린더 이벤트',
    category: 'calendar',
    scope: 'global',
    phase: 1,
    required: true,
    runIf: () => true,
    fn: async () => {
      const { fetchCalendarEvents } = await import('../utils/database/papyrusManager');
      return fetchCalendarEvents();
    }
  },
  {
    key: 'documents',
    name: '전체 문서 목록',
    category: 'documents',
    scope: 'global',
    phase: 2,
    required: true,
    runIf: () => true,
    fn: async () => {
      const { loadAllDocuments } = await import('../utils/helpers/loadDocumentsFromDrive');
      return loadAllDocuments();
    }
  },
  {
    key: 'templates',
    name: '템플릿 목록',
    category: 'templates',
    scope: 'global',
    phase: 1,
    required: true,
    runIf: () => true,
    fn: async () => apiClient.getTemplates()
  },
  {
    key: 'shared-templates',
    name: '공유 템플릿 목록',
    category: 'templates',
    scope: 'global',
    phase: 2,
    required: false,
    runIf: () => true,
    fn: async () => apiClient.getSharedTemplates()
  },
  {
    key: 'static-tags',
    name: '기본 태그 목록',
    category: 'tags',
    scope: 'global',
    phase: 1,
    required: true,
    runIf: () => true,
    fn: async () => apiClient.getStaticTags()
  },
  {
    key: 'workflow-templates',
    name: '워크플로우 템플릿',
    category: 'workflow',
    scope: 'global',
    phase: 1,
    required: true,
    runIf: () => true,
    fn: async () => apiClient.getWorkflowTemplates()
  },
  {
    key: 'students',
    name: '학생 목록',
    category: 'students',
    scope: 'page',
    phase: 2,
    required: false,
    runIf: () => true,
    fn: async () => {
      const { fetchStudents } = await import('../utils/database/papyrusManager');
      return fetchStudents();
    }
  },
  {
    key: 'staff',
    name: '교직원 목록',
    category: 'staff',
    scope: 'page',
    phase: 2,
    required: false,
    runIf: () => true,
    fn: async () => {
      const { fetchStaff } = await import('../utils/database/papyrusManager');
      return fetchStaff();
    }
  },
  {
    key: 'attendees',
    name: '참석자 목록',
    category: 'attendees',
    scope: 'page',
    phase: 2,
    required: false,
    runIf: () => true,
    fn: async () => {
      const { fetchAttendees } = await import('../utils/database/papyrusManager');
      return fetchAttendees();
    }
  },
  {
    key: 'ledger-list',
    name: '장부 목록',
    category: 'accounting',
    scope: 'global',
    phase: 1,
    required: true,
    runIf: () => true,
    fn: async () => apiClient.getLedgerList()
  },
  {
    key: 'my-requested-workflows',
    name: '내가 올린 결재',
    category: 'workflow',
    scope: 'dashboard',
    phase: 2,
    required: false,
    runIf: (user) => !!user.email,
    fn: async (user) => apiClient.getMyRequestedWorkflows(user.email!)
  },
  {
    key: 'my-pending-workflows',
    name: '내 담당 워크플로우',
    category: 'workflow',
    scope: 'dashboard',
    phase: 2,
    required: false,
    runIf: (user) => !!user.email,
    fn: async (user) => apiClient.getMyPendingWorkflows({ userEmail: user.email! })
  },
  {
    key: 'completed-workflows',
    name: '완료된 워크플로우',
    category: 'workflow',
    scope: 'dashboard',
    phase: 2,
    required: false,
    runIf: (user) => !!user.email,
    fn: async (user) => apiClient.getCompletedWorkflows({ userEmail: user.email! })
  },
  {
    key: 'all-users',
    name: '전체 사용자 목록',
    category: 'users',
    scope: 'page',
    phase: 2,
    required: false,
    runIf: (user) => !!user.isAdmin,
    fn: async () => apiClient.getAllUsers()
  },
  {
    key: 'pending-users',
    name: '승인 대기 사용자',
    category: 'users',
    scope: 'dashboard',
    phase: 2,
    required: false,
    runIf: (user) => !!user.isAdmin,
    fn: async () => apiClient.getPendingUsers()
  }
];

/**
 * 데이터 동기화 진행률 콜백
 */
export interface SyncProgressCallback {
  (progress: {
    current: number;
    total: number;
    category?: string;
    message?: string;
  }): void;
}

/**
 * 데이터 동기화 서비스
 */
export class DataSyncService {
  private lastSyncTime: Date | null = null;
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private isInitializing = false;
  private cacheManager = getCacheManager();
  private isAppActive = true; // 앱 활성 상태
  private currentPage: string | null = null; // 현재 페이지
  private lastSyncByCategory: Map<string, number> = new Map(); // 카테고리별 마지막 갱신 시간

  // 주기적 갱신 주기 설정 (스마트 갱신: 페이지 활성 시에만 갱신)
  // 429 에러 방지를 위해 주기를 더 늘림
  private readonly SYNC_INTERVALS: Record<string, number> = {
    'workflow': 5 * 60 * 1000,        // 5분 (페이지 활성 시에만, 실시간성 중요하지만 API 제한 고려)
    'accounting': 10 * 60 * 1000,     // 10분 (페이지 활성 시에만)
    'announcements': 15 * 60 * 1000,  // 15분 (페이지 활성 시에만)
    'documents': 15 * 60 * 1000,      // 15분 (페이지 활성 시에만)
    'users': 30 * 60 * 1000,          // 30분 (관리자용, 항상 갱신)
    'templates': 30 * 60 * 1000,      // 30분 (페이지 활성 시에만)
    'spreadsheetIds': 60 * 60 * 1000, // 60분 (시스템 데이터, 항상 갱신)
    'calendar': 15 * 60 * 1000,       // 15분 (페이지 활성 시에만)
    'students': 30 * 60 * 1000,       // 30분 (페이지 활성 시에만)
    'staff': 30 * 60 * 1000,          // 30분 (페이지 활성 시에만)
  };
  
  // 429 에러 발생 시 카테고리별 일시 중지 시간 (밀리초)
  private pausedCategories: Map<string, number> = new Map();
  // 429 에러 발생 횟수 추적
  private error429Count: Map<string, number> = new Map();
  // 카테고리별 갱신 중복 방지 (같은 카테고리 동시 다중 갱신 방지)
  private refreshingCategories: Set<string> = new Set();
  // invalidateAndRefresh 디바운스 (연속 호출 시 한 번만 갱신)
  private invalidateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private invalidateDebounceMs = 800;
  private pendingInvalidateKeys: string[] = [];

  // 페이지별 활성화 카테고리 매핑 (해당 페이지에 있을 때만 갱신)
  private readonly PAGE_CATEGORY_MAP: Record<string, string[]> = {
    'dashboard': ['announcements', 'calendar', 'workflow'],
    'workflow': ['workflow'],
    'accounting': ['accounting'],
    'announcements': ['announcements'],
    'documents': ['documents', 'templates'],
    'students': ['students'],
    'staff': ['staff'],
    'calendar': ['calendar'],
  };

  /**
   * 초기 전체 데이터 한 번에 로드 (스프레드시트 ID 후 나머지 모두 병렬).
   * 완료 후 앱을 표시하면 모든 페이지에서 데이터가 바로 나타남.
   * 이후 구글 시트 변경은 주기적 백그라운드 동기화로 반영.
   */
  async initializeDataFull(
    user: User,
    onProgress?: SyncProgressCallback
  ): Promise<{
    announcementSpreadsheetId: string | null;
    calendarProfessorSpreadsheetId: string | null;
    calendarCouncilSpreadsheetId: string | null;
    calendarADProfessorSpreadsheetId: string | null;
    calendarSuppSpreadsheetId: string | null;
    calendarStudentSpreadsheetId: string | null;
    hotPotatoDBSpreadsheetId: string | null;
    studentSpreadsheetId: string | null;
    staffSpreadsheetId: string | null;
  }> {
    if (this.isInitializing) {
      console.warn('⚠️ 이미 초기화 중입니다.');
      return await initializeSpreadsheetIds();
    }

    if (!tokenManager.isValid()) {
      throw new Error('토큰이 만료되었습니다. 다시 로그인해주세요.');
    }

    this.isInitializing = true;
    try {
      onProgress?.({ current: 0, total: 1, message: '스프레드시트 ID 초기화 중...' });
      const spreadsheetIds = await initializeSpreadsheetIds();
      
      const applicableTasks = INITIAL_DATA_TASKS.filter(
        (task) => task.runIf(user) && task.phase === 1
      );
      const tasks: Array<{ name: string; category: string; fn: () => Promise<unknown> }> = applicableTasks.map((task) => ({
        name: task.name,
        category: task.category,
        fn: () => task.fn(user)
      }));

      // 태스크에서 사용하는 동적 import 모듈 선로딩 (첫 요청 지연 감소)
      await Promise.all([
        import('../utils/database/papyrusManager'),
        import('../utils/helpers/loadDocumentsFromDrive')
      ]);

      const total = tasks.length;
      let completed = 0;
      const CONCURRENCY = 8; // 동시 요청 수 제한 (429·지연 완화)

      onProgress?.({ current: 0, total, message: '모든 데이터 로딩 중...' });

      for (let i = 0; i < tasks.length; i += CONCURRENCY) {
        const chunk = tasks.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          chunk.map(async (task) => {
            try {
              await task.fn();
            } catch (error) {
              console.error(`❌ ${task.name} 로딩 실패:`, error);
            } finally {
              completed++;
              onProgress?.({ current: completed, total, category: task.category, message: `${task.name} 완료` });
            }
          })
        );
      }

      this.lastSyncTime = new Date();
      console.log('✅ 초기 전체 데이터 로딩 완료');
      return spreadsheetIds;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * 초기 데이터 로딩 (전체 새로고침 시 사용). 한 번에 모두 로드.
   */
  async initializeData(
    user: User,
    onProgress?: SyncProgressCallback
  ): Promise<void> {
    await this.initializeDataFull(user, onProgress);
  }

  /**
   * 2단계 초기 로딩 (백그라운드). 문서/학생·교직원/워크플로우 등 phase 2 태스크만 실행.
   * isInitializing을 사용하지 않아 로그인 직후 비동기 호출해도 블로킹하지 않음.
   */
  async initializePhase2(
    user: User,
    onProgress?: SyncProgressCallback
  ): Promise<void> {
    if (!tokenManager.isValid()) return;

    const applicableTasks = INITIAL_DATA_TASKS.filter(
      (task) => task.runIf(user) && task.phase === 2
    );
    const tasks: Array<{ name: string; category: string; fn: () => Promise<unknown> }> = applicableTasks.map((task) => ({
      name: task.name,
      category: task.category,
      fn: () => task.fn(user)
    }));

    if (tasks.length === 0) {
      this.lastSyncTime = new Date();
      return;
    }

    await Promise.all([
      import('../utils/database/papyrusManager'),
      import('../utils/helpers/loadDocumentsFromDrive')
    ]);

    const total = tasks.length;
    let completed = 0;
    const CONCURRENCY = 8;

    onProgress?.({ current: 0, total, message: '백그라운드 동기화 중...' });

    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      const chunk = tasks.slice(i, i + CONCURRENCY);
      await Promise.allSettled(
        chunk.map(async (task) => {
          try {
            await task.fn();
          } catch (error) {
            console.error(`❌ ${task.name} 로딩 실패:`, error);
          } finally {
            completed++;
            onProgress?.({ current: completed, total, category: task.category, message: `${task.name} 완료` });
          }
        })
      );
    }

    this.lastSyncTime = new Date();
    console.log('✅ 2단계(백그라운드) 데이터 로딩 완료');
  }

  /**
   * 전체 데이터 수동 갱신 (새로고침 버튼)
   */
  async refreshAllData(onProgress?: SyncProgressCallback): Promise<void> {
    try {
      // 모든 캐시 무효화
      await this.cacheManager.clear();

      // 사용자 정보 가져오기
      const userInfo = typeof window !== 'undefined' 
        ? JSON.parse(localStorage.getItem('user') || '{}') 
        : {};

      if (!userInfo.email) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }

      const user: User = {
        email: userInfo.email,
        name: userInfo.name,
        isApproved: userInfo.isApproved,
        isAdmin: userInfo.isAdmin || false,
        picture: userInfo.picture
      };

      // 1단계 + 2단계 모두 실행하여 전체 갱신
      await this.initializeDataFull(user, onProgress);
      await this.initializePhase2(user, onProgress);

    } catch (error) {
      console.error('❌ 전체 데이터 갱신 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 카테고리만 갱신 (백그라운드에서 실제 데이터 가져오기)
   * 같은 카테고리에 대한 동시 다중 갱신은 건너뜁니다.
   */
  async refreshCategory(category: string, background: boolean = true): Promise<void> {
    if (this.refreshingCategories.has(category)) {
      console.log(`⏳ ${category} 갱신이 이미 진행 중입니다. 건너뜁니다.`);
      return;
    }

    // 429 에러로 인해 일시 중지된 카테고리인지 확인
    const pausedUntil = this.pausedCategories.get(category);
    if (pausedUntil && Date.now() < pausedUntil) {
      const remainingMinutes = Math.ceil((pausedUntil - Date.now()) / (60 * 1000));
      console.log(`⏸️ ${category} 카테고리는 429 에러로 인해 ${remainingMinutes}분 동안 일시 중지됩니다.`);
      return;
    }

    // 일시 중지 시간이 지났으면 해제
    if (pausedUntil && Date.now() >= pausedUntil) {
      this.pausedCategories.delete(category);
      this.error429Count.delete(category);
      console.log(`▶️ ${category} 카테고리 일시 중지 해제`);
    }

    // 토큰 유효성 확인
    if (!tokenManager.isValid()) {
      console.warn('⚠️ 토큰이 만료되어 갱신을 건너뜁니다.');
      return;
    }

    // 카테고리별 캐시 무효화
    await this.cacheManager.invalidate(`${category}:*`);

    // 백그라운드에서 실제 데이터 가져오기
    this.refreshingCategories.add(category);
    const clearRefreshing = () => {
      this.refreshingCategories.delete(category);
    };

    if (background) {
      // 비동기로 백그라운드에서 실행 (응답 지연 없음)
      this.fetchCategoryDataInBackground(category)
        .then(() => {
          this.lastSyncTime = new Date();
          this.lastSyncByCategory.set(category, Date.now());
          console.log(`✅ ${category} 갱신 완료 및 시간 업데이트`);
        })
        .catch((error) => {
          console.error(`❌ ${category} 갱신 실패, 다음 주기에 재시도 예정`);
          this.handle429Error(category, error);
        })
        .finally(clearRefreshing);
    } else {
      try {
        await this.fetchCategoryDataInBackground(category);
        this.lastSyncTime = new Date();
        this.lastSyncByCategory.set(category, Date.now());
      } catch (error) {
        this.handle429Error(category, error);
        throw error;
      } finally {
        clearRefreshing();
      }
    }
  }

  /**
   * 429 에러 처리: 카테고리별 일시 중지
   */
  private handle429Error(category: string, error: any): void {
    const errorMessage = error?.message || error?.toString() || '';
    const is429Error = error?.status === 429 || 
                      error?.code === 429 || 
                      errorMessage.includes('429') ||
                      errorMessage.includes('호출 제한') ||
                      errorMessage.includes('Quota exceeded');

    if (is429Error) {
      const currentCount = (this.error429Count.get(category) || 0) + 1;
      this.error429Count.set(category, currentCount);

      // 연속 발생 횟수에 따라 일시 중지 시간 증가 (최소 30분, 최대 2시간)
      const pauseMinutes = Math.min(30 + (currentCount - 1) * 15, 120);
      const pauseUntil = Date.now() + (pauseMinutes * 60 * 1000);
      this.pausedCategories.set(category, pauseUntil);

      console.warn(`⚠️ ${category} 카테고리에서 429 에러 발생 (${currentCount}회). ${pauseMinutes}분 동안 일시 중지됩니다.`);
      
      // 사용자에게 알림 (DataSyncStatus 컴포넌트에서 처리)
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('sync429Error', {
          detail: { category, pauseMinutes }
        }));
      }
    } else {
      // 429가 아니면 에러 카운터 리셋
      this.error429Count.delete(category);
    }
  }

  /**
   * 백그라운드에서 카테고리별 데이터 가져오기
   */
  private async fetchCategoryDataInBackground(category: string): Promise<void> {
    const userInfo = typeof window !== 'undefined' 
      ? JSON.parse(localStorage.getItem('user') || '{}') 
      : {};

    try {
      switch (category) {
        case 'users':
          if (userInfo.isAdmin) {
            await Promise.all([
              apiClient.getAllUsers(),
              apiClient.getPendingUsers()
            ]);
          }
          break;

        case 'documents':
          {
            const { loadAllDocuments } = await import('../utils/helpers/loadDocumentsFromDrive');
            await loadAllDocuments();
          }
          break;

        case 'templates':
          await Promise.allSettled([
            apiClient.getTemplates().catch((error) => {
              console.error('❌ getTemplates 실패:', error);
              return { success: false, error: error.message };
            }),
            apiClient.getSharedTemplates().catch((error) => {
              console.error('❌ getSharedTemplates 실패:', error);
              return { success: false, error: error.message };
            }),
            apiClient.getStaticTags().catch((error) => {
              console.error('❌ getStaticTags 실패:', error);
              return { success: false, error: error.message };
            })
          ]);
          break;

        case 'workflow':
          if (userInfo.email) {
            await Promise.all([
              apiClient.getMyRequestedWorkflows(userInfo.email),
              apiClient.getMyPendingWorkflows({ userEmail: userInfo.email }),
              apiClient.getCompletedWorkflows({ userEmail: userInfo.email }),
              apiClient.getWorkflowTemplates()
            ]);
          }
          break;

        case 'accounting':
          await apiClient.getLedgerList();
          break;

        case 'announcements':
          {
            const { fetchAnnouncements } = await import('../utils/database/papyrusManager');
            if (userInfo.studentId && userInfo.userType) {
              await fetchAnnouncements(userInfo.studentId, userInfo.userType);
            }
          }
          break;

        case 'calendar':
          {
            const { fetchCalendarEvents } = await import('../utils/database/papyrusManager');
            await fetchCalendarEvents();
          }
          break;

        case 'students':
          {
            const { fetchStudents } = await import('../utils/database/papyrusManager');
            await fetchStudents();
          }
          break;

        case 'staff':
          {
            const { fetchStaff, fetchAttendees } = await import('../utils/database/papyrusManager');
            await Promise.all([
              fetchStaff(),
              fetchAttendees()
            ]);
          }
          break;

        case 'spreadsheetIds':
          await initializeSpreadsheetIds();
          break;

        default:
          console.log(`⚠️ ${category} 카테고리에 대한 백그라운드 갱신 로직이 없습니다.`);
      }

      console.log(`✅ ${category} 백그라운드 갱신 완료`);
    } catch (error) {
      console.error(`❌ ${category} 백그라운드 갱신 중 오류:`, error);
      throw error;
    }
  }

  /**
   * 쓰기 작업 후 관련 캐시 무효화 및 백그라운드 갱신
   * 연속 호출 시 디바운스하여 한 번만 갱신합니다.
   */
  async invalidateAndRefresh(cacheKeys: string[]): Promise<void> {
    const keys = [...cacheKeys];
    if (this.invalidateDebounceTimer !== null) {
      clearTimeout(this.invalidateDebounceTimer);
      this.invalidateDebounceTimer = null;
    }
    const merged = new Set([...this.pendingInvalidateKeys, ...keys]);
    this.pendingInvalidateKeys = Array.from(merged);

    this.invalidateDebounceTimer = setTimeout(() => {
      this.invalidateDebounceTimer = null;
      const toProcess = [...this.pendingInvalidateKeys];
      this.pendingInvalidateKeys = [];
      this.doInvalidateAndRefresh(toProcess).catch((err) => {
        console.error('❌ 캐시 무효화 및 갱신 실패:', err);
      });
    }, this.invalidateDebounceMs);
  }

  /**
   * 캐시 무효화 및 카테고리별 백그라운드 갱신 실행
   */
  private async doInvalidateAndRefresh(cacheKeys: string[]): Promise<void> {
    if (!tokenManager.isValid()) {
      console.warn('⚠️ 토큰이 만료되어 캐시 무효화를 건너뜁니다.');
      return;
    }
    for (const key of cacheKeys) {
      await this.cacheManager.invalidate(key);
    }
    const categories = new Set<string>();
    cacheKeys.forEach(key => {
      const match = key.match(/^([^:]+):/);
      if (match) categories.add(match[1]);
    });
    const refreshPromises = Array.from(categories).map(category =>
      this.refreshCategory(category, true).catch((error) => {
        console.error(`❌ ${category} 백그라운드 갱신 실패:`, error);
      })
    );
    await Promise.allSettled(refreshPromises);
    this.lastSyncTime = new Date();
    console.log('✅ 캐시 무효화 및 백그라운드 갱신 완료:', cacheKeys);
  }

  /**
   * 앱 활성 상태 설정
   */
  setAppActive(isActive: boolean): void {
    this.isAppActive = isActive;
    if (!isActive) {
      console.log('⏸️ 앱이 비활성화되어 백그라운드 갱신을 일시 중지합니다.');
    } else {
      console.log('▶️ 앱이 활성화되어 백그라운드 갱신을 재개합니다.');
      // 활성화 시 즉시 갱신 (필요한 카테고리만)
      this.syncActivePageCategories();
    }
  }

  /**
   * 현재 페이지 설정
   */
  setCurrentPage(page: string | null): void {
    this.currentPage = page;
    // 페이지 변경 시 해당 페이지의 카테고리 즉시 갱신
    if (page) {
      this.syncActivePageCategories();
    }
  }

  /**
   * 현재 활성 페이지의 카테고리만 갱신
   */
  private async syncActivePageCategories(): Promise<void> {
    if (!this.currentPage || !this.isAppActive) {
      return;
    }

    const categories = this.PAGE_CATEGORY_MAP[this.currentPage] || [];
    const now = Date.now();

    for (const category of categories) {
      const interval = this.SYNC_INTERVALS[category];
      const lastSync = this.lastSyncByCategory.get(category) || 0;
      
      // 마지막 갱신 후 충분한 시간이 지났는지 확인
      if (now - lastSync >= interval) {
        try {
          // 백그라운드로 갱신 (응답 대기 안 함)
          this.refreshCategory(category, true);
          this.lastSyncByCategory.set(category, now);
        } catch (error) {
          console.error(`❌ ${category} 갱신 실패:`, error);
        }
      }
    }
  }

  /**
   * 주기적 백그라운드 동기화 시작 (스마트 갱신: 페이지 활성 시에만)
   */
  startPeriodicSync(): void {
    // 기존 인터벌 정리
    this.stopPeriodicSync();

    // 앱 포커스/블러 이벤트 리스너 등록
    if (typeof window !== 'undefined') {
      const handleFocus = () => {
        this.setAppActive(true);
      };
      const handleBlur = () => {
        this.setAppActive(false);
      };
      const handleVisibilityChange = () => {
        this.setAppActive(!document.hidden);
      };

      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // 정리 함수 저장 (나중에 제거하기 위해)
      (this as any)._cleanupListeners = () => {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }

    // 카테고리별로 주기적 갱신 설정 (스마트 갱신)
    Object.entries(this.SYNC_INTERVALS).forEach(([category, interval]) => {
      const timerId = setInterval(async () => {
        // 앱이 비활성화되어 있으면 스킵
        if (!this.isAppActive) {
          return;
        }

        // 현재 페이지에서 사용하는 카테고리인지 확인
        const shouldSync = !this.currentPage || 
          (this.PAGE_CATEGORY_MAP[this.currentPage]?.includes(category) ?? false) ||
          category === 'spreadsheetIds' || // 시스템 데이터는 항상 갱신
          category === 'users'; // 사용자 데이터는 항상 갱신 (관리자용)

        if (!shouldSync) {
          return; // 해당 페이지에서 사용하지 않는 카테고리는 스킵
        }

        // 토큰 만료 체크
        if (!tokenManager.isValid()) {
          console.warn(`⚠️ 토큰이 만료되어 ${category} 갱신을 건너뜁니다.`);
          return;
        }

        // 토큰이 곧 만료되면(5분 이내) 갱신 중단
        if (tokenManager.isExpiringSoon()) {
          console.warn(`⚠️ 토큰이 곧 만료되어 ${category} 갱신을 건너뜁니다.`);
          return;
        }

        // 429 에러로 인해 일시 중지된 카테고리인지 확인
        const pausedUntil = this.pausedCategories.get(category);
        if (pausedUntil && Date.now() < pausedUntil) {
          return; // 일시 중지 중이면 스킵
        }

        // 마지막 갱신 시간 확인 (중복 갱신 방지)
        const lastSync = this.lastSyncByCategory.get(category) || 0;
        const now = Date.now();
        if (now - lastSync < interval * 0.8) {
          // 아직 갱신 주기가 지나지 않았으면 스킵 (80% 이상 경과해야 갱신)
          return;
        }

        try {
          // 백그라운드로 갱신 (응답 대기 안 함)
          // refreshCategory 내부에서 성공 시 lastSyncByCategory가 업데이트됨
          this.refreshCategory(category, true);
          console.log(`🔄 ${category} 백그라운드 갱신 시작`);
        } catch (error) {
          console.error(`❌ ${category} 백그라운드 갱신 실패:`, error);
        }
      }, interval);

      this.syncIntervals.set(category, timerId);
    });

    console.log('✅ 스마트 주기적 백그라운드 동기화 시작 (페이지 활성 시에만 갱신)');
  }

  /**
   * 주기적 백그라운드 동기화 중지
   */
  stopPeriodicSync(): void {
    this.syncIntervals.forEach((timerId) => {
      clearInterval(timerId);
    });
    this.syncIntervals.clear();

    // 이벤트 리스너 정리
    if ((this as any)._cleanupListeners) {
      (this as any)._cleanupListeners();
      (this as any)._cleanupListeners = null;
    }

    console.log('⏹️ 주기적 백그라운드 동기화 중지');
  }

  /**
   * 마지막 갱신 시간 조회
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  /**
   * 서비스 정리
   */
  cleanup(): void {
    this.stopPeriodicSync();
    this.lastSyncTime = null;
  }
}

// 싱글톤 인스턴스
let dataSyncServiceInstance: DataSyncService | null = null;

/**
 * DataSyncService 싱글톤 인스턴스 가져오기
 */
export const getDataSyncService = (): DataSyncService => {
  if (!dataSyncServiceInstance) {
    dataSyncServiceInstance = new DataSyncService();
  }
  return dataSyncServiceInstance;
};

