/**
 * @file errorMessages.ts
 * @brief API/데이터 로드 실패 시 사용자 메시지 및 재시도 안내
 * @details 429, 네트워크 오류 등 유형별 일관된 문구를 정의합니다.
 */

export const ERROR_MESSAGES = {
  /** API 호출 제한 초과 (429) */
  RATE_LIMIT: {
    message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    retryHint: '몇 분 후 새로고침하거나 다시 시도해 주세요.',
  },
  /** 네트워크 연결 실패 */
  NETWORK: {
    message: '네트워크 연결을 확인해 주세요.',
    retryHint: '인터넷 연결 후 다시 시도해 주세요.',
  },
  /** 일반 오류 */
  GENERIC: {
    message: '일시적인 오류가 발생했습니다.',
    retryHint: '다시 시도해 주세요.',
  },
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;

/**
 * API/ fetch 에러를 분석해 사용자용 메시지와 재시도 안내를 반환합니다.
 */
export function getApiErrorMessage(error: unknown): {
  message: string;
  retryHint?: string;
} {
  if (!error || typeof error !== 'object') {
    return ERROR_MESSAGES.GENERIC;
  }
  const err = error as Error & { status?: number; code?: string };
  const msg = (err.message || '').toLowerCase();

  if (err.status === 429 || err.code === '429' || msg.includes('429') || msg.includes('호출 제한')) {
    return ERROR_MESSAGES.RATE_LIMIT;
  }
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('networkerror') ||
    err.name === 'TypeError'
  ) {
    return ERROR_MESSAGES.NETWORK;
  }
  return {
    message: err.message && err.message.length < 120 ? err.message : ERROR_MESSAGES.GENERIC.message,
    retryHint: ERROR_MESSAGES.GENERIC.retryHint,
  };
}
