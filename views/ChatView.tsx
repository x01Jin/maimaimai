import React, { useState, useRef, useEffect } from "react";
import { Send, Smile, Reply, X, Check, Ban, Zap } from "lucide-react";
import { GameState, ChatMessage } from "../types";
import { useDoubleTap } from "../hooks/useDoubleTap";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { motion, AnimatePresence } from "framer-motion";

interface ChatViewProps {
  gameState: GameState;
  myId: string;
  myUuid: string;
  onSend: (
    content: string,
    replyToId?: string,
    type?: "text",
    metadata?: ChatMessage["metadata"],
  ) => void;
  onVote: (approve: boolean) => void;
  onModDecision: (voteId: string, decision: "APPROVE" | "REJECT") => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReact: (messageId: string, emoji: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  gameState,
  myId,
  myUuid,
  onSend,
  onVote,
  onModDecision,
  onReact,
  onRemoveReact,
}) => {
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(
    null,
  );
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: "danger" | "primary";
    confirmText: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: "primary",
    confirmText: "Confirm",
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialScrollRef = useRef(true);
  const { activeVote, messages = [] } = gameState || {};

  // Handle scrolling to bottom
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;

      if (isInitialScrollRef.current) {
        // Instant jump for first mount
        container.style.scrollBehavior = "auto";
        container.scrollTop = container.scrollHeight;
        isInitialScrollRef.current = false;

        // Use a small delay to re-enable smooth scrolling for future messages if desired
        // But for now, let's keep it consistent
        const timeout = setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.style.scrollBehavior = "smooth";
          }
        }, 50);
        return () => clearTimeout(timeout);
      } else {
        // Smooth scroll for new messages
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages]);

  // Handle immediate scroll on viewport resize (keyboard opening)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        // Immediate scroll to bottom on keyboard, bypass smooth
        const originalBehavior = container.style.scrollBehavior;
        container.style.scrollBehavior = "auto";
        container.scrollTop = container.scrollHeight;
        container.style.scrollBehavior = originalBehavior;
      }
    };

    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && !replyingTo) return;
    onSend(input, replyingTo?.id);
    setInput("");
    setReplyingTo(null);
    inputRef.current?.blur(); // Force keyboard to close
  };

  const emojiList = [
    "❤️",
    "😂",
    "😮",
    "😢",
    "🔥",
    "😠",
    "💀",
    "🎉",
    "👍",
    "⚡",
  ];

  const renderContent = (msg: ChatMessage) => {
    const parts = msg.content.split(/(@\w+)/g);
    return (
      <span className="whitespace-pre-wrap font-medium">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            const name = part.substring(1);
            const player = gameState.players.find((p) => p.name === name);
            if (player) {
              const isMe = player.uuid === myUuid;
              return (
                <span
                  key={i}
                  className={`font-black px-1.5 py-0.5 rounded-lg ${isMe ? "text-white bg-dreamy-blue" : "text-dreamy-blue bg-dreamy-blue/10 border border-dreamy-blue/20"}`}
                >
                  {part}
                </span>
              );
            }
          }
          return part;
        })}
      </span>
    );
  };

  const hasVoted = !!activeVote?.approvals?.includes(myId);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const myPlayerName =
    gameState.players.find((p) => p.uuid === myUuid)?.name || "";

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden font-sans">
      <AnimatePresence>
        {activeVote && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-4 left-4 right-4 z-30"
          >
            <div className="glass-card rounded-3xl p-3 shadow-xl border-2 border-white flex flex-col gap-2.5">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 border-white shadow-sm ${activeVote.type === "DEMOTE_MOD" ? "bg-red-100 text-red-500" : "bg-dreamy-yellow/10 text-dreamy-yellow"}`}
                  >
                    {activeVote.type === "DEMOTE_MOD" ? (
                      <Ban size={20} />
                    ) : (
                      <Zap size={20} />
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-dreamy-dark mb-0.5">
                      {activeVote.type === "DEMOTE_MOD"
                        ? "Mod Demotion!"
                        : "Solo Request!"}
                    </div>
                    <div className="font-black text-dreamy-dark leading-tight">
                      {activeVote.requesterName}
                    </div>
                  </div>
                </div>

                <div className="text-right glass-card bg-white px-2.5 py-1 rounded-xl border-white border">
                  <div className="text-[8px] font-black text-dreamy-slate uppercase tracking-widest leading-none mb-1">
                    YES
                  </div>
                  <div className="text-lg font-black text-dreamy-dark leading-none tabular-nums flex items-center gap-1 justify-end">
                    {activeVote.approvals.length}
                    <span className="text-slate-400 text-xs">/</span>
                    {activeVote.required}
                  </div>
                </div>
              </div>

              <div className="flex items-stretch gap-2">
                {!hasVoted &&
                  (activeVote.type !== "SOLO" ||
                    activeVote.requesterId !== myId) && (
                    <button
                      onClick={() => onVote(true)}
                      className={`flex-1 text-white hover:opacity-90 active:scale-95 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                        activeVote.type === "DEMOTE_MOD"
                          ? "bg-red-500 shadow-red-500/20"
                          : "bg-dreamy-green shadow-dreamy-green/20"
                      }`}
                    >
                      {activeVote.type === "DEMOTE_MOD"
                        ? "Vote to Demote"
                        : "Approve Vote"}
                    </button>
                  )}

                {/* Mod can instant-resolve solo requests, but maybe NOT their own demotion? 
                    Actually, allowing mod to 'approve' their own demotion is basically resigning. 
                    Allowing them to reject it is vetoing. 
                    Let's hide mod decision buttons for demotion votes to prevent abuse.
                */}
                {gameState.players.find((p) => p.id === myId)?.isMod &&
                  activeVote.type !== "DEMOTE_MOD" && (
                    <div className="flex gap-2 flex-1">
                      <ModDecisionButton
                        type="APPROVE"
                        onAction={() =>
                          setConfirmModal({
                            isOpen: true,
                            title: "Force Approve Solo?",
                            message: `Directly approve ${activeVote.requesterName}'s solo request?`,
                            onConfirm: () =>
                              onModDecision(activeVote.id, "APPROVE"),
                            variant: "primary",
                            confirmText: "Approve",
                          })
                        }
                      />
                      <ModDecisionButton
                        type="REJECT"
                        onAction={() =>
                          setConfirmModal({
                            isOpen: true,
                            title: "Decline Solo?",
                            message: `Reject ${activeVote.requesterName}'s request?`,
                            onConfirm: () =>
                              onModDecision(activeVote.id, "REJECT"),
                            variant: "danger",
                            confirmText: "Reject",
                          })
                        }
                      />
                    </div>
                  )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
      />

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-5 no-scrollbar"
      >
        {activeVote && <div className="h-[120px]"></div>}

        <AnimatePresence initial={false}>
          {gameState.messages.map((msg: ChatMessage, idx) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-white bg-slate-900/60 px-4 py-1.5 rounded-full backdrop-blur-md border border-white/10 shadow-sm">
                    {msg.content}
                  </span>
                </div>
              );
            }

            const isMe = msg.senderUuid
              ? msg.senderUuid === myUuid
              : msg.senderId === myId;
            const replyMsg = msg.replyToId
              ? gameState.messages.find((m) => m.id === msg.replyToId)
              : null;
            const prevMsg = idx > 0 ? gameState.messages[idx - 1] : null;
            const isCompact =
              prevMsg &&
              !prevMsg.isSystem &&
              (msg.senderUuid
                ? prevMsg.senderUuid === msg.senderUuid
                : prevMsg.senderId === msg.senderId) &&
              msg.timestamp - prevMsg.timestamp < 300000 &&
              !msg.replyToId;

            const isModNow = !!gameState.players.find(
              (p) => p.uuid === msg.senderUuid || p.id === msg.senderId,
            )?.isMod;
            const isHighlighted =
              msg.content.includes(`@${myPlayerName}`) ||
              (replyMsg && replyMsg.senderUuid === myUuid);

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={msg.id}
                className={`group relative flex flex-col ${isCompact ? "mt-0.5" : "mt-4"} ${isHighlighted ? "bg-dreamy-blue/5 -mx-2 px-2 rounded-2xl" : ""}`}
              >
                {replyMsg && (
                  <div className="ml-10 -mb-1 flex items-center gap-1.5 text-[10px] text-slate-700 font-bold">
                    <div className="w-5 h-5 border-l-2 border-t-2 border-slate-400 rounded-tl-lg mt-2.5 flex-shrink-0" />
                    <Reply size={12} className="text-slate-500" />
                    <span className="font-black text-slate-600">
                      @{replyMsg.senderName}:
                    </span>
                    <span className="truncate italic opacity-80 max-w-[150px] font-semibold">
                      {replyMsg.content}
                    </span>
                  </div>
                )}

                <div className="flex gap-3 items-start">
                  <div className="shrink-0 w-10 h-10">
                    {!isCompact ? (
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shadow-sm border-2 border-white transition-transform group-hover:scale-105 ${isMe ? "bg-dreamy-blue text-white" : isModNow ? "bg-dreamy-yellow text-slate-800" : "bg-white text-dreamy-slate"}`}
                      >
                        {msg.senderName.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-10 text-[9px] font-black text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity text-center mt-1 uppercase tracking-tighter">
                        {formatTime(msg.timestamp)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col">
                    {!isCompact && (
                      <div className="flex items-center gap-2 mb-0.5 mt-0.5">
                        <span
                          className={`text-sm font-black tracking-tight ${isMe ? "text-blue-800" : isModNow ? "text-amber-800" : "text-slate-900"}`}
                        >
                          {msg.senderName}
                        </span>
                        {isModNow && (
                          <span className="bg-amber-600/90 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shadow-sm">
                            MOD
                          </span>
                        )}
                        <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    <div
                      className={`relative px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm border-2 transition-all ${isMe ? "bg-white border-white text-dreamy-dark rounded-tl-none" : "bg-white/80 border-white/60 text-dreamy-dark rounded-tl-none"}`}
                    >
                      {renderContent(msg)}

                      {/* Reactions display right-aligned below bubble */}
                      {msg.reactions &&
                        Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2 -mb-1">
                            {Object.entries(msg.reactions).map(
                              ([emoji, users]) => {
                                const iReacted = users.includes(myId);
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() =>
                                      iReacted
                                        ? onRemoveReact(msg.id, emoji)
                                        : onReact(msg.id, emoji)
                                    }
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-black border-2 transition-all active:scale-90 ${iReacted ? "bg-dreamy-blue/20 border-dreamy-blue/30 text-dreamy-blue" : "bg-white border-white text-dreamy-slate hover:border-slate-100"}`}
                                  >
                                    {emoji}{" "}
                                    <span className="opacity-80">
                                      {users.length}
                                    </span>
                                  </button>
                                );
                              },
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Quick Action Bar on Hover */}
                <div className="absolute -top-4 right-0 opacity-0 group-hover:opacity-100 transition-all z-10 translate-y-2 group-hover:translate-y-0">
                  <div className="flex items-center glass-card bg-white rounded-2xl shadow-lg border-2 border-white overflow-hidden h-9 p-1 gap-1">
                    <button
                      onClick={() =>
                        setShowEmojiPickerFor(
                          showEmojiPickerFor === msg.id ? null : msg.id,
                        )
                      }
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 hover:text-dreamy-yellow transition-all"
                      title="React"
                    >
                      <Smile size={18} />
                    </button>
                    <button
                      onClick={() => setReplyingTo(msg)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-400 hover:text-dreamy-pink transition-all"
                      title="Reply"
                    >
                      <Reply size={18} />
                    </button>
                  </div>
                </div>

                {/* Bubble Emoji Picker */}
                <AnimatePresence>
                  {showEmojiPickerFor === msg.id && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0, y: 10 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.8, opacity: 0, y: 10 }}
                      className="absolute right-0 top-8 z-20 glass-card bg-white border-2 border-white p-2 rounded-3xl shadow-2xl flex flex-wrap gap-1 max-w-[160px] justify-center"
                    >
                      {emojiList.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            onReact(msg.id, emoji);
                            setShowEmojiPickerFor(null);
                          }}
                          className="hover:scale-125 hover:bg-slate-50 w-8 h-8 flex items-center justify-center rounded-xl transition-all text-lg"
                        >
                          {emoji}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mx-2 mb-2 p-1.5 glass-card border-2 border-white relative z-40 rounded-2xl shadow-xl">
        {replyingTo && (
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-200/90 border border-slate-300 mb-1.5 rounded-xl shadow-sm animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2 text-[10px] text-slate-800 font-bold truncate">
              <Reply size={14} className="text-slate-500" />
              <span className="text-slate-600 font-black">Replying to </span>
              <span className="font-black text-blue-800">
                @{replyingTo.senderName}
              </span>
              {replyingTo.content && (
                <span className="truncate italic opacity-70 ml-1 font-semibold">
                  "{replyingTo.content}"
                </span>
              )}
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-dreamy-dark transition-all active:scale-90"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <form
          onSubmit={handleSend}
          className="flex items-center bg-white border border-slate-100 rounded-xl px-1 py-1 gap-1 shadow-inner"
        >
          <div className="w-9 h-9 flex items-center justify-center text-dreamy-slate/30 ml-1">
            <Smile size={20} />
          </div>
          <input
            ref={inputRef}
            type="text"
            name="chat_message"
            inputMode="text"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="sentences"
            spellCheck="true"
            className="flex-1 bg-transparent py-2.5 text-dreamy-dark font-black placeholder-slate-400 focus:outline-none text-sm"
            placeholder={replyingTo ? "Compose reply..." : "Say something..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button
            type="submit"
            disabled={!input.trim() && !replyingTo}
            onMouseDown={(e) => {
              if (input.trim() || replyingTo) {
                handleSend(e as any);
                e.preventDefault();
              }
            }}
            className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-sm ${
              input.trim() || replyingTo
                ? "bg-dreamy-blue text-white hover:scale-105 active:scale-95 shadow-dreamy-blue/20"
                : "bg-slate-100 text-slate-200 cursor-not-allowed"
            }`}
          >
            <Send
              size={18}
              className={input.trim() ? "translate-x-0.5 -translate-y-0.5" : ""}
            />
          </button>
        </form>
      </div>
    </div>
  );
};

const ModDecisionButton: React.FC<{
  type: "APPROVE" | "REJECT";
  onAction: () => void;
}> = ({ type, onAction }) => {
  const { isArmed, handleInteraction } = useDoubleTap(onAction);

  return (
    <button
      onClick={handleInteraction}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl font-black text-[10px] tracking-widest transition-all duration-300 uppercase shadow-sm border-2 ${
        type === "APPROVE"
          ? isArmed
            ? "bg-dreamy-blue text-white border-white scale-105"
            : "bg-dreamy-blue/10 text-dreamy-blue border-white hover:bg-dreamy-blue/20"
          : isArmed
            ? "bg-red-400 text-white border-white scale-105"
            : "bg-red-50 text-red-200 border-white hover:bg-red-100"
      }`}
    >
      {type === "APPROVE" ? <Check size={14} /> : <Ban size={14} />}
      <span>{isArmed ? "YES!" : `MOD ${type}`}</span>
    </button>
  );
};
