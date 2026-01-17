import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppNotification } from "../types";
import { Info, CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";

interface ToastContainerProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  notifications,
  onDismiss,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 pointer-events-none flex flex-col items-center gap-2 safe-area-top">
      <AnimatePresence>
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
};

const Toast: React.FC<{
  notification: AppNotification;
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  useEffect(() => {
    if (notification.duration && notification.duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.duration);
      return () => clearTimeout(timer);
    }
  }, [notification, onDismiss]);

  const getIcon = () => {
    switch (notification.type) {
      case "success":
        return <CheckCircle size={20} className="text-green-400" />;
      case "warning":
        return <AlertTriangle size={20} className="text-yellow-400" />;
      case "error":
        return <XCircle size={20} className="text-red-400" />;
      default:
        return <Info size={20} className="text-cyan-400" />;
    }
  };

  const getStyles = () => {
    switch (notification.type) {
      case "success":
        return "bg-slate-800 border-green-500/50 shadow-green-500/10";
      case "warning":
        return "bg-slate-800 border-yellow-500/50 shadow-yellow-500/10";
      case "error":
        return "bg-slate-800 border-red-500/50 shadow-red-500/10";
      default:
        return "bg-slate-800 border-cyan-500/50 shadow-cyan-500/10";
    }
  };

  return (
    <motion.div
      initial={{ y: -50, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ x: 100, opacity: 0, scale: 0.9 }}
      drag="x"
      dragConstraints={{ left: 0, right: 300 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) {
          onDismiss(notification.id);
        }
      }}
      layout
      className={`pointer-events-auto w-full max-w-sm rounded-xl border p-4 shadow-lg flex items-center gap-3 backdrop-blur-sm cursor-grab active:cursor-grabbing ${getStyles()}`}
    >
      <div className="shrink-0">{getIcon()}</div>
      <div className="flex-1 text-sm font-medium text-white break-words">
        {notification.message}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0 text-slate-400 hover:text-white"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
};
