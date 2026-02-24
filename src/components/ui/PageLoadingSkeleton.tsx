/**
 * @file PageLoadingSkeleton.tsx
 * @brief 페이지 전환 시 Suspense fallback용 스켈레톤 UI
 */

import React from 'react';
import './PageLoadingSkeleton.css';

export const PageLoadingSkeleton: React.FC = () => (
  <div className="page-loading-skeleton" aria-hidden>
    <div className="page-loading-skeleton__bar page-loading-skeleton__bar--title" />
    <div className="page-loading-skeleton__bar page-loading-skeleton__bar--line" />
    <div className="page-loading-skeleton__bar page-loading-skeleton__bar--line" />
    <div className="page-loading-skeleton__bar page-loading-skeleton__bar--short" />
    <div className="page-loading-skeleton__cards">
      <div className="page-loading-skeleton__card" />
      <div className="page-loading-skeleton__card" />
      <div className="page-loading-skeleton__card" />
    </div>
  </div>
);
