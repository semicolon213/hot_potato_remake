import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmModal } from '../../components/ui/NotificationModal';

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onCancel?: () => void;
}

interface ConfirmState extends Omit<ConfirmOptions, 'onCancel'> {
  isOpen: boolean;
  message: string;
  onConfirm?: () => void;
  onCancelAction?: () => void;
}

interface ConfirmContextValue {
  confirm: ConfirmState;
  showConfirm: (message: string, onConfirm: () => void, options?: ConfirmOptions) => void;
  confirmAsync: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  hideConfirm: () => void;
  handleConfirm: () => void;
}

const GlobalConfirmContext = createContext<ConfirmContextValue | null>(null);

export const GlobalConfirmProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [confirm, setConfirm] = useState<ConfirmState>({ isOpen: false, message: '', type: 'info' });
  const pendingResult = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const resolve = pendingResult.current;
    pendingResult.current = null;
    resolve?.(confirmed);
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void, options?: ConfirmOptions) => {
    settle(false);
    setConfirm({
      isOpen: true,
      message,
      onConfirm,
      title: options?.title,
      confirmText: options?.confirmText || '확인',
      cancelText: options?.cancelText || '취소',
      type: options?.type || 'info',
      onCancelAction: options?.onCancel
    });
  }, [settle]);

  const confirmAsync = useCallback((message: string, options?: ConfirmOptions) => new Promise<boolean>((resolve) => {
    settle(false);
    pendingResult.current = resolve;
    setConfirm({
      isOpen: true,
      message,
      title: options?.title,
      confirmText: options?.confirmText || '확인',
      cancelText: options?.cancelText || '취소',
      type: options?.type || 'info',
      onCancelAction: options?.onCancel
    });
  }), [settle]);

  const hideConfirm = useCallback(() => {
    const onCancel = confirm.onCancelAction;
    setConfirm((state) => ({ ...state, isOpen: false }));
    onCancel?.();
    settle(false);
  }, [confirm.onCancelAction, settle]);

  const handleConfirm = useCallback(() => {
    const onConfirm = confirm.onConfirm;
    setConfirm((state) => ({ ...state, isOpen: false }));
    onConfirm?.();
    settle(true);
  }, [confirm.onConfirm, settle]);

  return (
    <GlobalConfirmContext.Provider value={{ confirm, showConfirm, confirmAsync, hideConfirm, handleConfirm }}>
      {children}
      <ConfirmModal
        isOpen={confirm.isOpen}
        message={confirm.message}
        title={confirm.title}
        confirmText={confirm.confirmText}
        cancelText={confirm.cancelText}
        type={confirm.type}
        onConfirm={handleConfirm}
        onCancel={hideConfirm}
      />
    </GlobalConfirmContext.Provider>
  );
};

export const useGlobalConfirm = (): ConfirmContextValue | null => useContext(GlobalConfirmContext);
