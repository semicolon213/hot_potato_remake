/**
 * @file environmentV2.ts
 * @brief 환경변수 설정 (ver.2) - 임시 파일
 * @details env(ver.2) 형식(VITE_FOLER_NAME, VITE_SPREADSHEET_NAME, VITE_SHEET_NAME, VITE_GROUP_EMAIL JSON)을
 *          파싱하여 기존 ENV_CONFIG와 동일한 키로 노출합니다. 나중에 environment.ts를 이 구조로 교체할 때 사용.
 * @author Hot Potato Team
 */

// ========== 환경변수 읽기 (테스트/실제 환경 공통) ==========
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    return process.env[key] || defaultValue;
  }
  if (typeof window !== 'undefined' && import.meta?.env) {
    return (import.meta.env[key] as string) || defaultValue;
  }
  return defaultValue;
};

/** JSON 문자열 env 파싱. 실패 시 defaultValue 반환 */
function getEnvJson<T extends Record<string, string>>(
  key: string,
  defaultValue: T
): T {
  const raw = getEnvVar(key);
  if (!raw || typeof raw !== 'string') return defaultValue;
  try {
    const parsed = JSON.parse(raw) as T;
    return typeof parsed === 'object' && parsed !== null ? { ...defaultValue, ...parsed } : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ========== ver.2 JSON 기본값 (env 미설정 시 사용 나중에 삭제할 것) ==========
const DEFAULT_FOLER: Record<string, string> = {
  ROOT: 'hot_potato_remake',

  DOCUMENT: 'document',
  S_DOC: 'shared_documents',
  P_DOC: 'personal_documents',
  S_TEMP: 'shared_forms',
  P_TEMP: 'personal_forms',

  WORKFLOW: 'workflow',

  ACCOUNT: 'account',
  ACCOUNT_EVIDENCE: 'evidence',

  NOTICE_ATTACH: 'attached_file',
};

const DEFAULT_SPREADSHEET: Record<string, string> = {
  CONFIG: 'user_config',

  NOTICE: 'notice',

  CALENDAR_PROFESSOR: 'calendar_professor',
  CALENDAR_STUDENT: 'calendar_student',
  CALENDAR_COUNCIL: 'calendar_council',
  CALENDAR_ADJ_PROFESSOR: 'calendar_adj_professor',
  CALENDAR_ASSISTANT: 'calendar_assistant',

  STUDENT: 'student',
  STAFF: 'staff',

  TAG: 'static_tag',
};

const DEFAULT_SHEET: Record<string, string> = {
  DEFAULT: '시트1',

  WORKFLOW_TEMPLATE: 'workflow_templates',
  WORKFLOW_HISTORY: 'workflow_history',
  WORKFLOW_DOCUMENT: 'workflow_documents',

  INFO: 'info',
  ISSUE: 'std_issue',
  COMMITTEE: 'committee',

  CONFIG_FAVORITE: 'favorite',
  CONFIG_TAG: 'tag',
  CONFIG_DASHBOARD: 'dashboard',
  CONFIG_SCHEDULE: 'schedule',
};

const DEFAULT_GROUP_EMAIL: Record<string, string> = {
  STUDENT: 'student_hp@googlegroups.com',
  PROFESSOR: 'professor_hp@googlegroups.com',
  COUNCIL: 'std_council_hp@googlegroups.com',
  ADJ_PROFESSOR: 'adj_professor_hp@googlegroups.com',
  ASSISTANT: 'assistant_hp@googlegroups.com',
};

// ========== 파싱 결과 (한 번만 파싱) ==========
const FOLER = getEnvJson('VITE_FOLER_NAME', DEFAULT_FOLER);
const SPREADSHEET = getEnvJson('VITE_SPREADSHEET_NAME', DEFAULT_SPREADSHEET);
const SHEET = getEnvJson('VITE_SHEET_NAME', DEFAULT_SHEET);
const GROUP_EMAIL = getEnvJson('VITE_GROUP_EMAIL', DEFAULT_GROUP_EMAIL);

/**
 * env(ver.2) 기반 설정.
 * 기존 ENV_CONFIG와 동일한 키를 유지해, 나중에 import만 바꾸면 되도록 함.
 * - 개인 설정 파일: hot_potato_DB → user_config (CONFIG)
 * - notice: 단일 시트 → 시트 이름은 DEFAULT(시트1)
 * - menu: 제거 (MENU_SHEET_NAME은 빈 문자열로 호환용 유지)
 */
export const ENV_CONFIG_V2 = {
  GOOGLE_CLIENT_ID: getEnvVar('VITE_GOOGLE_CLIENT_ID'),
  APP_SCRIPT_URL: getEnvVar('VITE_APP_SCRIPT_URL'),

  // 스프레드시트 이름 (VITE_SPREADSHEET_NAME)
  NOTICE_SPREADSHEET_NAME: SPREADSHEET.NOTICE ?? 'error',

  CALENDAR_PROFESSOR_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_PROFESSOR ?? 'error',
  CALENDAR_COUNCIL_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_COUNCIL ?? 'error',
  CALENDAR_ADJ_PROFESSOR_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_ADJ_PROFESSOR ?? 'error',
  CALENDAR_ASSISTANT_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_ASSISTANT ?? 'error',
  CALENDAR_STUDENT_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_STUDENT ?? 'error',
  
  STUDENT_SPREADSHEET_NAME: SPREADSHEET.STUDENT ?? 'error',
  STAFF_SPREADSHEET_NAME: SPREADSHEET.STAFF ?? 'error',

  TAG_SPREADSHEET_NAME: SPREADSHEET.TAG ?? 'error',

  // 시트 이름 (VITE_SHEET_NAME). notice 단일 시트 → DEFAULT 사용
  DEFAULT_SHEET_NAME: SHEET.DEFAULT ?? 'error',
  
  WORKFLOW_TEMPLATE_SHEET_NAME: SHEET.WORKFLOW_TEMPLATE ?? 'error',
  WORKFLOW_HISTORY_SHEET_NAME: SHEET.WORKFLOW_HISTORY ?? 'error',
  WORKFLOW_DOCUMENT_SHEET_NAME: SHEET.WORKFLOW_DOCUMENT ?? 'error',

  INFO_SHEET_NAME: SHEET.INFO ?? 'error',
  ISSUE_SHEET_NAME: SHEET.ISSUE ?? 'error',
  COMMITTEE_SHEET_NAME: SHEET.COMMITTEE ?? 'error',

  CONFIG_FAVORITE_SHEET_NAME: SHEET.CONFIG_FAVORITE ?? 'error',
  CONFIG_TAG_SHEET_NAME: SHEET.CONFIG_TAG ?? 'error',
  CONFIG_DASHBOARD_SHEET_NAME: SHEET.CONFIG_DASHBOARD ?? 'error',
  CONFIG_SCHEDULE_SHEET_NAME: SHEET.CONFIG_SCHEDULE ?? 'error',

  // 그룹 이메일 (VITE_GROUP_EMAIL). ADJ_PROFESSOR → ADJUNCT_PROFESSOR 별칭
  GROUP_EMAILS: {
    STUDENT: GROUP_EMAIL.STUDENT ?? 'error',
    COUNCIL: GROUP_EMAIL.COUNCIL ?? 'error',
    PROFESSOR: GROUP_EMAIL.PROFESSOR ?? 'error',
    ADJUNCT_PROFESSOR: GROUP_EMAIL.ADJ_PROFESSOR ?? 'error',
    ASSISTANT: GROUP_EMAIL.ASSISTANT ?? 'error',
  },

  // Drive 폴더 (VITE_FOLER_NAME)
  ROOT_FOLDER_NAME: FOLER.ROOT ?? 'error',

  WORKFLOW_FOLDER_NAME: FOLER.WORKFLOW ?? 'error',

  DOCUMENT_FOLDER_NAME: FOLER.DOCUMENT ?? 'error',
  SHARED_DOCUMENT_FOLDER_NAME: FOLER.S_DOC ?? 'error',
  PERSONAL_DOCUMENT_FOLDER_NAME: FOLER.P_DOC ?? 'error',
  SHARED_TEMPLATE_FOLDER_NAME: FOLER.S_TEMP ?? 'error',
  PERSONAL_TEMPLATE_FOLDER_NAME: FOLER.P_TEMP ?? 'error',

  ACCOUNT_FOLDER_NAME: FOLER.ACCOUNT ?? 'error',
  EVIDENCE_FOLDER_NAME: FOLER.ACCOUNT_EVIDENCE ?? 'error',
  
  NOTICE_ATTACH_FOLDER_NAME: FOLER.NOTICE_ATTACH ?? 'error',

  // 개인 설정 파일 이름: hot_potato_DB → user_config (CONFIG)
  PERSONAL_CONFIG_FILE_NAME: SPREADSHEET.CONFIG ?? 'error',
} as const;

/**
 * ver.2 필수 항목 검증 (JSON에서 온 값이 비어 있지 않은지 확인)
 */
export const validateEnvironmentVariablesV2 = (): boolean => {
  const c = ENV_CONFIG_V2;
  const required = [
    c.GOOGLE_CLIENT_ID,
    c.APP_SCRIPT_URL,

    c.ROOT_FOLDER_NAME,

    c.DOCUMENT_FOLDER_NAME,
    c.SHARED_DOCUMENT_FOLDER_NAME,
    c.PERSONAL_DOCUMENT_FOLDER_NAME,
    c.SHARED_TEMPLATE_FOLDER_NAME,
    c.PERSONAL_TEMPLATE_FOLDER_NAME,

    c.WORKFLOW_FOLDER_NAME,

    c.ACCOUNT_FOLDER_NAME,
    c.EVIDENCE_FOLDER_NAME,

    c.NOTICE_ATTACH_FOLDER_NAME,

    c.PERSONAL_CONFIG_FILE_NAME,
    
    c.NOTICE_SPREADSHEET_NAME,

    c.CALENDAR_PROFESSOR_SPREADSHEET_NAME,
    c.CALENDAR_COUNCIL_SPREADSHEET_NAME,
    c.CALENDAR_ADJ_PROFESSOR_SPREADSHEET_NAME,
    c.CALENDAR_ASSISTANT_SPREADSHEET_NAME,
    c.CALENDAR_STUDENT_SPREADSHEET_NAME,

    c.STUDENT_SPREADSHEET_NAME,
    c.STAFF_SPREADSHEET_NAME,

    c.TAG_SPREADSHEET_NAME,

    c.DEFAULT_SHEET_NAME,

    c.WORKFLOW_TEMPLATE_SHEET_NAME,
    c.WORKFLOW_HISTORY_SHEET_NAME,
    c.WORKFLOW_DOCUMENT_SHEET_NAME,

    c.INFO_SHEET_NAME,
    c.ISSUE_SHEET_NAME,
    c.COMMITTEE_SHEET_NAME,

    c.CONFIG_FAVORITE_SHEET_NAME,
    c.CONFIG_TAG_SHEET_NAME,
    c.CONFIG_DASHBOARD_SHEET_NAME,
    c.CONFIG_SCHEDULE_SHEET_NAME,

    c.GROUP_EMAILS.STUDENT,
    c.GROUP_EMAILS.COUNCIL,
    c.GROUP_EMAILS.PROFESSOR,
    c.GROUP_EMAILS.ADJUNCT_PROFESSOR,
    c.GROUP_EMAILS.ASSISTANT
  ];
  const missing = required.filter((v) => !v);
  if (missing.length > 0) {
    console.error('❌ [ENV_CONFIG_V2] 필수 환경변수 미설정:', missing.length);
    return false;
  }
  console.log('✅ [ENV_CONFIG_V2] 필수 환경변수 검증 통과');
  return true;
};
