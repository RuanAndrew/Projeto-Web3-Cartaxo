import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setToast(null);
  }, []);

  const showToast = useCallback((message, duration = 3500) => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    setToast({
      id: Date.now(),
      message,
    });

    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        dismissToast,
      }}
    >
      {children}

      {toast && (
        <div
          key={toast.id}
          className="toast"
          role="status"
          aria-live="polite"
        >
          <span>{toast.message}</span>

          <button
            type="button"
            aria-label="Fechar notificação"
            onClick={dismissToast}
          >
            ×
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error(
      "useToast deve ser utilizado dentro de ToastProvider."
    );
  }

  return context;
}