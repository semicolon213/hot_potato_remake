/**
 * @file ErrorFallback.tsx
 * @brief 데이터 로드 실패 시 공통 폴백 UI (메시지 + 재시도 버튼)
 * @details API/데이터 로드 실패 시 재사용 가능한 컴포넌트입니다.
 */

import React from 'react';
import { getApiErrorMessage } from '../../utils/errors/errorMessages';
import './ErrorFallback.css';

export interface ErrorFallbackProps {
  /** 사용자에게 보여줄 메시지. 생략 시 error로부터 자동 유도 */
  message?: string;
  /** 재시도 안내 문구 (예: "몇 분 후 다시 시도해 주세요.") */
  retryHint?: string;
  /** 원본 에러. 전달 시 getApiErrorMessage로 메시지/힌트 유도 */
  error?: unknown;
  /** 재시도 버튼 클릭 시 호출. 없으면 버튼 미표시 */
  onRetry?: () => void;
  /** 제목. 기본값 "데이터를 불러올 수 없습니다" */
  title?: string;
  /** 컴팩트 스타일 (작은 패딩) */
  compact?: boolean;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  message: messageProp,
  retryHint: retryHintProp,
  error,
  onRetry,
  title = '데이터를 불러올 수 없습니다',
  compact = false,
}) => {
  const resolved =
    messageProp !== undefined && retryHintProp !== undefined
      ? { message: messageProp, retryHint: retryHintProp }
      : error !== undefined
        ? getApiErrorMessage(error)
        : { message: messageProp ?? '일시적인 오류가 발생했습니다.', retryHint: retryHintProp };

  const message = resolved.message;
  const retryHint = resolved.retryHint;

  return (
    <div className={`error-fallback ${compact ? 'error-fallback--compact' : ''}`} role="alert">
      <h3 className="error-fallback-title">{title}</h3>
      <p className="error-fallback-message">{message}</p>
      {retryHint && <p className="error-fallback-hint">{retryHint}</p>}
      {onRetry && (
        <button type="button" className="button button-primary error-fallback-retry" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
};
