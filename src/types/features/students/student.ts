import type { CareerItem } from '../staff';

export interface Student {
  no_student: string;
  name: string;
  address: string;
  phone_num: string;
  grade: string;
  state: string;
  council: string;
  flunk?: string; // 유급 필드
  grad_year?: string; // 졸업 연도
  grad_term?: string; // 졸업 회차 (전기/후기)
  advanced?: string; // 진학 여부 플래그 (O면 진학)
}

export interface CouncilPosition {
  year: string;
  position: string;
}

export interface StudentWithCouncil extends Student {
  parsedCouncil: CouncilPosition[];
  career?: CareerItem[];
}
