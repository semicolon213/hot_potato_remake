import { useState, useCallback } from 'react';
import { useGlobalConfirm } from './GlobalConfirmProvider';

interface NotificationState {
  isOpen: boolean;
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  duration?: number;
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  title?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm?: () => void;
  onCancelAction?: () => void;
}

export const useNotification = () => {
  const globalConfirm = useGlobalConfirm();
  const [notification, setNotification] = useState<NotificationState>({
    isOpen: false,
    message: '',
    type: 'info',
    duration: 3000
  });

  const [localConfirm, setLocalConfirm] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  const showNotification = useCallback((
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' = 'info',
    duration: number = 3000
  ) => {
    setNotification({
      isOpen: true,
      message,
      type,
      duration
    });
  }, []);

  const hideNotification = useCallback(() => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  }, []);

  const showLocalConfirm = useCallback((
    message: string,
    onConfirm: () => void,
    options?: {
      title?: string;
      confirmText?: string;
      cancelText?: string;
      type?: 'danger' | 'warning' | 'info';
      onCancel?: () => void;
    }
  ) => {
    setLocalConfirm({
      isOpen: true,
      message,
      onConfirm,
      title: options?.title,
      confirmText: options?.confirmText || '확인',
      cancelText: options?.cancelText || '취소',
      type: options?.type || 'info',
      onCancelAction: options?.onCancel
    });
  }, []);

  const hideLocalConfirm = useCallback(() => {
    setLocalConfirm(prev => ({ ...prev, isOpen: false }));
    localConfirm.onCancelAction?.();
  }, [localConfirm.onCancelAction]);

  const handleLocalConfirm = useCallback(() => {
    if (localConfirm.onConfirm) {
      localConfirm.onConfirm();
    }
    setLocalConfirm(prev => ({ ...prev, isOpen: false }));
  }, [localConfirm]);

  const showConfirm = globalConfirm?.showConfirm || showLocalConfirm;
  const hideConfirm = globalConfirm?.hideConfirm || hideLocalConfirm;
  const handleConfirm = globalConfirm?.handleConfirm || handleLocalConfirm;
  const confirm = globalConfirm?.confirm || localConfirm;
  const confirmAsync = globalConfirm?.confirmAsync || ((message: string, options?: {
    title?: string; confirmText?: string; cancelText?: string; type?: 'danger' | 'warning' | 'info'; onCancel?: () => void;
  }) => new Promise<boolean>((resolve) => {
    showLocalConfirm(message, () => resolve(true), { ...options, onCancel: () => { options?.onCancel?.(); resolve(false); } });
  }));

  return {
    notification,
    confirm,
    showNotification,
    hideNotification,
    showConfirm,
    confirmAsync,
    hideConfirm,
    handleConfirm
  };
};

