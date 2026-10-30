/**
 * hp_member의 user_type(std_council, ad_professor)을 캘린더 코드의 역할 키(council, ADprofessor)로 맞춘다.
 * 그룹 선택지, 참석자 저장 형식, 저장 캘린더 선택, 표시 필터가 모두 이 키를 쓴다.
 */
const CALENDAR_ROLE_ALIASES: Record<string, string> = {
  std_council: 'council',
  ad_professor: 'ADprofessor',
  support: 'supp'
};

export const toCalendarRole = (userType?: string | null): string =>
  userType ? CALENDAR_ROLE_ALIASES[userType] ?? userType : '';
