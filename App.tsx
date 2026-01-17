import React, { useState, useEffect, useRef } from "react";
import { usePeerSession } from "./hooks/usePeerSession";
import { ConnectionStatus, AppNotification } from "./types";
import { Button, Modal, ToastContainer, ConfirmationModal } from "./components";
import { generateUUID } from "./utils";
import { Users, LogOut, MessageSquare, ListOrdered } from "lucide-react";

// Import Views
import { LandingView } from "./views/LandingView";
import { QueueView } from "./views/QueueView";
import { PlayersView } from "./views/PlayersView";
import { ChatView } from "./views/ChatView";

export default function App() {
  const session = usePeerSession();
  const [tab, setTab] = useState<"queue" | "players" | "chat">("queue");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // References for tracking changes
  const prevModRef = useRef<string | null>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  // --- Notification Logic ---

  const addNotification = (
    message: string,
    type: "info" | "success" | "warning" | "error",
    duration = 3000,
  ) => {
    setNotifications((prev) => [
      ...prev,
      { id: generateUUID(), message, type, duration },
    ]);
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

  // 2. Unread Messages Badge
  useEffect(() => {
    if (session.gameState.messages.length > prevMessageCountRef.current) {
      if (tab !== "chat") {
        setUnreadCount(
          (prev) =>
            prev +
            (session.gameState.messages.length - prevMessageCountRef.current),
        );
      }
    }
    prevMessageCountRef.current = session.gameState.messages.length;
  }, [session.gameState.messages, tab]);

  useEffect(() => {
    if (tab === "chat") {
      setUnreadCount(0);
    }
  }, [tab]);

  // 3. Logic: Mod Changed
  useEffect(() => {
    const currentMod = session.gameState.players.find((p) => p.isMod)?.name;
    if (prevModRef.current && currentMod && prevModRef.current !== currentMod) {
      addNotification(`Mod changed to ${currentMod}`, "info");
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
        addNotification("It's your turn!", "success", 5000);
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
            />
          )}
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
              onClick={() => setConfirmLeave(true)}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-500 hover:text-red-400"
            >
              <LogOut size={24} />
              <span className="text-[10px] font-bold uppercase">Leave</span>
            </button>
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
