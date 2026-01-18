import React, { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { useDoubleTap } from "../hooks/useDoubleTap";
import { Trash2 } from "lucide-react";

interface kickModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKick: () => void;
  onKickPermanently: () => void;
  playerName: string;
}

export const KickModal: React.FC<kickModalProps> = ({
  isOpen,
  onClose,
  onKick,
  onKickPermanently,
  playerName,
}) => {
  const [step, setStep] = useState(0);

  const STEPS = [
    {
      title: "Kick Hard?",
      message: "This will BAN them. Like, forever. Are you sure?",
      button: "Yes, I'm angry",
      color: "bg-red-500 hover:bg-red-500",
    },
    {
      title: "Really Hard?",
      message: "They won't be able to come back. Not even to say sorry.",
      button: "I said YES",
      color: "bg-red-600 hover:bg-red-600",
    },
    {
      title: "Super Duper Hard?",
      message:
        "We're talking digital exile here. A cold, dark void awaits them.",
      button: "DO IT",
      color: "bg-red-700 hover:bg-red-700",
    },
    {
      title: "Maximum Over-Hard?",
      message:
        "Are you absolutely, 100%, positively certain? There is no turning back!",
      button: "FINISH HIM",
      color: "bg-red-800 hover:bg-red-800",
    },
    {
      title: "Just Kidding... Right?",
      message:
        "C'mon man, you're just joking hahaha, you got me. Just kick is enough, right?",
      button: "NO! BAN THEM!",
      color: "bg-black hover:bg-black",
      showMercy: true,
    },
  ];

  const handleHardClick = () => {
    if (step < STEPS.length - 1) {
      setStep((prev) => prev + 1);
    } else {
      onKickPermanently();
      onClose();
    }
  };

  const currentStep = STEPS[step];

  if (step > 0) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setStep(0);
          onClose(); // Or should it just reset step? User probably wants to cancel specific action
          // If close, then close modal.
        }}
        title={currentStep.title}
        footer={
          <div className="flex flex-col gap-2 w-full">
            {currentStep.showMercy && (
              <Button
                variant="primary"
                fullWidth
                className="bg-dreamy-yellow text-slate-800 hover:bg-dreamy-yellow/80 border-transparent mb-2 py-4 text-lg animate-pulse rounded-full"
                onClick={() => {
                  onKick();
                  onClose();
                }}
              >
                Okay, fine. Just Kick. 😅
              </Button>
            )}
            <div className="flex gap-2 w-full">
              <Button
                variant="ghost"
                className="flex-1 rounded-full"
                onClick={() => setStep(0)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className={`flex-1 text-white ${currentStep.color} border-transparent shadow-lg rounded-full`}
                onClick={handleHardClick}
              >
                {currentStep.button}
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 text-center py-4">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce shadow-inner">
            <Trash2 size={40} />
          </div>
          <p className="font-black text-xl text-slate-800 leading-snug">
            {currentStep.message}
          </p>
          <div className="flex justify-center gap-1 mt-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i <= step ? "w-8 bg-red-500" : "w-2 bg-slate-200"
                }`}
              />
            ))}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Kick ${playerName}?`}
      footer={
        <div className="flex flex-col gap-2 w-full">
          <div className="flex gap-2 w-full">
            <Button
              variant="ghost"
              className="flex-1 rounded-full"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1 rounded-full"
              onClick={() => setStep(1)}
              size="default"
            >
              Kick Hard (Ban)
            </Button>
          </div>
          <Button
            variant="primary"
            fullWidth
            className="mt-2 rounded-full bg-dreamy-yellow hover:bg-dreamy-yellow/80 text-slate-800 border-transparent"
            onClick={() => {
              onKick();
              onClose();
            }}
          >
            Kick
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-slate-600 font-bold text-center leading-relaxed">
          Select method of removal for {playerName}.
        </p>
        <div className="text-xs text-center space-y-2 text-slate-400">
          <p>
            <span className="font-black text-dreamy-yellow">Kick:</span> Removed
            from session, can rejoin.
          </p>
          <p>
            <span className="font-black text-red-500">Kick Hard:</span> The
            nuclear option.
          </p>
        </div>
      </div>
    </Modal>
  );
};
