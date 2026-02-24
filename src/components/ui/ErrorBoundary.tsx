/**
 * @file ErrorBoundary.tsx
 * @brief 전역 에러 바운더리 컴포넌트
 * @details 렌더 중 예외 발생 시 fallback UI를 표시하고 새로고침/다시 시도 옵션을 제공합니다.
 * @author Hot Potato Team
 * @date 2024
 */

import React from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary" role="alert">
          <div className="error-boundary-content">
            <h2 className="error-boundary-title">오류가 발생했습니다</h2>
            <p className="error-boundary-message">
              일시적인 문제일 수 있습니다. 다시 시도하거나 페이지를 새로고침해 주세요.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre className="error-boundary-details">{this.state.error.message}</pre>
            )}
            <div className="error-boundary-actions">
              <button type="button" className="button button-primary" onClick={this.handleRetry}>
                다시 시도
              </button>
              <button type="button" className="button button-secondary" onClick={this.handleReload}>
                새로고침
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
