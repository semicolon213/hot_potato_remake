/**
 * @file OfflineBanner.tsx
 * @brief 오프라인 시 상단 배너
 */

import React from 'react';
import './OfflineBanner.css';

interface OfflineBannerProps {
  isOnline: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOnline }) => {
  if (isOnline) return null;
  return (
    <div className="offline-banner" role="alert" aria-live="polite">
      <span className="offline-banner-text">
        오프라인입니다. 네트워크 연결을 확인해 주세요.
      </span>
    </div>
  );
};
