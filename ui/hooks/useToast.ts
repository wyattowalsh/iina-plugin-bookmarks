import { useState, useCallback } from 'react';
import { ToastMessage } from '../components/Toast';

export interface UseToastReturn {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => string;
  showSuccess: (title: string, message?: string, duration?: number) => string;
  showError: (title: string, message?: string, duration?: number) => string;
  showWarning: (title: string, message?: string, duration?: number) => string;
  showInfo: (title: string, message?: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const useToast = (): UseToastReturn => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id = generateId();
      const newToast: ToastMessage = {
        id,
        duration: 5000, // Default 5 seconds
        ...toast,
      };

      const MAX_TOASTS = 5;
      setToasts((prev) => {
        const next = [...prev, newToast];
        return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
      });
      return id;
    },
    [generateId],
  );

  const showSuccess = useCallback(
    (title: string, message?: string, duration = 4000) => {
      return showToast({
        type: 'success',
        title,
        message,
        duration,
      });
    },
    [showToast],
  );

  const showError = useCallback(
    (title: string, message?: string, duration = 8000) => {
      return showToast({
        type: 'error',
        title,
        message,
        duration,
      });
    },
    [showToast],
  );

  const showWarning = useCallback(
    (title: string, message?: string, duration = 6000) => {
      return showToast({
        type: 'warning',
        title,
        message,
        duration,
      });
    },
    [showToast],
  );

  const showInfo = useCallback(
    (title: string, message?: string, duration = 5000) => {
      return showToast({
        type: 'info',
        title,
        message,
        duration,
      });
    },
    [showToast],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    dismissToast,
    clearAllToasts,
  };
};

export default useToast;
