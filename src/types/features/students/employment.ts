/**
 * 학생 취업관리 타입 (employment, field 시트)
 */

/** field 시트: 직종 분야 (관리자 관리) */
export interface EmploymentField {
  field_num: string;
  field_name: string;
}

/** employment 시트: 취업 정보 한 행 */
export interface EmploymentRow {
  std_num: string;
  is_major: boolean;
  field_num: string;
  com_name: string;
  occ_category: string;
  /** JSON 파싱 텍스트 (질문 남기기) */
  question: string;
}

/** 취업 후만 수정 시 사용 */
export interface EmploymentAfterUpdate {
  com_name: string;
  occ_category: string;
  question: string;
}
