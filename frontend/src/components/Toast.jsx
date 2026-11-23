import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Configuración por tipo ───────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: {
    icon: CheckCircle2,
    bar:  'bg-limefish-500',
    ring: 'ring-limefish-400/40',
    iconCls: 'text-limefish-400',
    label: 'Éxito',
  },
  error: {
    icon: XCircle,
    bar:  'bg-aji-500',
    ring: 'ring-aji-400/40',
    iconCls: 'text-aji-400',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    bar:  'bg-amber-400',
    ring: 'ring-amber-400/40',
    iconCls: 'text-amber-300',
    label: 'Aviso',
  },
  info: {
    icon: Info,
    bar:  'bg-ocean-400',
    ring: 'ring-ocean-400/40',
    iconCls: 'text-ocean-300',
    label: 'Info',
  },
};

const DURATION = 4000; // ms antes del auto-dismiss

// ─── Toast individual ─────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const cfg = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = cfg.icon;
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onDismiss(toast.id), 350); // espera la animación de salida
  }, [toast.id, onDismiss]);

  useEffect(() => {
    // slide-in
    const rAF = requestAnimationFrame(() => setVisible(true));
    // auto-dismiss
    timerRef.current = setTimeout(dismiss, DURATION);
    return () => {
      cancelAnimationFrame(rAF);
      clearTimeout(timerRef.current);
    };
  }, [dismiss]);

  return (
    <div
      className={`
        relative flex items-start gap-3 w-80 max-w-[92vw]
        bg-ocean-900/95 backdrop-blur-sm text-white
        rounded-2xl shadow-2xl ring-1 ${cfg.ring}
        px-4 py-3 overflow-hidden
        transition-all duration-350 ease-out
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
      `}
    >
      {/* Barra lateral de color */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg.bar} rounded-l-2xl`} />

      {/* Ícono */}
      <div className="mt-0.5 shrink-0">
        <Icon size={22} className={cfg.iconCls} strokeWidth={2.2} />
      </div>

      {/* Texto */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-bold leading-tight text-white truncate">
            {toast.title}
          </p>
        )}
        {toast.message && (
          <p className="text-xs text-ocean-200 leading-snug mt-0.5 line-clamp-3">
            {toast.message}
          </p>
        )}
      </div>

      {/* Botón cerrar */}
      <button
        onClick={dismiss}
        className="shrink-0 mt-0.5 text-ocean-400 hover:text-white transition-colors"
        aria-label="Cerrar notificación"
      >
        <X size={16} />
      </button>

      {/* Barra de progreso */}
      <div
        className={`absolute bottom-0 left-1 right-0 h-0.5 ${cfg.bar} origin-left`}
        style={{ animation: `toast-shrink ${DURATION}ms linear forwards` }}
      />
    </div>
  );
}

// ─── Contenedor de toasts ─────────────────────────────────────────────────────
export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div
      className="fixed bottom-5 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ─── Hook useToast ────────────────────────────────────────────────────────────
let _counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((type, title, message) => {
    const id = ++_counter;
    setToasts(prev => [...prev, { id, type, title, message }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { showToast, toasts, dismissToast };
}
