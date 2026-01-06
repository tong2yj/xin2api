import { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';

// Toast 上下文
const ToastContext = createContext(null);

// 使用 Toast 的 Hook
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Toast 类型配置
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle,
    className: 'bg-green-500/10 border-green-500/30 text-green-400',
    iconClass: 'text-green-400',
  },
  error: {
    icon: XCircle,
    className: 'bg-red-500/10 border-red-500/30 text-red-400',
    iconClass: 'text-red-400',
  },
  warning: {
    icon: AlertCircle,
    className: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    iconClass: 'text-amber-400',
  },
  info: {
    icon: Info,
    className: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    iconClass: 'text-blue-400',
  },
};

// 单个 Toast 组件
function Toast({ id, type, message, onClose }) {
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${config.className} animate-in slide-in-from-right duration-300`}
    >
      <Icon size={20} className={config.iconClass} />
      <span className="flex-1">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="text-gray-400 hover:text-white p-1"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Toast 容器
function ToastContainer({ toasts, onClose }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-md">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}

// Toast 提供者
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }

    return id;
  }, [removeToast]);

  const toast = {
    success: (message, duration) => addToast('success', message, duration),
    error: (message, duration) => addToast('error', message, duration),
    warning: (message, duration) => addToast('warning', message, duration),
    info: (message, duration) => addToast('info', message, duration),
    remove: removeToast,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export default ToastContext;
