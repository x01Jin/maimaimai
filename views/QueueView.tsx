import React, { useState, useRef, useEffect } from "react";
import { useDoubleTap } from "../hooks/useDoubleTap";
import { Reorder, useDragControls, motion } from "framer-motion";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { ConfirmationModal } from "../components/ConfirmationModal";
import {
  Copy,
  Music,
  Play,
  Check,
  WifiOff,
  CheckCircle,
  ListOrdered,
  GripVertical,
  X,
  UserPlus,
  Users,
  User,
  Ban,
} from "lucide-react";
import logo from "../assets/logo.png";
import { GameState, QueueEntry, Player } from "../types";
import { UsePeerSessionReturn } from "../hooks/usePeerSession";
import { NETWORK_CONFIG } from "../constants";

interface QueueViewProps {
  gameState: GameState;
  myId: string;
  session: UsePeerSessionReturn;
  isMod: boolean;
  addNotification: (
    message: string,
    type: "info" | "success" | "warning" | "error",
    duration?: number,
  ) => void;
}

interface QueueItemProps {
  item: QueueEntry;
  index: number;
  players: Player[];
  myId: string;
  isMod: boolean;
  session: UsePeerSessionReturn;
  promptConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    variant?: "danger" | "neutral" | "primary",
    confirmText?: string,
  ) => void;
  getEntryColor: (type: string) => string;
  getEntryIcon: (type: string) => React.ReactNode;
}

const LeaveQueueButton: React.FC<{ onLeave: () => void }> = ({ onLeave }) => {
  const { isArmed, handleInteraction } = useDoubleTap(onLeave);

  return (
    <button
      onClick={handleInteraction}
      className={`px-3 py-1.5 text-[10px] transition-all duration-300 rounded-full font-black uppercase tracking-widest outline-none ${
        isArmed
          ? "bg-red-400 text-white scale-110 shadow-lg shadow-red-400/30 ring-4 ring-red-100"
          : "text-dreamy-slate hover:text-red-400 bg-white/50 hover:bg-white border border-white"
      }`}
      title={isArmed ? "Tap again to confirm!" : "Leave Queue"}
    >
      {isArmed ? "SURE?" : "Leave"}
    </button>
  );
};

const QueueItem: React.FC<QueueItemProps> = React.memo(
  ({
    item,
    index,
    players,
    myId,
    isMod,
    session,
    promptConfirm,
    getEntryColor,
    getEntryIcon,
  }) => {
    const controls = useDragControls();
    const playerIds = Array.isArray(item.playerIds) ? item.playerIds : [];
    const playersInEntry = playerIds
      .map((id) => players.find((p: any) => p.id === id))
      .filter(Boolean);
    const isMeIn = playerIds.includes(myId);
    const canLeave = isMeIn;
    const canRemove = isMod;

    return (
      <Reorder.Item
        value={item}
        dragListener={false}
        dragControls={controls}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ willChange: "transform, opacity" }}
        className={`relative flex flex-col p-3 rounded-2xl border-2 shadow-sm transition-colors ${getEntryColor(item.type)} ${isMeIn ? "bg-white/90 border-dreamy-blue/40 ring-1 ring-dreamy-blue/10" : "bg-white/40 border-white/40"}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isMod && (
              <div
                onPointerDown={(e) => controls.start(e)}
                className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <GripVertical size={18} />
              </div>
            )}
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-black text-dreamy-slate text-[10px] shadow-sm border border-white/50">
              {index + 1}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
              {getEntryIcon(item.type)}
              <span className="opacity-70">{item.type}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canLeave && (
              <LeaveQueueButton onLeave={() => session.leaveQueue(item.id)} />
            )}
            {canRemove && (
              <button
                onClick={() => {
                  promptConfirm(
                    "Remove Queue Entry?",
                    "Are you sure you want to remove this entire entry?",
                    () => session.removeFromQueue(item.id),
                    "danger",
                    "Remove",
                  );
                }}
                className="p-1 text-red-200 hover:text-red-400 transition-colors bg-white/50 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5">
          <div className="flex-1 bg-white/40 p-2.5 rounded-xl flex items-center justify-between text-xs font-bold text-dreamy-dark shadow-sm border border-white/20 relative overflow-hidden">
            <div className="flex items-center gap-1.5">
              <span className="truncate max-w-[70px]">
                {playersInEntry[0]?.name || "???"}
              </span>
              {playersInEntry[0]?.id === myId && (
                <span className="text-[9px] text-dreamy-blue font-black uppercase bg-blue-50/50 px-1 rounded">
                  Me
                </span>
              )}
              {!playersInEntry[0]?.isConnected && (
                <WifiOff size={10} className="text-red-400" />
              )}
            </div>
            {isMod && playersInEntry[0] && (
              <button
                onClick={() =>
                  promptConfirm(
                    "Kick Player?",
                    `Kick ${playersInEntry[0].name} from the queue?`,
                    () => session.kickPlayer(item.id, playersInEntry[0].id),
                    "danger",
                    "Kick",
                  )
                }
                className="p-0.5 text-red-300 hover:text-red-400 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div
            className={`flex-1 p-2.5 rounded-xl flex items-center justify-center text-xs font-bold border-2 border-dashed ${item.type === "SOLO" ? "bg-dreamy-yellow/20 border-dreamy-yellow/40 text-dreamy-yellow" : "bg-white/20 border-white/20 text-dreamy-slate"} relative overflow-hidden`}
          >
            {item.type === "SOLO" ? (
              <span className="text-[9px] uppercase font-black tracking-widest opacity-60">
                SOLO
              </span>
            ) : playersInEntry[1] ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-1.5">
                  <span className="truncate max-w-[70px]">
                    {playersInEntry[1].name}
                  </span>
                  {playersInEntry[1].id === myId && (
                    <span className="text-[9px] text-dreamy-blue font-black uppercase bg-blue-50/50 px-1 rounded">
                      Me
                    </span>
                  )}
                  {!playersInEntry[1].isConnected && (
                    <WifiOff size={10} className="text-red-400" />
                  )}
                </div>
                {isMod && (
                  <button
                    onClick={() =>
                      promptConfirm(
                        "Kick Player?",
                        `Kick ${playersInEntry[1].name} from the queue?`,
                        () => session.kickPlayer(item.id, playersInEntry[1].id),
                        "danger",
                        "Kick",
                      )
                    }
                    className="p-0.5 text-red-300 hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[9px] uppercase font-black tracking-widest opacity-30">
                Waiting...
              </span>
            )}
          </div>
        </div>
      </Reorder.Item>
    );
  },
);

export const QueueView: React.FC<QueueViewProps> = ({
  gameState,
  myId,
  session,
  isMod,
  addNotification,
}) => {
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [partnerSelectMode, setPartnerSelectMode] = useState(false);

  // Mod Queue State
  const [showModQueueModal, setShowModQueueModal] = useState(false);
  const [modSelectedPlayerId, setModSelectedPlayerId] = useState<string>("");
  const [modQueueMode, setModQueueMode] = useState<
    "SELECT_PLAYER" | "SELECT_MODE" | "SELECT_PARTNER"
  >("SELECT_PLAYER");

  const [newPlayerName, setNewPlayerName] = useState("");

  const {
    currentSession = null,
    queue = [],
    players = [],
    sessionName = "",
    finishApprovals = [],
  } = gameState || {};

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    variant?: "danger" | "neutral" | "primary";
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const promptConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    variant: "danger" | "neutral" | "primary" = "danger",
    confirmText = "Confirm",
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      variant,
      confirmText,
    });
  };

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Local state for dragging to prevent jitter
  const [localQueue, setLocalQueue] = useState(queue);

  // Ref for debouncing reorder
  const reorderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalQueue(queue);
  }, [queue]);

  const handleReorder = (newOrder: QueueEntry[]) => {
    setLocalQueue(newOrder);

    if (isMod) {
      if (reorderTimeoutRef.current) {
        clearTimeout(reorderTimeoutRef.current);
      }

      reorderTimeoutRef.current = setTimeout(() => {
        session.reorderQueue(newOrder.map((q: QueueEntry) => q.id));
      }, NETWORK_CONFIG.REORDER_DEBOUNCE_MS);
    }
  };

  const copyCode = () => {
    const textToCopy = sessionName;

    const fallbackCopy = (text: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const successful = document.execCommand("copy");
        if (successful) {
          addNotification("Invite code copied to clipboard!", "success");
        } else {
          addNotification("Failed to copy invite code.", "error");
        }
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
        addNotification("Failed to copy invite code.", "error");
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          addNotification("Invite code copied to clipboard!", "success");
        })
        .catch((err) => {
          console.error("Async: Could not copy text: ", err);
          fallbackCopy(textToCopy);
        });
    } else {
      fallbackCopy(textToCopy);
    }
  };

  const getEntryColor = (type: string) => {
    switch (type) {
      case "SOLO":
        return "border-dreamy-yellow/30 bg-dreamy-yellow/10";
      case "PARTNER":
        return "border-dreamy-pink/30 bg-dreamy-pink/10";
      case "MATCH":
        return "border-dreamy-blue/30 bg-dreamy-blue/10";
      default:
        return "border-slate-200";
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case "SOLO":
        return <User size={16} className="text-dreamy-yellow" />;
      case "PARTNER":
        return <Users size={16} className="text-dreamy-pink" />;
      case "MATCH":
        return <UserPlus size={16} className="text-dreamy-blue" />;
      default:
        return null;
    }
  };

  const availablePartners = players.filter(
    (p: Player) => p.id !== myId && p.isConnected,
  );
  const isMePlaying = currentSession?.playerIds.includes(myId);
  const haveIApprovedFinish = finishApprovals?.includes(myId);

  const currentSessionPlayers =
    (currentSession?.playerIds
      .map((id) => players.find((p) => p.id === id))
      .filter(Boolean) as Player[]) || [];
  const customPlayersInSession = currentSessionPlayers.filter(
    (p) => p.isCustom,
  );
  const unfinishedCustomPlayers = customPlayersInSession.filter(
    (p) => !finishApprovals?.includes(p.id),
  );

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-4 glass-card border-b border-white flex justify-between items-center shadow-lg z-10 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 glass-card rounded-xl flex items-center justify-center border-2 border-white shadow-md overflow-hidden bg-white/40">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
          </div>
          <div className="space-y-0.5">
            <h2 className="font-black text-lg text-dreamy-dark tracking-tight leading-none">
              MaiMaiMai
            </h2>
            <div className="flex items-center gap-1.5 pt-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                Lobby:{" "}
                <span className="text-dreamy-purple select-all">
                  {sessionName}
                </span>
              </span>
              <button
                onClick={copyCode}
                className="p-1 hover:text-dreamy-purple text-slate-300 transition-colors"
              >
                <Copy size={10} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 pr-1">
          <div className="text-right">
            <div className="text-2xl font-black text-dreamy-blue leading-none drop-shadow-sm">
              {queue.reduce((acc, entry) => acc + entry.playerIds.length, 0)}
            </div>
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">
              Queuing
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-20 px-3 pt-1 min-h-0">
        <div className="mt-2 mb-4">
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 px-1">
            <Music size={12} className="text-dreamy-pink" /> On Stage
          </h3>

          {currentSession ? (
            <div className="glass-card rounded-3xl p-4 border-2 border-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                <Play size={80} />
              </div>
              <div className="flex flex-col gap-2 mb-4 relative z-10">
                {currentSession.playerIds.map((id: string) => {
                  const p = players.find((pl: any) => pl.id === id);
                  const isDone = finishApprovals?.includes(id);
                  return (
                    <div
                      key={id}
                      className={`px-3 py-2 rounded-2xl border-2 flex items-center justify-between gap-2 shadow-sm transition-all ${isDone ? "bg-dreamy-green/10 border-dreamy-green/30" : "bg-white/80 border-white"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${isDone ? "bg-dreamy-green text-white" : "bg-white/50 text-dreamy-slate border border-white"}`}
                        >
                          {isDone ? (
                            <Check size={16} />
                          ) : (
                            p?.name?.charAt(0) || "?"
                          )}
                        </div>
                        <span className="font-black text-dreamy-dark">
                          {p?.name || "???"}
                        </span>
                        {!p?.isConnected && (
                          <div className="px-2 py-0.5 bg-red-100 text-red-400 text-[10px] font-black uppercase rounded-full">
                            Offline
                          </div>
                        )}
                      </div>
                      {isDone && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-dreamy-green">
                          Done
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 relative z-10 items-stretch">
                {isMePlaying && (
                  <Button
                    className="flex-1 h-12"
                    variant={haveIApprovedFinish ? "ghost" : "primary"}
                    onClick={() =>
                      promptConfirm(
                        "Finish Turn?",
                        "Done playing? Let's give others a chance!",
                        session.finishTurn,
                        "primary",
                        "Finish!",
                      )
                    }
                    disabled={haveIApprovedFinish}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <CheckCircle size={16} className="mb-0.5" />
                      <span className="font-black text-xs uppercase tracking-tight">
                        {haveIApprovedFinish ? "Waiting..." : "Finish Turn"}
                      </span>
                    </div>
                  </Button>
                )}

                {isMod && customPlayersInSession.length > 0 && (
                  <Button
                    className="flex-1 h-12"
                    variant={
                      unfinishedCustomPlayers.length === 0 ? "ghost" : "success"
                    }
                    onClick={() => {
                      const names = unfinishedCustomPlayers
                        .map((p) => p.name)
                        .join(" & ");
                      promptConfirm(
                        "Finish Guest?",
                        `Has ${names} finished their song, mod?`,
                        () => {
                          unfinishedCustomPlayers.forEach((p) =>
                            session.finishTurn(p.id),
                          );
                        },
                        "primary",
                        "Finish!",
                      );
                    }}
                    disabled={unfinishedCustomPlayers.length === 0}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <Check size={16} className="mb-0.5" />
                      <span className="truncate w-full font-black text-xs uppercase tracking-tight">
                        {unfinishedCustomPlayers.length === 0
                          ? "Done"
                          : customPlayersInSession.length > 1
                            ? "Finish All"
                            : `Finish ${customPlayersInSession[0].name}`}
                      </span>
                    </div>
                  </Button>
                )}

                {isMod && (
                  <Button
                    variant="danger"
                    size="square"
                    className="w-12 h-12 shrink-0 rounded-2xl"
                    onClick={() =>
                      promptConfirm(
                        "Force Finish?",
                        "This will immediately clear the current session. Use with care!",
                        session.forceFinishTurn,
                        "danger",
                        "Force Clear",
                      )
                    }
                    title="Force Finish"
                  >
                    <Ban size={20} />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-300 glass-card rounded-3xl border-2 border-dashed border-white shadow-inner">
              <p className="font-black uppercase tracking-[0.2em] text-[10px]">
                Stage is open!
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center justify-between">
            <span>Next in Line</span>
            <span className="opacity-70">{localQueue.length} groups</span>
          </h3>
          {localQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-dreamy-dark gap-4 py-16 glass-card border-white border-2 rounded-3xl">
              <ListOrdered size={48} className="opacity-10" />
              <p className="font-black uppercase tracking-widest text-[10px] opacity-40">
                Empty Queue
              </p>
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={localQueue}
              onReorder={handleReorder}
              className="space-y-2.5"
            >
              {localQueue.map((item: QueueEntry, index: number) => {
                if (!item || !item.id) return null;
                return (
                  <QueueItem
                    key={item.id}
                    item={item}
                    index={index}
                    players={players}
                    myId={myId}
                    isMod={isMod}
                    session={session}
                    promptConfirm={promptConfirm}
                    getEntryColor={getEntryColor}
                    getEntryIcon={getEntryIcon}
                  />
                );
              })}
            </Reorder.Group>
          )}
        </div>
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5] opacity-50">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-dreamy-pink/10 rounded-full blur-2xl will-change-transform" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 bg-dreamy-blue/10 rounded-full blur-2xl will-change-transform" />
        <div className="absolute -bottom-24 left-1/2 w-64 h-64 bg-dreamy-purple/10 rounded-full blur-2xl will-change-transform" />
      </div>

      {showJoinOptions && (
        <div className="absolute inset-0 bg-dreamy-dark/20 backdrop-blur-xl z-50 flex flex-col items-center justify-end p-6 animate-in fade-in duration-300">
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full glass-card border-white/40 rounded-5xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex justify-between items-center mb-2 px-2">
              <h3 className="font-black text-xl text-dreamy-dark tracking-tight">
                Pick a Mode!
              </h3>
              <button
                onClick={() => {
                  setShowJoinOptions(false);
                  setPartnerSelectMode(false);
                }}
                className="w-10 h-10 flex items-center justify-center bg-white/50 rounded-full hover:bg-white text-dreamy-slate hover:text-dreamy-dark transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            {!partnerSelectMode ? (
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => {
                    session.joinQueueMatch();
                    setShowJoinOptions(false);
                  }}
                  className="w-full p-5 rounded-4xl bg-dreamy-blue/20 border-2 border-white/40 hover:bg-dreamy-blue/30 flex items-center gap-4 transition-all group active:scale-[0.98] shadow-sm"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-dreamy-blue shadow-sm group-hover:scale-110 transition-transform">
                    <UserPlus size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-black text-dreamy-dark text-lg">
                      Duo Match
                    </div>
                    <div className="text-xs font-bold text-dreamy-slate">
                      Find a random buddy!
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPartnerSelectMode(true)}
                  className="w-full p-5 rounded-4xl bg-dreamy-pink/20 border-2 border-white/40 hover:bg-dreamy-pink/30 flex items-center gap-4 transition-all group active:scale-[0.98] shadow-sm"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-dreamy-pink shadow-sm group-hover:scale-110 transition-transform">
                    <Users size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-black text-dreamy-dark text-lg">
                      With Partner
                    </div>
                    <div className="text-xs font-bold text-dreamy-slate">
                      Bring your bestie!
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    session.requestSolo();
                    setShowJoinOptions(false);
                  }}
                  className="w-full p-5 rounded-4xl bg-dreamy-yellow/20 border-2 border-white/40 hover:bg-dreamy-yellow/30 flex items-center gap-4 transition-all group active:scale-[0.98] shadow-sm"
                >
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-dreamy-yellow shadow-sm group-hover:scale-110 transition-transform">
                    <User size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-black text-dreamy-dark text-lg">
                      Solo Play
                    </div>
                    <div className="text-xs font-bold text-dreamy-slate">
                      Requires group vote
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-black uppercase tracking-widest text-dreamy-slate px-2">
                  Select your partner:
                </p>
                <div className="max-h-64 overflow-y-auto space-y-3 no-scrollbar py-1">
                  {availablePartners.length === 0 ? (
                    <div className="text-center text-dreamy-slate py-10 font-bold bg-white/40 rounded-3xl border-2 border-dashed border-white">
                      No one's online right now...
                    </div>
                  ) : (
                    availablePartners.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          session.joinQueuePartner(p.id);
                          setShowJoinOptions(false);
                          setPartnerSelectMode(false);
                        }}
                        className="w-full p-4 glass-card bg-white/60 hover:bg-white rounded-3xl text-left border-2 border-transparent hover:border-dreamy-pink/30 transition-all flex justify-between items-center group active:scale-[0.98] shadow-sm"
                      >
                        <span className="font-black text-dreamy-dark">
                          {p.name}
                        </span>
                        <div className="w-3 h-3 rounded-full bg-dreamy-green shadow-[0_0_8px_rgba(78,205,196,0.6)]"></div>
                      </button>
                    ))
                  )}
                </div>
                <Button
                  variant="ghost"
                  fullWidth
                  size="lg"
                  onClick={() => setPartnerSelectMode(false)}
                >
                  Back
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      )}

      <div className="mx-2 mb-2 p-2 glass-card border-2 border-white flex gap-1.5 rounded-2xl shadow-lg z-40 bg-white/80">
        {isMod && (
          <Button
            variant="success"
            size="square"
            onClick={() => {
              setModQueueMode("SELECT_PLAYER");
              setModSelectedPlayerId("");
              setShowModQueueModal(true);
            }}
            className="w-14 h-14 shrink-0 rounded-3xl ring-4 ring-white"
            title="Queue Custom Player"
          >
            <UserPlus size={24} />
          </Button>
        )}
        <Button
          fullWidth
          size="lg"
          onClick={() => setShowJoinOptions(true)}
          className="flex items-center justify-center gap-2 flex-1 h-14 rounded-3xl ring-4 ring-white"
        >
          <div className="w-7 h-7 bg-white/30 rounded-lg flex items-center justify-center">
            <Play size={16} className="fill-current" />
          </div>
          <span className="text-base font-black tracking-tight">
            Join Queue
          </span>
        </Button>
      </div>

      <ModQueueModal
        isOpen={showModQueueModal}
        onClose={() => setShowModQueueModal(false)}
        players={players}
        queue={queue}
        mode={modQueueMode}
        setMode={setModQueueMode}
        selectedPlayerId={modSelectedPlayerId}
        setSelectedPlayerId={setModSelectedPlayerId}
        session={session}
      />

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
      />
    </div>
  );
};

const ModQueueModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  queue: QueueEntry[];
  mode: "SELECT_PLAYER" | "SELECT_MODE" | "SELECT_PARTNER";
  setMode: (mode: "SELECT_PLAYER" | "SELECT_MODE" | "SELECT_PARTNER") => void;
  selectedPlayerId: string;
  setSelectedPlayerId: (id: string) => void;
  session: UsePeerSessionReturn;
}> = ({
  isOpen,
  onClose,
  players,
  queue,
  mode,
  setMode,
  selectedPlayerId,
  setSelectedPlayerId,
  session,
}) => {
  // Filter for custom players that are NOT currently in the queue
  const availableCustomPlayers = players.filter((p) => p.isCustom); // Allow re-queuing? Usually no.
  // Check if player is already in queue
  const isPlayerInQueue = (pid: string) =>
    Array.isArray(queue) &&
    queue.some((q) => q.playerIds && q.playerIds.includes(pid));

  const validCustomPlayers = availableCustomPlayers;

  const selectedPlayerName =
    (Array.isArray(players) &&
      players.find((p) => p.id === selectedPlayerId)?.name) ||
    "Unknown";

  // For partner selection, can choose ANYONE who is connected/custom and not me (the custom player)
  const availablePartners = players.filter(
    (p) => p.id !== selectedPlayerId && (p.isConnected || p.isCustom),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "SELECT_PLAYER"
          ? "Select Custom Player"
          : mode === "SELECT_MODE"
            ? `Queue ${selectedPlayerName}`
            : `Select Partner for ${selectedPlayerName}`
      }
      footer={
        <Button variant="ghost" onClick={onClose} fullWidth>
          Cancel
        </Button>
      }
    >
      <div className="space-y-3">
        {mode === "SELECT_PLAYER" && (
          <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
            {validCustomPlayers.length === 0 ? (
              <div className="text-center text-slate-500 py-4">
                No available custom players. Add one in the Players tab.
              </div>
            ) : (
              validCustomPlayers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPlayerId(p.id);
                    setMode("SELECT_MODE");
                  }}
                  className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-left font-bold text-white flex justify-between items-center"
                >
                  {p.name}
                  <span className="text-purple-400 text-xs uppercase">
                    Custom
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {mode === "SELECT_MODE" && (
          <div className="space-y-2">
            <button
              onClick={() => {
                session.joinQueueMatch(selectedPlayerId);
                onClose();
              }}
              className="w-full p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/50 hover:bg-cyan-500/20 flex items-center gap-3 transition-colors text-left"
            >
              <div className="p-2 bg-cyan-500 rounded-lg text-slate-900">
                <UserPlus size={20} />
              </div>
              <div>
                <div className="font-bold text-cyan-400">Duo Match</div>
              </div>
            </button>
            <button
              onClick={() => setMode("SELECT_PARTNER")}
              className="w-full p-4 rounded-xl bg-pink-500/10 border border-pink-500/50 hover:bg-pink-500/20 flex items-center gap-3 transition-colors text-left"
            >
              <div className="p-2 bg-pink-500 rounded-lg text-white">
                <Users size={20} />
              </div>
              <div>
                <div className="font-bold text-pink-400">With Partner</div>
              </div>
            </button>
            <button
              onClick={() => {
                session.requestSolo(selectedPlayerId, selectedPlayerName);
                onClose();
              }}
              className="w-full p-4 rounded-xl bg-orange-500/10 border border-orange-500/50 hover:bg-orange-500/20 flex items-center gap-3 transition-colors text-left"
            >
              <div className="p-2 bg-orange-500 rounded-lg text-white">
                <User size={20} />
              </div>
              <div>
                <div className="font-bold text-orange-400">Solo Play</div>
              </div>
            </button>
          </div>
        )}

        {mode === "SELECT_PARTNER" && (
          <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
            {availablePartners.length === 0 ? (
              <div className="text-center text-slate-500 py-4">
                No available partners.
              </div>
            ) : (
              availablePartners.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    session.joinQueuePartner(p.id, selectedPlayerId);
                    onClose();
                  }}
                  className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-left font-bold text-white flex justify-between items-center"
                >
                  {p.name}
                  {p.isCustom && (
                    <span className="text-purple-400 text-xs uppercase">
                      Custom
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
