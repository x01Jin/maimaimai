import React, { useState, useRef, useEffect } from "react";
import { useDoubleTap } from "../hooks/useDoubleTap";
import { Reorder, useDragControls } from "framer-motion";
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
      className={`px-2 py-1 text-xs transition-all duration-300 rounded font-bold ${
        isArmed
          ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/50"
          : "text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-slate-700"
      }`}
      title={isArmed ? "Click again to confirm" : "Leave Queue"}
    >
      {isArmed ? "SURE?" : "Leave"}
    </button>
  );
};

const QueueItem: React.FC<QueueItemProps> = ({
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
  const playersInEntry = item.playerIds
    .map((id) => players.find((p: any) => p.id === id))
    .filter(Boolean);
  const isMeIn = item.playerIds.includes(myId);
  const canLeave = isMeIn;
  const canRemove = isMod && !isMeIn;

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className={`relative flex flex-col p-3 rounded-xl border-l-4 shadow-sm ${getEntryColor(item.type)} ${isMeIn ? "bg-slate-800" : "bg-slate-800/50"}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isMod && (
            <div
              onPointerDown={(e) => controls.start(e)}
              className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1"
            >
              <GripVertical size={20} className="text-slate-500" />
            </div>
          )}
          <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shadow-inner">
            {index + 1}
          </div>
          <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
            {getEntryIcon(item.type)}
            {item.type}
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
              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
              title="Remove Queue Entry"
            >
              <X size={16} />
            </button>
          )}
          {isMod && isMeIn && (
            <button
              onClick={() => {
                promptConfirm(
                  "Remove Queue Entry?",
                  "As a mod, you cannot remove a queue you are currently in. Please leave the queue first.",
                  () => {},
                  "neutral",
                  "OK",
                );
              }}
              className="p-1 text-slate-600 hover:text-slate-400 transition-colors opacity-50 cursor-not-allowed"
              title="Cannot remove your own queue"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 bg-slate-900/50 p-2 rounded-lg flex items-center justify-between text-sm font-medium text-white border border-slate-700/50 relative">
          <div className="flex items-center gap-2">
            {playersInEntry[0]?.name || "Unknown"}
            {playersInEntry[0]?.id === myId && " (You)"}
            {!playersInEntry[0]?.isConnected && (
              <WifiOff size={12} className="text-red-500" />
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
              className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-slate-800/50 rounded-md"
              title="Kick Player"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div
          className={`flex-1 p-2 rounded-lg flex items-center justify-center text-sm font-medium border border-dashed ${item.type === "SOLO" ? "bg-orange-500/5 border-orange-500/30 text-orange-500/50" : "bg-slate-900/30 border-slate-700 text-slate-500"} relative`}
        >
          {item.type === "SOLO" ? (
            <span className="text-xs uppercase font-bold">Locked</span>
          ) : playersInEntry[1] ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center">
                {playersInEntry[1].name}
                {playersInEntry[1].id === myId && " (You)"}
                {!playersInEntry[1].isConnected && (
                  <WifiOff size={12} className="ml-2 text-red-500" />
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
                  className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-slate-800/50 rounded-md"
                  title="Kick Player"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs italic opacity-50">Waiting...</span>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
};

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

  const { currentSession, queue, players, sessionName, finishApprovals } =
    gameState;

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
        return "border-orange-500 bg-orange-500/10";
      case "PARTNER":
        return "border-pink-500 bg-pink-500/10";
      case "MATCH":
        return "border-cyan-500 bg-cyan-500/10";
      default:
        return "border-slate-500";
    }
  };

  const getEntryIcon = (type: string) => {
    switch (type) {
      case "SOLO":
        return <User size={16} className="text-orange-400" />;
      case "PARTNER":
        return <Users size={16} className="text-pink-400" />;
      case "MATCH":
        return <UserPlus size={16} className="text-cyan-400" />;
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
      <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
        <div>
          <h2 className="font-bold text-lg text-white">MaiMaiMai</h2>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>
              Code:{" "}
              <span className="font-mono text-cyan-400 font-bold text-base">
                {sessionName}
              </span>
            </span>
            <button onClick={copyCode} className="p-1 hover:text-white">
              <Copy size={12} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-black text-cyan-400 leading-none">
              {queue.reduce((acc, entry) => acc + entry.playerIds.length, 0)}
            </div>
            <div className="text-xs text-slate-500 uppercase font-bold">
              Waiting
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="p-4 border-b border-slate-700 bg-slate-900">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Music size={14} className="text-pink-500 animate-pulse" />{" "}
            Currently Playing
          </h3>

          {currentSession ? (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700 shadow-inner relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                <Play size={64} />
              </div>
              <div className="flex justify-between items-start mb-4 relative z-0">
                <div className="flex gap-2 text-white font-bold text-base w-full">
                  {currentSession.playerIds.map((id: string) => {
                    const p = players.find((pl: any) => pl.id === id);
                    const isDone = finishApprovals?.includes(id);
                    return (
                      <div
                        key={id}
                        className={`flex-1 px-3 py-1 rounded-lg border border-slate-600 flex items-center justify-between gap-2 ${p?.isConnected ? "bg-slate-700/50" : "bg-red-500/20 border-red-500/50"}`}
                      >
                        <div className="flex items-center gap-2">
                          {p?.name || "Unknown"}
                          {isDone && (
                            <Check size={14} className="text-green-400" />
                          )}
                          {!p?.isConnected && (
                            <WifiOff size={12} className="text-red-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-2 relative z-0 items-stretch">
                {isMePlaying && (
                  <Button
                    className="flex-1 px-3 py-2 text-sm h-14"
                    variant={haveIApprovedFinish ? "secondary" : "primary"}
                    onClick={() =>
                      promptConfirm(
                        "Finish Turn?",
                        "Are you sure you want to finish your turn?",
                        session.finishTurn,
                        "primary",
                        "Yes, Finish",
                      )
                    }
                    disabled={haveIApprovedFinish}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <CheckCircle size={18} className="mb-0.5" />
                      <span className="font-bold">
                        {haveIApprovedFinish ? "Waiting..." : "Finish Turn"}
                      </span>
                    </div>
                  </Button>
                )}

                {isMod && customPlayersInSession.length > 0 && (
                  <Button
                    className="flex-1 px-3 py-2 text-sm h-14"
                    variant={
                      unfinishedCustomPlayers.length === 0
                        ? "secondary"
                        : "success"
                    }
                    onClick={() => {
                      const names = unfinishedCustomPlayers
                        .map((p) => p.name)
                        .join(" & ");
                      promptConfirm(
                        "Finish Guest Turn?",
                        `Are you sure you want to finish the turn for ${names}?`,
                        () => {
                          unfinishedCustomPlayers.forEach((p) =>
                            session.finishTurn(p.id),
                          );
                        },
                        "primary",
                        "Yes, Finish",
                      );
                    }}
                    disabled={unfinishedCustomPlayers.length === 0}
                  >
                    <div className="flex flex-col items-center justify-center leading-tight">
                      <Check size={18} className="mb-0.5" />
                      <span className="truncate w-full font-bold">
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
                    className="w-14 h-14 shrink-0"
                    onClick={() =>
                      promptConfirm(
                        "Force Finish Turn?",
                        "Are you sure you want to force finish the current turn? This will immediately clear the current session.",
                        session.forceFinishTurn,
                        "danger",
                        "Force Finish",
                      )
                    }
                    title="Force Finish"
                  >
                    <Ban size={24} />
                  </Button>
                )}
              </div>

              {!isMePlaying && !isMod && (
                <div className="text-center text-xs text-slate-500 italic">
                  Players are playing...{" "}
                  {finishApprovals?.length > 0 &&
                    `(${finishApprovals.length} finished)`}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-center text-slate-500 bg-slate-800/30 rounded-xl border border-dashed border-slate-700">
              No one is playing right now.
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Up Next
          </h3>
          {localQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50 py-8">
              <ListOrdered size={48} />
              <p>Queue is empty</p>
            </div>
          ) : (
            <Reorder.Group
              axis="y"
              values={localQueue}
              onReorder={handleReorder}
              className="space-y-3"
            >
              {localQueue.map((item: QueueEntry, index: number) => (
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
              ))}
            </Reorder.Group>
          )}
        </div>
      </div>

      {showJoinOptions && (
        <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-20 flex flex-col items-center justify-end p-4 animate-in fade-in duration-200">
          <div className="w-full bg-slate-800 rounded-2xl p-4 shadow-2xl border border-slate-700 space-y-3">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-white">Choose Mode</h3>
              <button
                onClick={() => {
                  setShowJoinOptions(false);
                  setPartnerSelectMode(false);
                }}
                className="p-2 bg-slate-700 rounded-full hover:bg-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            {!partnerSelectMode ? (
              <>
                <button
                  onClick={() => {
                    session.joinQueueMatch();
                    setShowJoinOptions(false);
                  }}
                  className="w-full p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/50 hover:bg-cyan-500/20 flex items-center gap-3 transition-colors text-left"
                >
                  <div className="p-2 bg-cyan-500 rounded-lg text-slate-900">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-cyan-400">Duo Match</div>
                    <div className="text-xs text-slate-400">
                      Queue alone, match with anyone
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPartnerSelectMode(true)}
                  className="w-full p-4 rounded-xl bg-pink-500/10 border border-pink-500/50 hover:bg-pink-500/20 flex items-center gap-3 transition-colors text-left"
                >
                  <div className="p-2 bg-pink-500 rounded-lg text-white">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-pink-400">With Partner</div>
                    <div className="text-xs text-slate-400">
                      Join together with a friend
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    session.requestSolo();
                    setShowJoinOptions(false);
                  }}
                  className="w-full p-4 rounded-xl bg-orange-500/10 border border-orange-500/50 hover:bg-orange-500/20 flex items-center gap-3 transition-colors text-left"
                >
                  <div className="p-2 bg-orange-500 rounded-lg text-white">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-orange-400">Solo Play</div>
                    <div className="text-xs text-slate-400">
                      Requires vote (&gt;50% approval)
                    </div>
                  </div>
                </button>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-slate-400 mb-2">
                  Select your partner:
                </p>
                <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                  {availablePartners.length === 0 ? (
                    <div className="text-center text-slate-500 py-4">
                      No available partners
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
                        className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-left font-bold text-white flex justify-between items-center"
                      >
                        {p.name}
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      </button>
                    ))
                  )}
                </div>
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => setPartnerSelectMode(false)}
                >
                  Back
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="p-4 bg-slate-800 border-t border-slate-700 sticky bottom-0 z-10 flex gap-2">
        {isMod && (
          <Button
            variant="success"
            size="square"
            onClick={() => {
              setModQueueMode("SELECT_PLAYER");
              setModSelectedPlayerId("");
              setShowModQueueModal(true);
            }}
            className="w-14 h-14 shrink-0"
            title="Queue Custom Player"
          >
            <Play size={24} className="fill-current" />
          </Button>
        )}
        <Button
          fullWidth
          onClick={() => setShowJoinOptions(true)}
          className="flex items-center justify-center gap-2 flex-1"
        >
          <Play size={20} className="fill-current" /> Join Queue
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
    queue.some((q) => q.playerIds.includes(pid));

  const validCustomPlayers = availableCustomPlayers.filter(
    (p) => !isPlayerInQueue(p.id),
  );

  const selectedPlayerName =
    players.find((p) => p.id === selectedPlayerId)?.name || "Unknown";

  // For partner selection, can choose ANYONE who is connected/custom and not me (the custom player)
  const availablePartners = players.filter(
    (p) =>
      p.id !== selectedPlayerId &&
      (p.isConnected || p.isCustom) &&
      !isPlayerInQueue(p.id),
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
