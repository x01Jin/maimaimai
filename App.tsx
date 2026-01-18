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

const LeaveButton: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { isArmed, handleInteraction } = useDoubleTap(onLeave);

  return (
    <button
      onClick={handleInteraction}
      className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${
        isArmed
          ? "text-red-500 bg-red-500/10 scale-110 active:scale-95"
          : "text-slate-500 hover:text-red-400"
      }`}
    >
      <LogOut size={24} className={isArmed ? "animate-pulse" : ""} />
      <span className="text-[10px] font-bold uppercase">
        {isArmed ? "Sure?" : "Leave"}
      </span>
    </button>
  );
};

export default function App() {
  const session = usePeerSession();
  const [tab, setTab] = useState<"queue" | "players" | "chat" | "help">(
    "queue",
  );
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // References for tracking changes
  const prevModRef = useRef<string | undefined>(undefined);
  const prevSessionIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number | null>(null);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  // --- Notification Logic ---

  const addNotification = (
    message: string,
    type: "info" | "success" | "warning" | "error",
    duration = 3000, // Adjusted duration to 3s
  ) => {
    setNotifications((prev) => {
      // Deduplication: Don't add if the same message is already showing
      if (prev.some((n) => n.message === message)) {
        return prev;
      }
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
        ? "Connection lost. Reconnecting..."
        : "Mod migrating...";
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
    const currentMessages = session.gameState.messages;

    // Initialize ref on first load with messages
    if (prevMessageCountRef.current === null) {
      prevMessageCountRef.current = currentMessages.length;
      // Count pre-existing messages from others as unread
      if (tab !== "chat") {
        const messagesFromOthers = currentMessages.filter(
          (m) => m.senderUuid !== session.myUuid,
        );
        setUnreadCount(messagesFromOthers.length);
      }
      return;
    }

    if (currentMessages.length > prevMessageCountRef.current) {
      const newMessages = currentMessages.slice(prevMessageCountRef.current);
      const lastMsg = currentMessages[currentMessages.length - 1];

      // Increment unread badge if not on chat tab
      if (tab !== "chat" && lastMsg.senderUuid !== session.myUuid) {
        const unreadIncrement = newMessages.filter(
          (m) => m.senderUuid !== session.myUuid,
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
          addNotification(
            `You were mentioned by ${lastMsg.senderName}`,
            "info",
          );
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
    const currentMod = session.gameState.players.find((p) => p.isMod)?.name;

    // Initialize ref or detect change
    if (prevModRef.current === undefined) {
      prevModRef.current = currentMod || null;
      return;
    }

    if (currentMod && prevModRef.current && prevModRef.current !== currentMod) {
      addNotification(`Mod changed to ${currentMod}`, "info");
    } else if (currentMod && prevModRef.current === null) {
      // Mod was null, now set
      addNotification(`${currentMod} is now the mod`, "info");
    }
    prevModRef.current = currentMod || null;
  }, [session.gameState.players]);

  // 4. Logic: Your Turn & Finished
  useEffect(() => {
    // "Your Turn" logic
    if (
      session.gameState.currentSession &&
      session.gameState.currentSession.id !== prevSessionIdRef.current
    ) {
      if (session.gameState.currentSession.playerIds.includes(session.myId)) {
        addNotification("It's your turn!", "success");
      }
    }

    // "Finished" logic - We detect this by seeing currentSession go from Non-Null to Null
    if (prevSessionIdRef.current && !session.gameState.currentSession) {
      addNotification("Current players finished", "info");
    }

    prevSessionIdRef.current = session.gameState.currentSession?.id || null;
  }, [session.gameState.currentSession, session.myId]);

  if (
    session.status === ConnectionStatus.IDLE ||
    session.status === ConnectionStatus.ERROR
  ) {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex items-center justify-center">
        <ToastContainer
          notifications={notifications}
          onDismiss={removeNotification}
        />
        <div className="w-full max-w-md h-[100dvh] bg-slate-900 relative">
          <LandingView
            onCreateSession={(name, code) =>
              session.createSession(name, undefined, code)
            }
            onJoin={session.joinSession}
            onRecoverSession={session.recoverSession}
            isConnecting={false}
            error={session.error}
          />
        </div>
      </div>
    );
  }

  // Initial Connection loading screen (only for first connect)
  if (
    session.status === ConnectionStatus.CONNECTING &&
    !session.gameState.sessionName
  ) {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex flex-col items-center justify-center text-cyan-400 gap-4">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-medium text-cyan-400">Connecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-900 flex justify-center">
      <ToastContainer
        notifications={notifications}
        onDismiss={removeNotification}
      />
      <div className="w-full max-w-md bg-slate-900 flex flex-col h-[100dvh] shadow-2xl relative">
        <div className="flex-1 overflow-hidden relative">
          {tab === "queue" && (
            <QueueView
              gameState={session.gameState}
              myId={session.myId}
              session={session}
              isMod={session.isMod}
              addNotification={addNotification}
            />
          )}
          {tab === "players" && (
            <PlayersView
              gameState={session.gameState}
              myId={session.myId}
              session={session}
              isMod={session.isMod}
            />
          )}
          {tab === "chat" && (
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
          )}
          {tab === "help" && <HelpView onClose={() => setTab("queue")} />}
        </div>

        <div className="bg-slate-800 border-t border-slate-700 safe-area-bottom">
          <div className="flex justify-around items-center h-16">
            <button
              onClick={() => setTab("queue")}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${tab === "queue" ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              <ListOrdered size={24} />
              <span className="text-[10px] font-bold uppercase">Queue</span>
            </button>
            <button
              onClick={() => setTab("players")}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${tab === "players" ? "text-purple-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              <Users size={24} />
              <span className="text-[10px] font-bold uppercase">Players</span>
            </button>
            <button
              onClick={() => setTab("chat")}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${tab === "chat" ? "text-pink-500" : "text-slate-500 hover:text-slate-300"}`}
            >
              <div className="relative">
                <MessageSquare size={24} />
                {unreadCount > 0 && (
                  <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full min-w-[16px] h-4 flex items-center justify-center border border-slate-800">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold uppercase">Chat</span>
            </button>
            <button
              onClick={() => setTab("help")}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${tab === "help" ? "text-green-400" : "text-slate-500 hover:text-slate-300"}`}
            >
              <HelpCircle size={24} />
              <span className="text-[10px] font-bold uppercase">Help</span>
            </button>
            <LeaveButton onLeave={() => setConfirmLeave(true)} />
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={session.leaveSession}
        title="Leave Session?"
        message="Are you sure you want to leave? You can rejoin later from the history."
        confirmText="Leave"
        variant="danger"
      />
    </div>
  );
}
