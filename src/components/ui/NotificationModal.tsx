import React, { useEffect, useRef, useCallback } from 'react';
import { FaCheckCircle, FaTimesCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';
import './NotificationModal.css';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

// React 19 호환성을 위한 타입 단언
const CheckCircleIcon = FaCheckCircle as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const TimesCircleIcon = FaTimesCircle as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const ExclamationTriangleIcon = FaExclamationTriangle as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const InfoCircleIcon = FaInfoCircle as React.ComponentType<React.SVGProps<SVGSVGElement>>;
const TimesIcon = FaTimes as React.ComponentType<React.SVGProps<SVGSVGElement>>;

interface NotificationModalProps {
  isOpen: boolean;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  onClose: () => void;
  duration?: number; // 자동 닫기 시간 (ms), 0이면 자동 닫기 안 함
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  message,
  type = 'info',
  onClose,
  duration = 3000
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });
    } else {
      previousActiveRef.current?.focus?.();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !contentRef.current) return;
      const focusable = getFocusableElements(contentRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay notification-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label="알림"
        aria-describedby="notification-message-id"
        aria-live="polite"
        className={`modal-content notification-modal notification-${type}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="notification-icon" aria-hidden>
          {type === 'success' && <CheckCircleIcon />}
          {type === 'error' && <TimesCircleIcon />}
          {type === 'warning' && <ExclamationTriangleIcon />}
          {type === 'info' && <InfoCircleIcon />}
        </div>
        <div id="notification-message-id" className="notification-message">
          {message}
        </div>
        <button
          type="button"
          ref={closeButtonRef}
          className="notification-close"
          onClick={onClose}
          aria-label="닫기"
        >
          <TimesIcon />
        </button>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
  onCancelAction?: () => void; // 취소 버튼 클릭 시 실행할 추가 액션
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  message,
  title,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  type = 'info',
  onCancelAction
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => {
        confirmRef.current?.focus();
      });
    } else {
      previousActiveRef.current?.focus?.();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || !contentRef.current) return;
      const focusable = getFocusableElements(contentRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onCancel]
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = async () => {
    if (onCancelAction) {
      await onCancelAction();
    }
    onCancel();
  };

  const dialogTitleId = 'confirm-modal-title';
  const dialogDescId = 'confirm-modal-desc';

  return (
    <div className="modal-overlay confirm-modal-overlay" onClick={onCancel} role="presentation">
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? dialogTitleId : undefined}
        aria-describedby={dialogDescId}
        aria-label={!title ? '확인' : undefined}
        className={`modal-content confirm-modal confirm-${type}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {title && (
          <div id={dialogTitleId} className="confirm-modal-title">
            {title}
          </div>
        )}
        <div id={dialogDescId} className="confirm-modal-message">
          {message}
        </div>
        <div className="confirm-modal-buttons">
          <button
            type="button"
            ref={confirmRef}
            className={`confirm-button confirm-primary ${type === 'danger' ? 'danger-button' : 'primary-button'}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
          <button
            type="button"
            className="confirm-button cancel-button"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

