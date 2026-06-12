import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { ToastType } from '@/types';

const toastIcons: Record<ToastType, React.ReactNode> = {
  error: <AlertCircle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-yellow-400" />,
  success: <CheckCircle size={18} className="text-green-400" />,
  info: <Info size={18} className="text-blue-400" />,
};

const toastStyles: Record<ToastType, string> = {
  error: 'bg-red-900/90 border-red-700',
  warning: 'bg-yellow-900/90 border-yellow-700',
  success: 'bg-green-900/90 border-green-700',
  info: 'bg-blue-900/90 border-blue-700',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useStore();

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg animate-slide-in ${toastStyles[toast.type]}`}
          style={{ minWidth: '280px' }}
        >
          {toastIcons[toast.type]}
          <span className="text-white text-sm flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
