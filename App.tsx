import React, { useState, useEffect, useRef } from "react";
import { usePeerSession } from "./hooks/usePeerSession";
import { useDoubleTap } from "./hooks/useDoubleTap";
import { ConnectionStatus, AppNotification } from "./types";
import { ToastContainer, ConfirmationModal } from "./components";
import { generateUUID } from "./utils";
import {
  Users,
  LogOut,
  MessageSquare,
  ListOrdered,
  HelpCircle,
} from "lucide-react";

// Import Views
import { LandingView } from "./views/LandingView";
import { QueueView } from "./views/QueueView";
import { PlayersView } from "./views/PlayersView";
import { ChatView } from "./views/ChatView";
import { HelpView } from "./views/HelpView";
import { motion, AnimatePresence } from "framer-motion";

const LeaveButton: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { isArmed, handleInteraction } = useDoubleTap(onLeave);

  return (
    <button
      onClick={handleInteraction}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-500 rounded-2xl ${
        isArmed
          ? "bg-red-50 text-red-400 scale-110 active:scale-95"
          : "text-slate-400 hover:text-red-300"
      }`}
    >
      <div className="relative">
        <LogOut size={20} className={isArmed ? "animate-pulse" : ""} />
        {isArmed && (
          <div className="absolute inset-0 bg-red-400/20 blur-lg rounded-full animate-pulse" />
        )}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">
        {isArmed ? "Bye?" : "Out"}
      </span>
    </button>
  );
};

import { ErrorBoundary } from "./components/ErrorBoundary";

export default function App() {
  const session = usePeerSession();
  const [tab, setTab] = useState<"queue" | "players" | "chat" | "help">(
    "queue",
  );
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // References for tracking changes
  const prevModRef = useRef<string | undefined>(undefined);
  const prevSessionIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number | null>(null);
  const isLeavingRef = useRef(false);
  const isMountedRef = useRef(false);
  const [isStuck, setIsStuck] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;

    const handleVisualViewportResize = () => {
      const vv = window.visualViewport;
      if (vv) {
        document.documentElement.style.setProperty(
          "--visual-viewport-height",
          `${vv.height}px`,
        );

        // More sensitive threshold + check for active inputs
        const isInputFocused =
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA";
        const isViewportSmall = vv.height < window.innerHeight * 0.92;

        setIsKeyboardOpen(isViewportSmall || isInputFocused);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
        setIsKeyboardOpen(true);
      }
    };
    const handleFocusOut = () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        const isInput =
          activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";
        const vv = window.visualViewport;
        const isViewportSmall = vv
          ? vv.height < window.innerHeight * 0.92
          : false;

        if (!isInput && !isViewportSmall) {
          setIsKeyboardOpen(false);
        }
      }, 100);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener(
        "resize",
        handleVisualViewportResize,
      );
      handleVisualViewportResize();
    }

    window.addEventListener("focusin", handleFocusIn as any);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      isMountedRef.current = false;
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          handleVisualViewportResize,
        );
      }
      window.removeEventListener("focusin", handleFocusIn as any);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  // --- Notification Logic ---

  const addNotification = (
    message: string,
    type: "info" | "success" | "warning" | "error",
    duration = 2000,
  ) => {
    setNotifications((prev) => {
      // Deduplication: Don't add if the same message is already showing
      const exists = prev.some((n) => n.message === message);
      if (exists) return prev;

      return [...prev, { id: generateUUID(), message, type, duration }];
    });
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // 1. Connection Status Toast
  useEffect(() => {
    if (
      session.status === ConnectionStatus.MIGRATING ||
      session.status === ConnectionStatus.RECONNECTING
    ) {
      // Add sticky notification if not already present
      const isReconnecting = session.status === ConnectionStatus.RECONNECTING;
      const id = "sticky-connection-status";
      const msg = isReconnecting
        ? "Signal lost! Reconnecting..."
        : "Migrating host...";
      const type = isReconnecting ? "warning" : "info";

      setNotifications((prev) => {
        if (prev.some((n) => n.id === id)) return prev;
        return [...prev, { id, message: msg, type, duration: 0 }];
      });
    } else {
      // Remove sticky notification
      removeNotification("sticky-connection-status");
    }
  }, [session.status]);

  // 2. Message Logic: Unread Badge, Mentions, and Replies
  useEffect(() => {
    const currentMessages = session.gameState?.messages || [];

    // Initialize ref on first load with messages
    if (prevMessageCountRef.current === null) {
      prevMessageCountRef.current = currentMessages.length;
      // Count pre-existing messages from others as unread
      if (tab !== "chat") {
        const messagesFromOthers = currentMessages.filter(
          (m) => m && m.senderUuid !== session.myUuid,
        );
        setUnreadCount(messagesFromOthers.length);
      }
      return;
    }

    if (currentMessages.length > prevMessageCountRef.current) {
      const newMessages = currentMessages.slice(prevMessageCountRef.current);
      const lastMsg = currentMessages[currentMessages.length - 1];

      // Increment unread badge if not on chat tab
      if (tab !== "chat" && lastMsg && lastMsg.senderUuid !== session.myUuid) {
        const unreadIncrement = newMessages.filter(
          (m) => m && m.senderUuid !== session.myUuid,
        ).length;
        setUnreadCount((prev) => prev + unreadIncrement);
      }

      // Check for mentions and replies
      if (lastMsg.senderUuid !== session.myUuid) {
        const myPlayer = session.gameState.players.find(
          (p) => p.uuid === session.myUuid,
        );
        const myName = myPlayer?.name || "";

        if (myName && lastMsg.content.includes(`@${myName}`)) {
          addNotification(`@${lastMsg.senderName} mentioned you!`, "info");
        } else if (lastMsg.replyToId) {
          const repliedToMsg = currentMessages.find(
            (m) => m.id === lastMsg.replyToId,
          );
          if (repliedToMsg && repliedToMsg.senderUuid === session.myUuid) {
            addNotification(`${lastMsg.senderName} replied to you`, "info");
          }
        }
      }
    }
    prevMessageCountRef.current = currentMessages.length;
  }, [session.gameState.messages, tab, session.myUuid]);

  useEffect(() => {
    if (tab === "chat") {
      setUnreadCount(0);
    }
  }, [tab]);

  // 3. Logic: Mod Changed
  useEffect(() => {
    if (!isMountedRef.current) return;

    // waiting for stable connection before alerting mod changes
    if (session.status !== ConnectionStatus.CONNECTED) return;

    const players = session.gameState?.players || [];
    const currentMod = players.find((p) => p && p.isMod)?.name;

    // Initialize ref on first load or re-sync
    if (prevModRef.current === undefined) {
      prevModRef.current = currentMod || null;
      return;
    }

    if (currentMod && prevModRef.current && prevModRef.current !== currentMod) {
      addNotification(`New Mod: ${currentMod}`, "info");
    }
    prevModRef.current = currentMod || null;
  }, [session.gameState?.players, session.status]);

  // 4. Logic: Your Turn & Finished
  useEffect(() => {
    const currentSession = session.gameState?.currentSession;
    // "Your Turn" logic
    if (currentSession && currentSession.id !== prevSessionIdRef.current) {
      if (currentSession.playerIds.includes(session.myId)) {
        addNotification("It's your time to shine!", "success");
      }
    }

    // "Finished" logic
    if (prevSessionIdRef.current && !currentSession && !isLeavingRef.current) {
      addNotification("Round complete!", "info");
    }

    prevSessionIdRef.current = currentSession?.id || null;
  }, [session.gameState?.currentSession, session.myId]);

  // 5. Connection Timeout Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (
      session.status === ConnectionStatus.CONNECTING &&
      !session.gameState.sessionName
    ) {
      timer = setTimeout(() => {
        setIsStuck(true);
      }, 5000);
    } else {
      setIsStuck(false);
    }
    return () => clearTimeout(timer);
  }, [session.status, session.gameState.sessionName]);

  // Common state-dependent content wrapper
  const renderView = () => {
    if (
      session.status === ConnectionStatus.IDLE ||
      session.status === ConnectionStatus.ERROR
    ) {
      return (
        <LandingView
          onCreateSession={(name, code) =>
            session.createSession(name, undefined, code)
          }
          onJoin={session.joinSession}
          onRecoverSession={session.recoverSession}
          isConnecting={false}
          error={session.error}
        />
      );
    }

    if (
      session.status === ConnectionStatus.CONNECTING &&
      !session.gameState.sessionName
    ) {
      return (
        <div className="w-full h-full bg-white/20 backdrop-blur-3xl flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-dreamy-blue/20 rounded-full animate-ping"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-dreamy-blue border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-black text-xl text-dreamy-blue tracking-tight">
              Syncing Stars...
            </p>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest animate-pulse">
              Establishing connection
            </p>
          </div>

          {isStuck && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-3 mt-4"
            >
              <div className="flex items-center gap-2">
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-tighter">
                  Stuck?
                </p>
                <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
              <button
                onClick={() => {
                  session.leaveSession();
                  setIsStuck(false);
                }}
                className="px-6 py-2.5 bg-white/80 hover:bg-white border-2 border-slate-100 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm hover:shadow-md"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </div>
      );
    }

    return (
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          {tab === "queue" && (
            <motion.div
              key="queue-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 h-full"
            >
              <QueueView
                gameState={session.gameState}
                myId={session.myId}
                session={session}
                isMod={session.isMod}
                addNotification={addNotification}
              />
            </motion.div>
          )}
          {tab === "players" && (
            <motion.div
              key="players-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 h-full"
            >
              <PlayersView
                gameState={session.gameState}
                myId={session.myId}
                session={session}
                isMod={session.isMod}
              />
            </motion.div>
          )}
          {tab === "chat" && (
            <motion.div
              key="chat-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 h-full"
            >
              <ChatView
                gameState={session.gameState}
                myId={session.myId}
                myUuid={session.myUuid}
                onSend={session.sendMessage}
                onVote={session.castVote}
                onModDecision={session.modDecision}
                onReact={session.addReaction}
                onRemoveReact={session.removeReaction}
              />
            </motion.div>
          )}
          {tab === "help" && (
            <motion.div
              key="help-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 h-full"
            >
              <HelpView onClose={() => setTab("queue")} />
            </motion.div>
          )}
        </AnimatePresence>
      </ErrorBoundary>
    );
  };

  return (
    <div
      className="absolute inset-0 flex justify-center bg-transparent overflow-hidden"
      style={{ height: "var(--visual-viewport-height, 100dvh)" }}
    >
      <ToastContainer
        notifications={notifications}
        onDismiss={removeNotification}
      />
      <div className="w-full max-w-md h-full flex flex-col relative overflow-hidden">
        <div className="flex-1 relative min-h-0 main-content-area">
          {renderView()}
        </div>

        {session.status !== ConnectionStatus.IDLE &&
          session.status !== ConnectionStatus.ERROR &&
          session.gameState.sessionName &&
          !isKeyboardOpen && (
            <div className="px-2 pb-2 safe-area-bottom main-nav-container shrink-0 z-50">
              <div className="glass-card bg-white/95 border-2 border-white rounded-2xl shadow-md flex justify-around items-center h-[60px] px-1">
                <TabButton
                  active={tab === "queue"}
                  onClick={() => setTab("queue")}
                  icon={<ListOrdered size={20} />}
                  label="Queue"
                  badge={
                    (session.gameState?.queue?.length || 0) > 0
                      ? session.gameState.queue.length
                      : undefined
                  }
                  color="text-blue-600"
                />
                <TabButton
                  active={tab === "players"}
                  onClick={() => setTab("players")}
                  icon={<Users size={20} />}
                  label="Party"
                  color="text-purple-600"
                />
                <TabButton
                  active={tab === "chat"}
                  onClick={() => setTab("chat")}
                  icon={<MessageSquare size={20} />}
                  label="Chat"
                  badge={unreadCount > 0 ? unreadCount : undefined}
                  color="text-pink-600"
                />
                <TabButton
                  active={tab === "help"}
                  onClick={() => setTab("help")}
                  icon={<HelpCircle size={20} />}
                  label="Help"
                  color="text-emerald-600"
                />
                <LeaveTabButton
                  onLeave={() => {
                    setConfirmLeave(true);
                  }}
                />
              </div>
            </div>
          )}
      </div>

      <ConfirmationModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          isLeavingRef.current = true;
          session.leaveSession();
        }}
        title="Leave the Party?"
        message="Are you sure you want to exit this whimsical session? You can always find your way back from history!"
        confirmText="See ya!"
        variant="danger"
      />
    </div>
  );
}

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  color: string;
  badge?: number;
}> = ({ active, onClick, icon, label, color, badge }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 rounded-2xl ${active ? `${color} scale-110` : "text-slate-400 hover:text-slate-600"}`}
  >
    <div className="relative">
      {icon}
      {badge ? (
        <div className="absolute -top-1.5 -right-2 bg-dreamy-pink text-white text-[8px] font-black px-1 rounded-full min-w-[14px] h-3.5 flex items-center justify-center border border-white shadow-sm">
          {badge > 9 ? "9+" : badge}
        </div>
      ) : null}
      {active && (
        <motion.div
          layoutId="active-bg"
          className="absolute inset--2 bg-current opacity-10 blur-xl rounded-full"
        />
      )}
    </div>
    <span
      className={`text-[8px] font-black uppercase tracking-widest ${active ? "opacity-100" : "text-slate-400"}`}
    >
      {label}
    </span>
  </button>
);

const LeaveTabButton: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { isArmed, handleInteraction } = useDoubleTap(onLeave);

  return (
    <button
      onClick={handleInteraction}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 rounded-2xl ${
        isArmed
          ? "text-red-500 scale-110 bg-red-50"
          : "text-slate-400 hover:text-red-400"
      }`}
    >
      <div className="relative">
        <LogOut size={20} className={isArmed ? "animate-pulse" : ""} />
        {isArmed && (
          <div className="absolute inset-0 bg-red-400/20 blur-xl rounded-full" />
        )}
      </div>
      <span className="text-[8px] font-black uppercase tracking-widest">
        {isArmed ? "SURE?" : "OUT"}
      </span>
    </button>
  );
};
