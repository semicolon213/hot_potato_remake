/**
 * @file environment.ts (Mock)
 * @brief Jest 테스트 환경용 환경변수 모킹 파일
 * @details 테스트 환경에서 사용할 환경변수 모킹을 제공합니다.
 */

export const ENV_CONFIG = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  APP_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec',
  PAPYRUS_DB_URL: '',
  PAPYRUS_DB_API_KEY: 'test-api-key',

  HOT_POTATO_DB_SPREADSHEET_NAME: 'user_config',
  ANNOUNCEMENT_SPREADSHEET_NAME: 'notice',
  CALENDAR_PROFESSOR_SPREADSHEET_NAME: 'calendar_professor',
  CALENDAR_COUNCIL_SPREADSHEET_NAME: 'calendar_council',
  CALENDAR_ADPROFESSOR_SPREADSHEET_NAME: 'calendar_adj_professor',
  CALENDAR_SUPP_SPREADSHEET_NAME: 'calendar_assistant',
  CALENDAR_STUDENT_SPREADSHEET_NAME: 'calendar_student',
  STUDENT_SPREADSHEET_NAME: 'student',
  STAFF_SPREADSHEET_NAME: 'staff',

  ANNOUNCEMENT_SHEET_NAME: '시트1',
  CALENDAR_SHEET_NAME: '시트1',
  STUDENT_SHEET_NAME: 'info',
  STUDENT_ISSUE_SHEET_NAME: 'std_issue',
  STAFF_INFO_SHEET_NAME: 'info',
  STAFF_COMMITTEE_SHEET_NAME: 'committee',
  DASHBOARD_SHEET_NAME: 'dashboard',
  MENU_SHEET_NAME: '',
  CONFIG_FAVORITE_SHEET_NAME: 'favorite',
  CONFIG_TAG_SHEET_NAME: 'tag',
  CONFIG_SCHEDULE_SHEET_NAME: 'schedule',

  WORKFLOW_TEMPLATE_SHEET_NAME: 'workflow_templates',
  WORKFLOW_HISTORY_SHEET_NAME: 'workflow_history',
  WORKFLOW_DOCUMENT_SHEET_NAME: 'workflow_documents',

  GROUP_EMAILS: {
    STUDENT: '',
    COUNCIL: '',
    PROFESSOR: '',
    ADJUNCT_PROFESSOR: '',
    ASSISTANT: '',
  },

  ROOT_FOLDER_NAME: 'hot_potato_remake',
  DOCUMENT_FOLDER_NAME: 'document',
  SHARED_DOCUMENT_FOLDER_NAME: 'shared_documents',
  PERSONAL_DOCUMENT_FOLDER_NAME: 'personal_documents',
  TEMPLATE_FOLDER_NAME: 'shared_forms',
  SHARED_TEMPLATE_FOLDER_NAME: 'shared_forms',
  PERSONAL_TEMPLATE_FOLDER_NAME: 'personal_forms',
  ACCOUNTING_FOLDER_NAME: 'account',
  EVIDENCE_FOLDER_NAME: 'evidence',
  NOTICE_ATTACH_FOLDER_NAME: 'attached_file',

  PERSONAL_CONFIG_FILE_NAME: 'user_config',
} as const;

export const validateEnvironmentVariables = (): boolean => {
  console.log('✅ 모든 필수 환경변수가 설정되었습니다. (Mock)');
  return true;
};