import React from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "neutral" | "primary";
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={onClose}
            className="rounded-full flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant={
              variant === "neutral"
                ? "primary"
                : variant === "primary"
                  ? "primary"
                  : "danger"
            }
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="rounded-full flex-1"
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-slate-600 font-bold text-center leading-relaxed">
        {message}
      </p>
    </Modal>
  );
};
