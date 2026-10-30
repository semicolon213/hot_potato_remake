import { logger } from '../logger';
import { API_CONFIG, API_ACTIONS } from '../../config/api';
import { ENV_CONFIG } from '../../config/environment';
import type {
  SpreadsheetIdsResponse,
  StaticTagsResponse,
  AffectedTemplatesResponse,
  DeleteTagResponse,
  TagImpactCheckResponse,
  SharedTemplatesResponse,
  CreateDocumentResponse,
  RegistrationData,
  DocumentsListResponse,
  UserNameResponse,
  WorkflowRequestResponse,
  WorkflowInfoResponse,
  WorkflowListResponse,
  WorkflowTemplateResponse,
  WorkflowTemplatesListResponse
} from '../../types/api/apiResponses';
import type { LedgerResponse } from '../../types/features/accounting';
import type {
  WorkflowRequestData,
  SetWorkflowLineData,
  GrantWorkflowPermissionsData,
  ReviewActionData,
  PaymentActionData,
  MyPendingWorkflowsParams,
  WorkflowHistoryParams
} from '../../types/documents';
import type { ApprovalStatusResponse } from '../../types/api/userResponses';
import { getCacheManager } from '../cache/cacheManager';
import { 
  generateCacheKey, 
  getCacheTTL, 
  getActionCategory, 
  CACHEABLE_ACTIONS 
} from '../cache/cacheUtils';
const log = logger.scope('utils/api/apiClient');


// API 응답 타입 정의
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  notFound?: string[];
  debug?: Record<string, unknown>;
  permissionResult?: {
    successCount: number;
    failCount: number;
  };
}

const RETRYABLE_READ_ACTIONS = new Set([
  'checkUserStatus',
  'decryptEmail',
  'decryptEmailBatch',
  'encryptEmail',
  'getFieldList',
  'getGraduationGrade',
  'getEmploymentByStdNum',
  'validateStudentForEmployment'
]);

const hasIncompleteSpreadsheetIds = (action: string, response: ApiResponse<unknown>): boolean => {
  if (action !== 'getSpreadsheetIds') return false;
  const ids = response.data as Record<string, unknown> | undefined;
  return Boolean(response.notFound?.length) || Object.values(ids || {}).some(id => !id);
};

// API 요청 옵션 타입 정의
interface ApiRequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

// API 클라이언트 클래스
export class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number;
  private defaultRetries: number;
  private cacheManager = getCacheManager();
  private dataSyncService: any = null; // DataSyncService 인스턴스 (나중에 주입)
  private inFlightRequests = new Map<string, Promise<ApiResponse<unknown>>>();

  constructor() {
    // 개발(localhost): Vite 프록시 /api → Apps Script
    // 배포(Netlify): Netlify Functions /.netlify/functions/proxy → Apps Script
    const isLocal = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      import.meta?.env?.DEV === true
    );
    this.baseUrl = isLocal ? '/api' : '/.netlify/functions/proxy';
    this.defaultTimeout = API_CONFIG.TIMEOUT;
    this.defaultRetries = API_CONFIG.MAX_RETRIES;
  }

  /**
   * DataSyncService 설정 (쓰기 작업 후 자동 캐시 무효화용)
   */
  setDataSyncService(service: any): void {
    this.dataSyncService = service;
  }

  // 공통 API 호출 메서드
  async request<T = unknown>(
    action: string,
    data: Record<string, unknown> = {},
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      headers = {}
    } = options;

    // 캐시 가능한 요청인지 확인
    const isCacheable = CACHEABLE_ACTIONS.includes(action);
    const isRetryableReadAction = isCacheable || RETRYABLE_READ_ACTIONS.has(action);
    let cacheKey: string | null = null;
    
    if (isCacheable) {
      // 캐시 키 생성
      const category = getActionCategory(action);
      cacheKey = generateCacheKey(category, action, data);
      
      // 캐시에서 데이터 조회
      const cachedData = await this.cacheManager.get<ApiResponse<T>>(cacheKey);
      if (cachedData && !hasIncompleteSpreadsheetIds(action, cachedData)) {
        return cachedData;
      }
      if (cachedData) await this.cacheManager.invalidate(cacheKey);

      const inFlightRequest = this.inFlightRequests.get(cacheKey);
      if (inFlightRequest) {
        return inFlightRequest as Promise<ApiResponse<T>>;
      }
    }

    // 웹앱용 요청 데이터 형식
    const requestData = {
      action,
      ...data
    };

    const requestOptions: RequestInit = {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      },
      body: JSON.stringify(requestData)
    };

    const executeRequest = async (): Promise<ApiResponse<T>> => {
      const isWriteAction = this.isWriteAction(action);
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          log.warn(`API 요청 타임아웃 (${timeout}ms):`, action);
          controller.abort();
        }, timeout);

        try {

          const response = await fetch(this.baseUrl, {
            ...requestOptions,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const retrySeconds = retryAfter ? Number.parseInt(retryAfter, 10) : NaN;
            const waitTime = Number.isFinite(retrySeconds)
              ? Math.min(retrySeconds * 1000, 60000)
              : Math.min(Math.pow(2, attempt + 2) * 1000, 60000);

            if (attempt < retries) {
              log.warn(`API 호출 제한 초과 (429). ${Math.round(waitTime / 1000)}초 후 재시도...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
            throw new Error('HTTP 429: API 호출 제한 초과. 잠시 후 다시 시도해주세요.');
          }

          if (!response.ok) {
            const responseError = new Error(`HTTP ${response.status}: ${response.statusText}`) as Error & {
              retryable?: boolean;
            };
            responseError.retryable = response.status >= 500;
            throw responseError;
          }

          const result = await response.json();

          if (isCacheable && result.success && cacheKey && !hasIncompleteSpreadsheetIds(action, result)) {
            const ttl = getCacheTTL(action);
            await this.cacheManager.set(cacheKey, result as ApiResponse<T>, ttl);
          }

          if (result.success && isWriteAction) {
            const cacheKeys = this.getCacheKeysToInvalidate(action, data);
            if (cacheKeys.length > 0 && this.dataSyncService) {
              this.dataSyncService.invalidateAndRefresh(cacheKeys).catch((err: Error) => {
                log.warn('캐시 무효화 실패:', err);
              });
            }
          }

          if (result.success) {
      // Intentionally ignored.

          } else {
            log.warn('API 응답 실패');
          }

          return result as ApiResponse<T>;
        } catch (error) {
          lastError = error as Error;
          const retryable = (error as Error & {retryable?: boolean}).retryable !== false;
          const canRetry = attempt < retries && isRetryableReadAction && !isWriteAction && retryable;
          log.warn(`API 요청 실패 (시도 ${attempt + 1}/${retries + 1}):`, error);

          if (!canRetry) throw lastError;

          const delay = Math.pow(2, attempt) * 1000;
          log.debug(`${delay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } finally {
          clearTimeout(timeoutId);
        }
      }

      throw lastError || new Error('API 요청 실패');
    };

    const requestPromise = executeRequest();
    if (!cacheKey) return requestPromise;

    this.inFlightRequests.set(cacheKey, requestPromise as Promise<ApiResponse<unknown>>);
    try {
      return await requestPromise;
    } finally {
      if (this.inFlightRequests.get(cacheKey) === requestPromise) {
        this.inFlightRequests.delete(cacheKey);
      }
    }
  }

  // 사용자 관리 API
  async getAllUsers() {
    return this.request(API_ACTIONS.GET_ALL_USERS);
  }

  async getPendingUsers() {
    return this.request(API_ACTIONS.GET_PENDING_USERS);
  }

  async approveUserWithGroup(studentId: string, groupRole: string) {
    return this.request(API_ACTIONS.APPROVE_USER_WITH_GROUP, { studentId, groupRole });
  }

  async rejectUser(studentId: string) {
    return this.request(API_ACTIONS.REJECT_USER, { studentId });
  }

  async addUsersToSpreadsheet(users: Array<{ no_member: string; name_member: string }>) {
    return this.request(API_ACTIONS.ADD_USERS_TO_SPREADSHEET, { users });
  }

  async requestPinnedAnnouncementApproval(postData: { title: string; author: string; writer_id: string; userType: string; }) {
    return this.request(API_ACTIONS.REQUEST_PINNED_ANNOUNCEMENT_APPROVAL, postData);
  }

  async clearUserCache() {
    return this.request(API_ACTIONS.CLEAR_USER_CACHE);
  }

  // 인증 API
  async checkApprovalStatus(email: string) {
    // 기존 UserAuth.gs의 checkUserStatus를 호출 (hp_member/user 시트 기반)
    return this.request<ApprovalStatusResponse>('checkUserStatus', { email });
  }

  async submitRegistrationRequest(registrationData: RegistrationData) {
    return this.request('registerUser', registrationData);
  }

  async verifyAdminKey(adminKey: string) {
    return this.request('verifyAdminKey', { adminKey });
  }

  // 관리자 키 API
  async sendAdminKeyEmail(userEmail: string) {
    return this.request(API_ACTIONS.SEND_ADMIN_KEY_EMAIL, { userEmail });
  }

  // 이메일 마이그레이션 API
  async migrateEmails() {
    return this.request(API_ACTIONS.MIGRATE_EMAILS);
  }

  // 문서 관리 API
  async createDocument(documentData: {
    title: string;
    templateType?: string;
    creatorEmail: string;
    editors?: string[];
    role?: string;
    tag?: string;
  }) {
    return this.request<CreateDocumentResponse>('createDocument', documentData);
  }

  // 이메일로 사용자 이름 조회
  async getUserNameByEmail(email: string) {
    return this.request<UserNameResponse>('getUserNameByEmail', { email });
  }

  async getTemplates() {
    return this.request('getTemplates');
  }

  async getBootstrapData(params: Record<string, unknown>) {
    type BootstrapPayload = Record<string, ApiResponse<unknown>>;
    const actions = ['getStaticTags', 'getWorkflowTemplates', 'getLedgerList', 'getTemplates', 'getAnnouncements'];
    const bootstrapPromise = this.request<BootstrapPayload>('getBootstrapData', params);

    const cachePromises = actions.map((action) => {
      const actionParams = action === 'getAnnouncements' ? params : {};
      const cacheKey = generateCacheKey(getActionCategory(action), action, actionParams);
      const actionPromise = bootstrapPromise.then(async (response) => {
        const actionResponse = response.data?.[action];
        if (actionResponse?.success) {
          await this.cacheManager.set(cacheKey, actionResponse, getCacheTTL(action));
        }
        return actionResponse || { success: false, message: `${action} 응답이 없습니다.` };
      });

      this.inFlightRequests.set(cacheKey, actionPromise as Promise<ApiResponse<unknown>>);
      const cleanup = () => {
        if (this.inFlightRequests.get(cacheKey) === actionPromise) {
          this.inFlightRequests.delete(cacheKey);
        }
      };
      void actionPromise.then(cleanup, cleanup);
      return actionPromise;
    });

    const response = await bootstrapPromise;
    await Promise.all(cachePromises);
    return response;
  }

  // 공유 템플릿 업로드(파일 업로드)
  async uploadSharedTemplate(params: {
    fileName: string;
    fileMimeType: string;
    fileContentBase64: string;
    meta: { title: string; description: string; tag: string; creatorEmail?: string };
  }) {
    return this.request('uploadSharedTemplate', params);
  }

  // 공유 템플릿 메타데이터 수정
  async updateSharedTemplateMeta(params: {
    fileId: string;
    meta: Partial<{ title: string; description: string; tag: string; creatorEmail: string }>;
  }) {
    // 사용자 이메일을 요청에 포함 (관리자 검증용)
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    return this.request('updateSharedTemplateMeta', {
      ...params,
      meta: {
        ...params.meta,
        creatorEmail: params.meta?.creatorEmail || userInfo.email
      },
      editorEmail: userInfo.email
    });
  }

  // 공유 템플릿 목록(메타데이터 우선)
  async getSharedTemplates() {
    return this.request<SharedTemplatesResponse>('getSharedTemplates');
  }

  // 공유 템플릿 삭제 (관리자 전용)
  async deleteSharedTemplate(fileId: string) {
    // 사용자 이메일을 요청에 포함 (관리자 검증용)
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    return this.request('deleteSharedTemplate', { fileId, userEmail: userInfo.email });
  }

  async testDriveApi() {
    return this.request('testDriveApi');
  }

  async testTemplateFolderDebug() {
    return this.request('testTemplateFolderDebug');
  }

  async testSpecificFolder() {
    return this.request('testSpecificFolder');
  }

  async getDocuments(params: {
    role: string;
    searchTerm?: string;
    author?: string;
    sortBy?: string;
    page?: number;
    limit?: number;
  }) {
    return this.request<DocumentsListResponse>('getDocuments', params);
  }

  async deleteDocuments(documentIds: string[], role: string) {
    return this.request('deleteDocuments', { documentIds, role });
  }

  // 공지 첨부파일 업로드 (Apps Script가 첨부 폴더에 저장하고 링크 공개)
  async uploadNoticeAttachment(params: { fileName: string; mimeType: string; fileData: string }) {
    return this.request<{ id: string; name: string; url: string }>('uploadNoticeAttachment', params);
  }

  // 스프레드시트 ID 목록 조회
  async getSpreadsheetIds(spreadsheetNames: string[]) {
    return this.request<SpreadsheetIdsResponse>('getSpreadsheetIds', { spreadsheetNames });
  }

  // 회계 관련 API
  async createLedger(data: {
    ledgerName: string;
    accountName: string;
    initialBalance: number;
    creatorEmail: string;
    accessUsers: string[];
    accessGroups: string[];
    mainManagerEmail: string;
    subManagerEmails: string[];
    /** VITE_FOLER_NAME.ACCOUNT_EVIDENCE — 장부 하위 증빙 폴더명 (GAS와 동일해야 함) */
    evidenceFolderName?: string;
  }) {
    // 호출처에서 빠져도 .env ACCOUNT_EVIDENCE가 항상 전달되도록 (GAS 스크립트 속성 증빙만 쓰이는 문제 방지)
    const evidenceFolderName =
      data.evidenceFolderName != null && String(data.evidenceFolderName).trim() !== ''
        ? String(data.evidenceFolderName).trim()
        : (ENV_CONFIG.EVIDENCE_FOLDER_NAME || 'evidence');
    return this.request('createLedger', {
      ...data,
      evidenceFolderName,
      accountEvidence: evidenceFolderName,
    });
  }

  async getLedgerList(options?: { forceRefresh?: boolean }) {
    if (options?.forceRefresh) {
      try {
        await getCacheManager().invalidate('accounting:getLedgerList:*');
      } catch (e) {
        log.warn('장부 목록 캐시 무효화 실패 (계속 진행):', e);
      }
    }
    return this.request<{ success: boolean; data: LedgerResponse[] }>('getLedgerList', {});
  }

  async updateAccountSubManagers(data: {
    spreadsheetId: string;
    accountId: string;
    subManagerEmails: string[];
  }) {
    return this.request('updateAccountSubManagers', data);
  }

  async getAccountingFolderId() {
    return this.request<{ success: boolean; data: { accountingFolderId: string } }>('getAccountingFolderId', {});
  }

  async getAccountingCategories(spreadsheetId: string) {
    return this.request<string[]>('getAccountingCategories', { spreadsheetId });
  }

  async getAccountingCategorySummary(spreadsheetId: string) {
    return this.request<{ category: string; income: number; expense: number }[]>('getAccountingCategorySummary', { spreadsheetId });
  }

  async getPendingBudgetPlans(spreadsheetId: string, userEmail: string) {
    return this.request<{ budget_id: string; title: string; total_amount: number; status: string; action_required: string }[]>('getPendingBudgetPlans', { spreadsheetId, userEmail });
  }

  // 기본 태그 목록 조회
  async getStaticTags() {
    return this.request<StaticTagsResponse>('getStaticTags');
  }

  // 기본 태그 추가 (관리자 전용)
  async addStaticTag(tag: string) {
    // 사용자 이메일을 요청에 포함
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    return this.request('addStaticTag', { tag, userEmail: userInfo.email });
  }

  // 기본 태그 수정 (관리자 전용)
  async updateStaticTag(oldTag: string, newTag: string, confirm: boolean = false) {
    // 사용자 이메일을 요청에 포함
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    if (confirm) {
      return this.request<AffectedTemplatesResponse>('updateStaticTag', { oldTag, newTag, userEmail: userInfo.email, confirm });
    } else {
      return this.request<TagImpactCheckResponse>('updateStaticTag', { oldTag, newTag, userEmail: userInfo.email, confirm });
    }
  }

  // 기본 태그 삭제 (관리자 전용)
  async deleteStaticTag(tag: string, confirm: boolean = false, deleteTemplates: boolean = false) {
    // 사용자 이메일을 요청에 포함
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    if (confirm) {
      return this.request<DeleteTagResponse>('deleteStaticTag', { tag, userEmail: userInfo.email, confirm, deleteTemplates });
    } else {
      return this.request<TagImpactCheckResponse>('deleteStaticTag', { tag, userEmail: userInfo.email, confirm, deleteTemplates });
    }
  }

  // 테스트 API
  async testEmailEncryption() {
    return this.request(API_ACTIONS.TEST_EMAIL_ENCRYPTION);
  }

  async testAllAppScript() {
    return this.request(API_ACTIONS.TEST_ALL_APP_SCRIPT);
  }

  // 간단한 연결 테스트
  async testConnection() {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      const text = await response.text();
      log.debug('연결 테스트 내용:', text.substring(0, 200));
      return { success: true, status: response.status, data: text };
    } catch (error) {
      log.error('연결 테스트 실패:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  // ===== 워크플로우 관련 API =====

  // 워크플로우 요청
  async requestWorkflow(data: WorkflowRequestData) {
    return this.request<WorkflowRequestResponse>('requestWorkflow', data);
  }

  // 워크플로우 라인 설정
  async setWorkflowLine(data: SetWorkflowLineData) {
    return this.request('setWorkflowLine', data);
  }

  // 문서 권한 부여
  async grantWorkflowPermissions(data: GrantWorkflowPermissionsData) {
    return this.request('grantWorkflowPermissions', data);
  }

  // 검토 단계 승인
  async approveReview(data: ReviewActionData) {
    return this.request<WorkflowInfoResponse>('approveReview', data);
  }

  // 검토 단계 반려
  async rejectReview(data: ReviewActionData) {
    return this.request<WorkflowInfoResponse>('rejectReview', data);
  }

  // 검토 단계 보류
  async holdReview(data: ReviewActionData) {
    return this.request<WorkflowInfoResponse>('holdReview', data);
  }

  // 결재 단계 승인
  async approvePayment(data: PaymentActionData) {
    return this.request<WorkflowInfoResponse>('approvePayment', data);
  }

  // 결재 단계 반려
  async rejectPayment(data: PaymentActionData) {
    return this.request<WorkflowInfoResponse>('rejectPayment', data);
  }

  // 결재 단계 보류
  async holdPayment(data: PaymentActionData) {
    return this.request<WorkflowInfoResponse>('holdPayment', data);
  }

  // 워크플로우 상태 조회
  async getWorkflowStatus(params: {
    workflowId?: string;
    documentId?: string;
    workflowDocumentId?: string;
  }) {
    return this.request<WorkflowInfoResponse>('getWorkflowStatus', params);
  }

  // 내 담당 워크플로우 조회
  async getMyPendingWorkflows(params: MyPendingWorkflowsParams) {
    return this.request<WorkflowListResponse>('getMyPendingWorkflows', params);
  }

  // 내가 올린 결재 목록 조회
  async getMyRequestedWorkflows(userEmail: string) {
    return this.request<WorkflowListResponse>('getMyRequestedWorkflows', { userEmail });
  }

  // 결재 완료된 리스트 조회
  async getCompletedWorkflows(params: {
    userEmail: string;
    startDate?: string;
    endDate?: string;
  }) {
    return this.request<WorkflowListResponse>('getCompletedWorkflows', params);
  }

  // 워크플로우 재제출
  async resubmitWorkflow(data: {
    workflowId: string;
    userEmail: string;
    userName?: string;
    workflowTitle?: string;
    workflowContent?: string;
    reviewLine?: Array<{ step: number; email: string; name?: string }>;  // 재제출 시 새로운 검토 라인
    paymentLine?: Array<{ step: number; email: string; name?: string }>;  // 재제출 시 새로운 결재 라인
  }) {
    return this.request<WorkflowInfoResponse>('resubmitWorkflow', data);
  }

  // 워크플로우 이력 조회
  async getWorkflowHistory(params: WorkflowHistoryParams) {
    return this.request('getWorkflowHistory', params);
  }

  // 워크플로우 템플릿 목록 조회
  async getWorkflowTemplates() {
    return this.request<WorkflowTemplatesListResponse>('getWorkflowTemplates');
  }

  // 워크플로우 템플릿 생성 (관리자 전용)
  async createWorkflowTemplate(data: {
    templateName: string;
    documentTag: string;
    reviewLine: Array<{ step: number; email: string; name: string }>;
    paymentLine: Array<{ step: number; email: string; name: string }>;
    isDefault?: boolean;
    description?: string;
  }) {
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    return this.request<WorkflowTemplateResponse>('createWorkflowTemplate', {
      ...data,
      creatorEmail: userInfo.email || userInfo.google_member || ''
    });
  }

  // 워크플로우 템플릿 수정 (관리자 전용)
  async updateWorkflowTemplate(data: {
    templateId: string;
    templateName?: string;
    documentTag?: string;
    reviewLine?: Array<{ step: number; email: string; name: string }>;
    paymentLine?: Array<{ step: number; email: string; name: string }>;
    isDefault?: boolean;
    description?: string;
  }) {
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    return this.request<WorkflowTemplateResponse>('updateWorkflowTemplate', {
      ...data,
      userEmail: userInfo.email || userInfo.google_member || ''
    });
  }

  // 워크플로우 템플릿 삭제 (관리자 전용)
  async deleteWorkflowTemplate(templateId: string) {
    const userInfo = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    return this.request('deleteWorkflowTemplate', {
      templateId,
      userEmail: userInfo.email || userInfo.google_member || ''
    });
  }

  // ===== 학생 취업관리 API (로그인 없이 / 학생관리 탭) =====

  /** 로그인 없이 학번·이름·전화번호로 본인 확인 (info 시트 기준) */
  async validateStudentForEmployment(params: {
    spreadsheetId?: string;
    std_num: string;
    name: string;
    phone: string;
  }) {
    return this.request<{ success: boolean; message?: string; name?: string; std_num?: string }>(
      'validateStudentForEmployment',
      { spreadsheetId: params.spreadsheetId, std_num: params.std_num, name: params.name, phone: params.phone }
    );
  }

  /** 학번으로 취업 정보 한 건 조회 */
  async getEmploymentByStdNum(spreadsheetId: string | undefined, std_num: string) {
    return this.request<{ success: boolean; data: import('../../types/features/students/employment').EmploymentRow | null; message?: string }>(
      'getEmploymentByStdNum',
      { spreadsheetId, std_num }
    );
  }

  /** 취업 정보 저장 (신규 추가 또는 같은 학번 행 덮어쓰기) */
  async saveEmployment(
    spreadsheetId: string | undefined,
    payload: import('../../types/features/students/employment').EmploymentRow
  ) {
    return this.request<{ success: boolean; message?: string }>('saveEmployment', { spreadsheetId, payload });
  }

  /** 취업 후만 수정 (com_name, occ_category, question) - 학생관리에서 사용 */
  async updateEmploymentAfter(
    spreadsheetId: string,
    std_num: string,
    payload: import('../../types/features/students/employment').EmploymentAfterUpdate
  ) {
    return this.request<{ success: boolean; message?: string }>('updateEmploymentAfter', {
      spreadsheetId,
      std_num,
      payload
    });
  }

  /** 직종 분야 목록 (field 시트) */
  async getFieldList(spreadsheetId?: string) {
    return this.request<{ success: boolean; data: import('../../types/features/students/employment').EmploymentField[] }>(
      'getFieldList',
      { spreadsheetId }
    );
  }

  /** 직종 분야 추가 (관리자 전용) */
  async createField(
    spreadsheetId: string,
    field_num: string,
    field_name: string,
    userEmail: string
  ) {
    return this.request<{ success: boolean; message?: string }>('createField', {
      spreadsheetId,
      field_num,
      field_name,
      userEmail
    });
  }

  /** 직종 분야 수정 (관리자 전용) */
  async updateField(
    spreadsheetId: string,
    field_num: string,
    field_name: string,
    userEmail: string
  ) {
    return this.request<{ success: boolean; message?: string }>('updateField', {
      spreadsheetId,
      field_num,
      field_name,
      userEmail
    });
  }

  /** 직종 분야 삭제 (관리자 전용) */
  async deleteField(spreadsheetId: string, field_num: string, userEmail: string) {
    return this.request<{ success: boolean; message?: string }>('deleteField', {
      spreadsheetId,
      field_num,
      userEmail
    });
  }

  /** 졸업 학년 조회 */
  async getGraduationGrade(spreadsheetId: string) {
    return this.request<number>('getGraduationGrade', { spreadsheetId });
  }

  /** 졸업 학년 설정 (조교만) */
  async setGraduationGrade(spreadsheetId: string, grade: number, userEmail: string) {
    return this.request<number>('setGraduationGrade', { spreadsheetId, grade, userEmail });
  }

  /** 학년 갱신 (재학생만 학년+1, 졸업학년 초과 시 졸업 처리, 유급 제외) */
  async updateStudentGrades(
    spreadsheetId: string,
    params?: { graduationGrade?: number; graduationYear?: number; graduationTerm?: string }
  ) {
    const payload: Record<string, unknown> = { spreadsheetId };
    if (params?.graduationGrade != null) payload.graduationGrade = params.graduationGrade;
    if (params?.graduationYear != null) payload.graduationYear = params.graduationYear;
    if (params?.graduationTerm != null) payload.graduationTerm = params.graduationTerm;
    return this.request<{
      updatedCount: number;
      graduatedCount: number;
      skippedCount: number;
      graduatedStudents?: Array<{ no_student: string; name: string; grade: string }>;
    }>(
      'updateStudentGrades',
      payload
    );
  }

  /** 선택 학생만 학년 갱신 */
  async updateStudentGradesSelected(
    spreadsheetId: string,
    studentIds: string[],
    params?: { graduationGrade?: number; graduationYear?: number; graduationTerm?: string }
  ) {
    const payload: Record<string, unknown> = { spreadsheetId, studentIds };
    if (params?.graduationGrade != null) payload.graduationGrade = params.graduationGrade;
    if (params?.graduationYear != null) payload.graduationYear = params.graduationYear;
    if (params?.graduationTerm != null) payload.graduationTerm = params.graduationTerm;
    return this.request<{
      touchedCount: number;
      updatedCount: number;
      graduatedCount: number;
      skippedCount: number;
      graduatedStudents?: Array<{ no_student: string; name: string; grade: string }>;
    }>('updateStudentGradesSelected', payload);
  }

  /** 이번 졸업 대상 중 진학자 표시 반영 */
  async setGraduatedAdvanced(
    spreadsheetId: string,
    graduatedStudentIds: string[],
    advancedStudentIds: string[]
  ) {
    return this.request<{
      updatedCount: number;
      advancedCount: number;
    }>('setGraduatedAdvanced', {
      spreadsheetId,
      graduatedStudentIds,
      advancedStudentIds
    });
  }

  // ========== 캐시 무효화 관련 메서드 ==========

  /**
   * 쓰기 작업 여부 판단
   */
  private isWriteAction(action: string): boolean {
    const writeActions = [
      // 문서 관리
      'createDocument', 'deleteDocuments',
      'uploadSharedDocument', 'uploadSharedTemplate', 'updateSharedTemplateMeta', 'deleteSharedTemplate',
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
      'registerUser', 'approveUserWithGroup', 'rejectUser', 'addUsersToSpreadsheet',
      'requestPinnedAnnouncementApproval',
      'requestPinnedAnnouncement',
      'createAnnouncement',
      'updateAnnouncement',
      'deleteAnnouncement',
      'incrementAnnouncementView',
      'approvePinnedAnnouncement',
      
      // 기타
      'migrateEmails', 'clearUserCache',
      // 학생 취업관리
      'saveEmployment', 'updateEmploymentAfter', 'createField', 'updateField', 'deleteField',
      // 학년/유급
      'updateStudentRetained', 'setGraduationGrade', 'updateStudentGrades', 'setGraduatedAdvanced',
    ];
    return writeActions.includes(action);
  }

  /**
   * 낙관적 업데이트: 캐시에 먼저 데이터를 업데이트하여 UI가 즉시 반영되도록 함
   * @param action - API 액션
   * @param cacheKeys - 업데이트할 캐시 키 목록
   * @param updateFn - 캐시 데이터를 업데이트하는 함수
   * @returns 롤백 함수 (실패 시 호출)
   */
  async optimisticUpdate<T = unknown>(
    action: string,
    cacheKeys: string[],
    updateFn: (cachedData: T | null) => T | null
  ): Promise<() => Promise<void>> {
    const cacheManager = this.cacheManager;
    const backups: Map<string, T | null> = new Map();
    const processedKeys: string[] = [];

    // 각 캐시 키에 대해 백업 및 업데이트
    for (const key of cacheKeys) {
      try {
        if (key.includes('*')) {
          // 와일드카드 패턴인 경우: 모든 매칭되는 키 찾기
          const regex = new RegExp('^' + key.replace(/\*/g, '.*') + '$');
          const cacheStats = cacheManager.getStats();
          
          // 메모리 캐시에서 매칭되는 키 찾기
          cacheStats.memoryCacheKeys.forEach(matchedKey => {
            if (regex.test(matchedKey) && !processedKeys.includes(matchedKey)) {
              processedKeys.push(matchedKey);
            }
          });
        } else {
          // 정확한 키인 경우
          if (!processedKeys.includes(key)) {
            processedKeys.push(key);
          }
        }
      } catch (error) {
        log.warn("캐시 키 처리 실패 (", error);
      }
    }

    // 처리된 키들에 대해 백업 및 업데이트
    for (const key of processedKeys) {
      try {
        // 기존 데이터 백업
        const existingData = await cacheManager.get<T>(key);
        backups.set(key, existingData);

        // 낙관적 업데이트 적용
        const updatedData = updateFn(existingData);
        if (updatedData !== null) {
          const category = getActionCategory(action);
          const ttl = getCacheTTL(action);
          await cacheManager.set(key, updatedData, ttl);
        }
      } catch (error) {
        log.warn("낙관적 업데이트 실패 (", error);
      }
    }

    // 롤백 함수 반환
    return async () => {
      for (const [key, backup] of backups.entries()) {
        try {
          if (backup === null) {
            // 원래 데이터가 없었으면 캐시에서 제거
            await cacheManager.invalidate(key);
          } else {
            // 원래 데이터로 복원
            const category = getActionCategory(action);
            const ttl = getCacheTTL(action);
            await cacheManager.set(key, backup, ttl);
          }
        } catch (error) {
          log.error("롤백 실패 (", error);
        }
      }
    };
  }

  /**
   * 액션별 무효화할 캐시 키 매핑
   */
  private getCacheKeysToInvalidate(action: string, data: any): string[] {
    const cacheKeyMap: Record<string, (data: any) => string[]> = {
      // 문서 관리
      'createDocument': () => ['documents:getDocuments:*', 'documents:getAllDocuments:{}'],
      'deleteDocuments': () => ['documents:getDocuments:*', 'documents:getAllDocuments:{}'],
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
        'workflow:getMyPendingWorkflows:*',
        `workflow:getMyRequestedWorkflows:{"userEmail":"${d.requesterEmail || ''}"}`
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
      'requestPinnedAnnouncementApproval': () => ['announcements:getAnnouncements:*', 'announcements:fetchAnnouncements:*'],
      'requestPinnedAnnouncement': () => ['announcements:getAnnouncements:*', 'announcements:fetchAnnouncements:*'],
      'createAnnouncement': () => ['announcements:getAnnouncements:*', 'announcements:fetchAnnouncements:*'],
      'updateAnnouncement': () => ['announcements:getAnnouncements:*', 'announcements:fetchAnnouncements:*'],
      'deleteAnnouncement': () => ['announcements:getAnnouncements:*', 'announcements:fetchAnnouncements:*'],
      'approvePinnedAnnouncement': () => ['announcements:getAnnouncements:*', 'announcements:fetchAnnouncements:*'],
    };
    
    const getKeys = cacheKeyMap[action];
    return getKeys ? getKeys(data) : [];
  }
}

// 싱글톤 인스턴스
export const apiClient = new ApiClient();

// 기존 API 함수들과의 호환성을 위한 래퍼 함수들
export const sendAdminKeyEmail = (userEmail: string) =>
  apiClient.sendAdminKeyEmail(userEmail);

export const fetchAllUsers = () =>
  apiClient.getAllUsers();

export const fetchPendingUsers = () =>
  apiClient.getPendingUsers();

export const approveUserWithGroup = (studentId: string, groupRole: string) =>
  apiClient.approveUserWithGroup(studentId, groupRole);

export const rejectUser = (userId: string) =>
  apiClient.rejectUser(userId);

export const clearUserCache = () =>
  apiClient.clearUserCache();

export const checkUserRegistrationStatus = (email: string) =>
  apiClient.checkApprovalStatus(email);

export const registerUser = (registrationData: RegistrationData) =>
  apiClient.submitRegistrationRequest(registrationData);

export const verifyAdminKey = (adminKey: string) =>
  apiClient.verifyAdminKey(adminKey);
