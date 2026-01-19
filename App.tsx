import React, { useState, useEffect, useRef } from "react";
import {
  useYjsSession,
  useYjsPlayers,
  useYjsQueue,
  useYjsChat,
  useYjsMod,
} from "./hooks/yjs";
import { useDoubleTap } from "./hooks/useDoubleTap";
import { ConnectionStatus, AppNotification, GameState } from "./types";
import { ToastContainer, ConfirmationModal } from "./components";
import { generateUUID, getIdentity } from "./utils/storage";
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
          ? "bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-300 scale-110 active:scale-95"
          : "text-slate-400 dark:text-slate-500"
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
  // Y.js hooks
  const sessionHook = useYjsSession();
  const {
    ydoc,
    provider,
    connectionStatus,
    sessionCode,
    sessionName,
    myUuid,
    myClientId,
  } = sessionHook;

  const [myName, setMyName] = useState(() => getIdentity().name || "");

  const [theme, setTheme] = useState(() => {
    if (localStorage.theme === "dark") {
      return "dark" as const;
    }
    return "light" as const;
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.theme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.theme = "light";
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const chatHook = useYjsChat(ydoc);
  const { messages, sendSystemMessage } = chatHook;

  const playersHook = useYjsPlayers(
    ydoc,
    myUuid,
    myName,
    connectionStatus === ConnectionStatus.CONNECTED || sessionHook.isCreating,
    sendSystemMessage,
  );
  const { players, myPlayer, addCustomPlayer, removeCustomPlayer, kickStatus } =
    playersHook;

  // Handle detection of being kicked/banned
  useEffect(() => {
    if (kickStatus === "banned") {
      addNotification(
        "You have been KICKED HARD! Banished to the shadow realm. 🌑",
        "error",
      );
      sessionHook.leaveSession();
    } else if (kickStatus === "kicked" && !isLeavingRef.current) {
      addNotification("You have been kicked from this session.", "warning");
      sessionHook.leaveSession();
    }
  }, [kickStatus]);

  const myId = myPlayer?.id || "";

  const modHook = useYjsMod(
    ydoc,
    myId,
    players,
    sendSystemMessage,
    sessionHook.isCreating,
  );
  const { isMod, transferMod } = modHook;

  const queueHook = useYjsQueue(ydoc, players, myId, isMod, sendSystemMessage);
  const { queue, currentSession, finishApprovals, activeVote } = queueHook;

  // Build GameState for compatibility with views
  const gameState: GameState = {
    // Inject correct isMod status from the mod hook
    players: players.map((p) => ({
      ...p,
      isMod: p.id === modHook.modId,
    })),
    queue,
    currentSession,
    finishApprovals,
    messages,
    sessionName: sessionName || sessionCode,
    activeVote,
    version: 0,
    servicePeers: [],
    stateHash: "",
  };

  // Build session object for compatibility with views
  const session = {
    status: connectionStatus,
    isMod,
    gameState,
    myId,
    myUuid,
    createSession: (
      name: string,
      _existingState?: GameState,
      code?: string,
    ) => {
      setMyName(name);
      sessionHook.createSession(name, code);
    },
    joinSession: (code: string, name: string) => {
      setMyName(name);
      sessionHook.joinSession(code, name);
    },
    recoverSession: async (code: string, name: string) => {
      setMyName(name);
      await sessionHook.recoverSession(code, name);
    },
    leaveSession: sessionHook.leaveSession,
    error: sessionHook.error,
    // Queue operations
    joinQueueMatch: (playerId: string = myId) =>
      queueHook.enqueue("MATCH", playerId),
    joinQueuePartner: (partnerId: string, playerId: string = myId) =>
      queueHook.enqueue("PARTNER", playerId, partnerId),
    requestSolo: (playerId: string = myId, playerName: string = myName) =>
      queueHook.requestSolo(playerId, playerName),
    requestModDemotion: (modId: string) =>
      queueHook.requestModDemotion(myId, myName, modId),
    leaveQueue: (queueId: string) => queueHook.leaveQueue(queueId, myId),
    removeFromQueue: queueHook.removeFromQueue,
    kickPlayer: queueHook.kickPlayer,
    reorderQueue: queueHook.reorderQueue,
    finishTurn: (playerId: string = myId) => queueHook.finishTurn(playerId),
    forceFinishTurn: queueHook.forceFinishTurn,
    // Chat operations
    sendMessage: (
      content: string,
      replyToId?: string,
      type: "text" | "image" | "gif" = "text",
      metadata?: any,
    ) =>
      chatHook.sendMessage(
        content,
        myId,
        myUuid,
        myName,
        replyToId,
        type,
        metadata,
      ),
    addReaction: (messageId: string, emoji: string) =>
      chatHook.addReaction(messageId, myId, emoji),
    removeReaction: (messageId: string, emoji: string) =>
      chatHook.removeReaction(messageId, myId, emoji),
    // Voting
    castVote: (approve: boolean) => {
      if (activeVote) {
        queueHook.castVote(activeVote.id, myId, approve);
      }
    },
    modDecision: (voteId: string, decision: "APPROVE" | "REJECT") => {
      queueHook.modDecision(voteId, decision, myId, myName);
    },
    // Mod operations
    transferMod,
    resignMod: modHook.resignMod,
    // Player operations
    addCustomPlayer,
    removeCustomPlayer,
    kickSessionPlayer: playersHook.kickSessionPlayer,
  };

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
    if (connectionStatus === ConnectionStatus.RECONNECTING) {
      const id = "sticky-connection-status";
      const msg = "Signal lost! Reconnecting...";

      setNotifications((prev) => {
        if (prev.some((n) => n.id === id)) return prev;
        return [...prev, { id, message: msg, type: "warning", duration: 0 }];
      });
    } else {
      removeNotification("sticky-connection-status");
    }
  }, [connectionStatus]);

  // 2. Message Logic: Unread Badge, Mentions, and Replies
  useEffect(() => {
    const currentMessages = messages || [];

    // Initialize ref on first load with messages
    if (prevMessageCountRef.current === null) {
      prevMessageCountRef.current = currentMessages.length;
      // Count pre-existing messages from others as unread
      if (tab !== "chat") {
        const messagesFromOthers = currentMessages.filter(
          (m) => m && m.senderUuid !== myUuid,
        );
        setUnreadCount(messagesFromOthers.length);
      }
      return;
    }

    if (currentMessages.length > prevMessageCountRef.current) {
      const newMessages = currentMessages.slice(prevMessageCountRef.current);
      const lastMsg = currentMessages[currentMessages.length - 1];

      // Increment unread badge if not on chat tab
      if (tab !== "chat" && lastMsg && lastMsg.senderUuid !== myUuid) {
        const unreadIncrement = newMessages.filter(
          (m) => m && m.senderUuid !== myUuid,
        ).length;
        setUnreadCount((prev) => prev + unreadIncrement);
      }

      // Check for mentions and replies
      if (lastMsg.senderUuid !== myUuid) {
        const myPlayerData = players.find((p) => p.uuid === myUuid);
        const myPlayerName = myPlayerData?.name || "";

        if (myPlayerName && lastMsg.content.includes(`@${myPlayerName}`)) {
          addNotification(`@${lastMsg.senderName} mentioned you!`, "info");
        } else if (lastMsg.replyToId) {
          const repliedToMsg = currentMessages.find(
            (m) => m.id === lastMsg.replyToId,
          );
          if (repliedToMsg && repliedToMsg.senderUuid === myUuid) {
            addNotification(`${lastMsg.senderName} replied to you`, "info");
          }
        }
      }
    }
    prevMessageCountRef.current = currentMessages.length;
  }, [messages, tab, myUuid, players]);

  useEffect(() => {
    if (tab === "chat") {
      setUnreadCount(0);
    }
  }, [tab]);

  // 3. Logic: Mod Changed
  useEffect(() => {
    if (!isMountedRef.current) return;

    // waiting for stable connection before alerting mod changes
    if (connectionStatus !== ConnectionStatus.CONNECTED) return;

    const currentMod = players.find((p) => p && p.isMod)?.name;

    // Initialize ref on first load or re-sync
    if (prevModRef.current === undefined) {
      prevModRef.current = currentMod || undefined;
      return;
    }

    if (currentMod && prevModRef.current && prevModRef.current !== currentMod) {
      addNotification(`New Mod: ${currentMod}`, "info");
    }
    prevModRef.current = currentMod || undefined;
  }, [players, connectionStatus]);

  // 4. Logic: Your Turn & Finished
  useEffect(() => {
    // "Your Turn" logic
    if (currentSession && currentSession.id !== prevSessionIdRef.current) {
      if (currentSession.playerIds.includes(myId)) {
        addNotification("It's your time to shine!", "success");
      }
    }

    // "Finished" logic
    if (prevSessionIdRef.current && !currentSession && !isLeavingRef.current) {
      addNotification("Round complete!", "info");
    }

    prevSessionIdRef.current = currentSession?.id || null;
  }, [currentSession, myId]);

  // 5. Connection Timeout Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (connectionStatus === ConnectionStatus.CONNECTING && !sessionName) {
      timer = setTimeout(() => {
        setIsStuck(true);
      }, 5000);
    } else {
      setIsStuck(false);
    }
    return () => clearTimeout(timer);
  }, [connectionStatus, sessionName]);

  // Common state-dependent content wrapper
  const renderView = () => {
    if (
      connectionStatus === ConnectionStatus.IDLE ||
      connectionStatus === ConnectionStatus.ERROR
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
          theme={theme}
          toggleTheme={toggleTheme}
        />
      );
    }

    if (kickStatus === "banned") {
      return (
        <div className="w-full h-full bg-black text-white flex flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in duration-1000">
          <div className="w-24 h-24 bg-red-900/20 text-red-600 rounded-full flex items-center justify-center animate-pulse border-4 border-red-900/50">
            <LogOut size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-red-600 tracking-tighter uppercase shake-animation">
              BANISHED
            </h1>
            <p className="text-slate-400 dark:text-slate-500 font-bold max-w-xs leading-relaxed">
              You have been exiled to the shadow realm. There is no return.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-8 px-8 py-3 bg-red-900/20 border border-red-900/50 rounded-2xl text-red-500 font-black uppercase tracking-widest transition-all"
          >
            Accept Fate
          </button>
        </div>
      );
    }

    if (connectionStatus === ConnectionStatus.CONNECTING && !sessionName) {
      return (
        <div className="w-full h-full bg-white/20 backdrop-blur-3xl flex flex-col items-center justify-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-dreamy-blue/20 rounded-full animate-ping"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-dreamy-blue border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-black text-xl text-dreamy-blue dark:text-midnight-blue tracking-tight">
              Syncing Stars...
            </p>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">
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
                className="px-6 py-2.5 bg-white/80 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </div>
      );
    }

    return (
      <ErrorBoundary key={tab}>
        <AnimatePresence>
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
                gameState={gameState}
                myId={myId}
                session={session}
                isMod={isMod}
                addNotification={addNotification}
                theme={theme}
                toggleTheme={toggleTheme}
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
                gameState={gameState}
                myId={myId}
                session={session}
                isMod={isMod}
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
                gameState={gameState}
                myId={myId}
                myUuid={myUuid}
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

        {connectionStatus !== ConnectionStatus.IDLE &&
          connectionStatus !== ConnectionStatus.ERROR &&
          (sessionName || sessionCode) &&
          !isKeyboardOpen && (
            <div className="px-2 pb-2 safe-area-bottom main-nav-container shrink-0 z-50">
              <div className="glass-card bg-white/95 dark:bg-slate-900/90 border-2 border-white dark:border-slate-800 rounded-2xl shadow-md flex justify-around items-center h-[60px] px-1">
                <TabButton
                  active={tab === "queue"}
                  onClick={() => setTab("queue")}
                  icon={<ListOrdered size={20} />}
                  label="Queue"
                  badge={(queue?.length || 0) > 0 ? queue.length : undefined}
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
          // Clean up player entry before leaving for immediate detection
          if (myId) {
            playersHook.removePlayer(myId);
          }
          session.leaveSession();
        }}
        title="Leave the Party?"
        message="Are you sure you want to exit this session? You can always find your way back from history!"
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
    className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 rounded-2xl ${active ? `${color} scale-110` : "text-slate-400 dark:text-slate-500"}`}
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
          ? "text-red-500 scale-110 bg-red-50 dark:bg-red-900/20"
          : "text-slate-400 dark:text-slate-500"
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
