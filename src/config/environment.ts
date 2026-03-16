/**
 * @file environment.ts
 * @brief 환경변수 설정 파일 (V2 JSON 형식)
 * @details VITE_FOLER_NAME, VITE_SPREADSHEET_NAME, VITE_SHEET_NAME, VITE_GROUP_EMAIL JSON을
 *          파싱하여 ENV_CONFIG로 노출합니다. 기존 키 이름을 유지해 호환성을 보장합니다.
 * @author Hot Potato Team
 * @date 2024
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

// ========== JSON 기본값 (.env 미설정 시 사용) ==========
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
  CONFIG: 'user_setting',
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
  EMPLOYMENT: 'employment',
  FIELD: 'field',
};

const DEFAULT_GROUP_EMAIL: Record<string, string> = {
  STUDENT: 'student_hp@googlegroups.com',
  PROFESSOR: 'professor_hp@googlegroups.com',
  COUNCIL: 'std_council_hp@googlegroups.com',
  ADJ_PROFESSOR: 'adj_professor_hp@googlegroups.com',
  ASSISTANT: 'assistant_hp@googlegroups.com',
};

// ========== 파싱 결과 ==========
const FOLER = getEnvJson('VITE_FOLER_NAME', DEFAULT_FOLER);
const SPREADSHEET = getEnvJson('VITE_SPREADSHEET_NAME', DEFAULT_SPREADSHEET);
const SHEET = getEnvJson('VITE_SHEET_NAME', DEFAULT_SHEET);
const GROUP_EMAIL = getEnvJson('VITE_GROUP_EMAIL', DEFAULT_GROUP_EMAIL);

/**
 * @brief 환경변수 설정 객체 (기존 키 이름 유지)
 * @details V2 JSON 기반으로 파싱하며, 기존 ENV_CONFIG 키와 호환됩니다.
 */
export const ENV_CONFIG = {
  // Google API
  GOOGLE_CLIENT_ID: getEnvVar('VITE_GOOGLE_CLIENT_ID'),
  APP_SCRIPT_URL: getEnvVar('VITE_APP_SCRIPT_URL'),

  // 스프레드시트 이름 (기존 키 유지)
  HOT_POTATO_DB_SPREADSHEET_NAME: SPREADSHEET.CONFIG ?? 'user_setting',
  ANNOUNCEMENT_SPREADSHEET_NAME: SPREADSHEET.NOTICE ?? 'notice',
  CALENDAR_PROFESSOR_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_PROFESSOR ?? 'calendar_professor',
  CALENDAR_COUNCIL_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_COUNCIL ?? 'calendar_council',
  CALENDAR_ADPROFESSOR_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_ADJ_PROFESSOR ?? 'calendar_adj_professor',
  CALENDAR_SUPP_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_ASSISTANT ?? 'calendar_assistant',
  CALENDAR_STUDENT_SPREADSHEET_NAME: SPREADSHEET.CALENDAR_STUDENT ?? 'calendar_student',
  STUDENT_SPREADSHEET_NAME: SPREADSHEET.STUDENT ?? 'student',
  STAFF_SPREADSHEET_NAME: SPREADSHEET.STAFF ?? 'staff',

  // 시트 이름 (기존 키 유지)
  ANNOUNCEMENT_SHEET_NAME: SHEET.DEFAULT ?? '시트1',
  CALENDAR_SHEET_NAME: SHEET.DEFAULT ?? '시트1',
  STUDENT_SHEET_NAME: SHEET.INFO ?? 'info',
  STUDENT_ISSUE_SHEET_NAME: SHEET.ISSUE ?? 'std_issue',
  STUDENT_EMPLOYMENT_SHEET_NAME: SHEET.EMPLOYMENT ?? 'employment',
  STUDENT_FIELD_SHEET_NAME: SHEET.FIELD ?? 'field',
  STAFF_INFO_SHEET_NAME: SHEET.INFO ?? 'info',
  STAFF_COMMITTEE_SHEET_NAME: SHEET.COMMITTEE ?? 'committee',
  DASHBOARD_SHEET_NAME: SHEET.CONFIG_DASHBOARD ?? 'dashboard',
  MENU_SHEET_NAME: '', // V2에 없음, 호환용

  // 개인 설정 시트 (personalConfigManager, personalTagManager, personalFavoriteManager용)
  CONFIG_FAVORITE_SHEET_NAME: SHEET.CONFIG_FAVORITE ?? 'favorite',
  CONFIG_TAG_SHEET_NAME: SHEET.CONFIG_TAG ?? 'tag',
  CONFIG_SCHEDULE_SHEET_NAME: SHEET.CONFIG_SCHEDULE ?? 'schedule',

  // 워크플로우 시트
  WORKFLOW_TEMPLATE_SHEET_NAME: SHEET.WORKFLOW_TEMPLATE ?? 'workflow_templates',
  WORKFLOW_HISTORY_SHEET_NAME: SHEET.WORKFLOW_HISTORY ?? 'workflow_history',
  WORKFLOW_DOCUMENT_SHEET_NAME: SHEET.WORKFLOW_DOCUMENT ?? 'workflow_documents',

  // 그룹 이메일
  GROUP_EMAILS: {
    STUDENT: GROUP_EMAIL.STUDENT ?? '',
    COUNCIL: GROUP_EMAIL.COUNCIL ?? '',
    PROFESSOR: GROUP_EMAIL.PROFESSOR ?? '',
    ADJUNCT_PROFESSOR: GROUP_EMAIL.ADJ_PROFESSOR ?? '',
    ASSISTANT: GROUP_EMAIL.ASSISTANT ?? '',
  },

  // Drive 폴더
  ROOT_FOLDER_NAME: FOLER.ROOT ?? 'hot_potato_remake',
  DOCUMENT_FOLDER_NAME: FOLER.DOCUMENT ?? 'document',
  SHARED_DOCUMENT_FOLDER_NAME: FOLER.S_DOC ?? 'shared_documents',
  PERSONAL_DOCUMENT_FOLDER_NAME: FOLER.P_DOC ?? 'personal_documents',
  TEMPLATE_FOLDER_NAME: FOLER.S_TEMP ?? 'shared_forms',
  SHARED_TEMPLATE_FOLDER_NAME: FOLER.S_TEMP ?? 'shared_forms',
  PERSONAL_TEMPLATE_FOLDER_NAME: FOLER.P_TEMP ?? 'personal_forms',
  ACCOUNTING_FOLDER_NAME: FOLER.ACCOUNT ?? 'account',
  EVIDENCE_FOLDER_NAME: FOLER.ACCOUNT_EVIDENCE ?? 'evidence',
  NOTICE_ATTACH_FOLDER_NAME: FOLER.NOTICE_ATTACH ?? 'attached_file',

  // 개인 설정 파일 이름
  PERSONAL_CONFIG_FILE_NAME: SPREADSHEET.CONFIG ?? 'user_setting',
} as const;

/**
 * @brief 환경변수 검증 함수
 */
export const validateEnvironmentVariables = (): boolean => {
  const c = ENV_CONFIG;
  const required = [
    c.GOOGLE_CLIENT_ID,
    c.APP_SCRIPT_URL,
    c.ROOT_FOLDER_NAME,
    c.DOCUMENT_FOLDER_NAME,
    c.SHARED_DOCUMENT_FOLDER_NAME,
    c.PERSONAL_DOCUMENT_FOLDER_NAME,
    c.SHARED_TEMPLATE_FOLDER_NAME,
    c.PERSONAL_TEMPLATE_FOLDER_NAME,
    c.ANNOUNCEMENT_SPREADSHEET_NAME,
    c.CALENDAR_PROFESSOR_SPREADSHEET_NAME,
    c.CALENDAR_COUNCIL_SPREADSHEET_NAME,
    c.CALENDAR_ADPROFESSOR_SPREADSHEET_NAME,
    c.CALENDAR_SUPP_SPREADSHEET_NAME,
    c.CALENDAR_STUDENT_SPREADSHEET_NAME,
    c.STUDENT_SPREADSHEET_NAME,
    c.STAFF_SPREADSHEET_NAME,
  ];
  const missing = required.filter((v) => !v);
  if (missing.length > 0) {
    console.error('❌ 필수 환경변수가 설정되지 않았습니다.');
    console.error('현재 설정:', {
      GOOGLE_CLIENT_ID: c.GOOGLE_CLIENT_ID ? '설정됨' : '미설정',
      APP_SCRIPT_URL: c.APP_SCRIPT_URL ? '설정됨' : '미설정',
    });
    return false;
  }
  console.log('✅ 필수 환경변수 검증 통과');
  return true;
};
