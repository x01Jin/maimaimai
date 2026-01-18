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
    <div className="fixed top-4 left-0 right-0 z-[100] p-4 pointer-events-none flex flex-col items-center gap-3 safe-area-top">
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
        return <CheckCircle size={20} className="text-emerald-500" />;
      case "warning":
        return <AlertTriangle size={20} className="text-amber-500" />;
      case "error":
        return <XCircle size={20} className="text-red-500" />;
      default:
        return <Info size={20} className="text-dreamy-blue" />;
    }
  };

  const getStyles = () => {
    switch (notification.type) {
      case "success":
        return "border-emerald-200/50";
      case "warning":
        return "border-amber-200/50";
      case "error":
        return "border-red-200/50";
      default:
        return "border-dreamy-blue/30";
    }
  };

  return (
    <motion.div
      initial={{ y: -20, opacity: 0, scale: 0.9 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      layout
      drag="x"
      dragConstraints={{ left: -100, right: 100 }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80) {
          onDismiss(notification.id);
        }
      }}
      className={`pointer-events-auto w-full max-w-[280px] glass-card rounded-2xl border-2 p-3 shadow-lg flex items-center gap-3 cursor-grab active:cursor-grabbing ${getStyles()}`}
    >
      <div className="shrink-0">{getIcon()}</div>
      <div className="flex-1 text-sm font-black text-dreamy-dark break-words">
        {notification.message}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="p-1.5 hover:bg-white/50 rounded-full transition-colors shrink-0 text-slate-400 hover:text-dreamy-dark"
      >
        <X size={14} />
      </button>
    </motion.div>
  );
};
