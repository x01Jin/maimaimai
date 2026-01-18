import React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-dreamy-dark/30 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="w-full max-w-sm glass-card rounded-3xl shadow-2xl overflow-hidden relative"
          >
            <div className="flex justify-between items-center p-5 border-b border-white/40">
              <h3 className="text-lg font-black text-dreamy-dark tracking-tight leading-none">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/50 text-slate-500 hover:bg-white hover:text-dreamy-dark transition-all shadow-sm"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 text-dreamy-dark">{children}</div>

            {footer && (
              <div className="p-4 bg-white/20 border-t border-white/40 flex justify-end gap-2 px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
