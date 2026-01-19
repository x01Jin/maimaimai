import React, { useState } from "react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Crown, Users, Trash2, UserPlus, ArrowDown } from "lucide-react";
import { GameState, Player } from "../types";
import { SessionAPI } from "../sessionTypes";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { KickModal } from "../components/KickModal";
import { motion, AnimatePresence } from "framer-motion";
import { useDoubleTap } from "../hooks/useDoubleTap";

interface PlayersViewProps {
  gameState: GameState;
  myId: string;
  session: SessionAPI;
  isMod: boolean;
}

export const PlayersView: React.FC<PlayersViewProps> = ({
  gameState,
  myId,
  session,
  isMod,
}) => {
  const [showTransferMod, setShowTransferMod] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  const players = (
    Array.isArray(gameState?.players) ? gameState.players : []
  ) as Player[];

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

  // Kick Modal State
  const [kickModalState, setKickModalState] = useState<{
    isOpen: boolean;
    playerId: string;
    playerName: string;
  }>({
    isOpen: false,
    playerId: "",
    playerName: "",
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

  const sortedPlayers = [...players].sort((a, b) => {
    // 1. Mod
    if (a.isMod !== b.isMod) return a.isMod ? -1 : 1;
    // 2. Self
    if ((a.uuid === session.myUuid) !== (b.uuid === session.myUuid))
      return a.uuid === session.myUuid ? -1 : 1;
    // 3. Connected
    if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
    // 4. Name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-4 glass-card border-b border-white dark:border-slate-800 flex justify-between items-center shadow-lg z-10 rounded-b-3xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 glass-card rounded-xl flex items-center justify-center border-2 border-white dark:border-slate-800 shadow-md text-dreamy-blue dark:text-midnight-blue bg-white/40 dark:bg-slate-900/40">
            <Users size={20} />
          </div>
          <div>
            <h2 className="font-black text-lg text-dreamy-dark dark:text-midnight-text tracking-tight leading-none">
              Players
            </h2>
            <div className="flex items-center gap-1.5 pt-0.5" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {players.filter((p) => p.isConnected).length} / {players.length}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMod && (
            <button
              onClick={() => setShowTransferMod(true)}
              className="w-10 h-10 flex items-center justify-center glass-card bg-white dark:bg-slate-900/90 rounded-xl text-dreamy-yellow dark:text-midnight-yellow transition-transform shadow-sm border border-slate-100 dark:border-slate-800"
              title="Transfer Mod"
            >
              <Crown size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-24 pt-4">
        <AnimatePresence>
          {sortedPlayers.map((p) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              style={{ willChange: "transform, opacity" }}
              key={p.id}
              className={`relative flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                p.isConnected
                  ? "bg-white/90 dark:bg-slate-900/90 border-white dark:border-slate-800 shadow-sm"
                  : "bg-white/40 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 opacity-60"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-sm border-2 border-white dark:border-slate-700 shrink-0 ${
                  p.isMod
                    ? "bg-dreamy-yellow dark:bg-midnight-yellow text-slate-800"
                    : p.uuid === session.myUuid
                      ? "bg-dreamy-blue dark:bg-midnight-blue text-white dark:text-slate-900"
                      : "bg-white dark:bg-slate-800 text-dreamy-slate dark:text-midnight-text"
                }`}
              >
                {p.isMod ? (
                  <Crown size={20} />
                ) : (
                  p.name.substring(0, 1).toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="font-black text-slate-800 dark:text-midnight-text truncate text-base tracking-tight leading-none">
                    {p.name}
                  </span>
                  <div className="flex gap-1">
                    {p.uuid === session.myUuid && (
                      <span className="px-1.5 py-0.5 bg-dreamy-blue dark:bg-midnight-blue text-white dark:text-slate-900 text-[8px] font-black uppercase rounded shadow-sm">
                        ME
                      </span>
                    )}
                    {p.isMod && (
                      <span className="px-1.5 py-0.5 bg-dreamy-yellow dark:bg-midnight-yellow text-slate-800 text-[8px] font-black uppercase rounded shadow-sm">
                        MOD
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${p.isCustom ? "bg-dreamy-purple dark:bg-midnight-purple" : p.isConnected ? "bg-dreamy-green dark:bg-midnight-green" : "bg-slate-300 dark:bg-slate-600"}`}
                  />
                  <span
                    className={`text-[8px] font-black uppercase tracking-widest ${
                      p.isCustom
                        ? "text-dreamy-purple dark:text-midnight-purple"
                        : p.isConnected
                          ? "text-slate-500 dark:text-slate-400"
                          : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {p.isCustom ? "Guest" : p.isConnected ? "Live" : "Offline"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {p.joinedAt && (
                  <span className="text-slate-500 dark:text-slate-400 text-[8px] font-black tracking-widest uppercase bg-white/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-lg border border-white dark:border-slate-700">
                    {new Date(p.joinedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                )}

                {/* Promote Button (If I am mod, and target is eligible) */}
                {isMod &&
                  !p.isMod &&
                  p.id !== myId &&
                  !p.isCustom &&
                  p.isConnected && (
                    <button
                      onClick={() => {
                        promptConfirm(
                          "Promote to Mod?",
                          `Pass the crown to ${p.name}?`,
                          () => session.transferMod(p.id),
                          "primary",
                          "Promote",
                        );
                      }}
                      className="w-9 h-9 flex items-center justify-center bg-white/60 dark:bg-slate-800/60 text-slate-300 dark:text-slate-500 rounded-xl transition-all border border-white dark:border-slate-700"
                      title="Promote to Mod"
                    >
                      <Crown size={16} />
                    </button>
                  )}

                {/* Demote Mod Button (If I am NOT mod, target IS mod, IS me or NOT? Demoting implies target is mod. 
                    So: !isMod && p.isMod && p.id !== myId. 
                    Actually, p.id !== myId is implied by !isMod & p.isMod? 
                    Yes, if I am not mod, and p is mod, then p is not me.
                */}
                {!isMod && p.isMod && (
                  <button
                    onClick={() => {
                      promptConfirm(
                        "Vote to Demote?",
                        `Start a democratic vote to remove ${p.name} as Mod? Requires >50% approval.`,
                        () => session.requestModDemotion(p.id),
                        "danger",
                        "Start Vote",
                      );
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-white/60 dark:bg-slate-800/60 text-red-200 dark:text-red-900/40 rounded-xl transition-all border border-white dark:border-slate-700"
                    title="Vote to Demote Mod"
                  >
                    <ArrowDown size={16} />
                  </button>
                )}

                {/* Kick Button (Mod Only -> Real Players) */}
                {isMod && !p.isMod && !p.isCustom && p.id !== myId && (
                  <KickButton
                    onAction={() =>
                      setKickModalState({
                        isOpen: true,
                        playerId: p.id,
                        playerName: p.name,
                      })
                    }
                  />
                )}

                {/* Resign Button (If I am mod and this is me) */}
                {isMod && p.id === myId && (
                  <button
                    onClick={() => {
                      promptConfirm(
                        "Step Down?",
                        "Are you sure you want to resign as Moderator?",
                        () => session.resignMod(),
                        "danger",
                        "Resign",
                      );
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-white/60 dark:bg-slate-800/60 text-amber-200 dark:text-amber-900/40 rounded-xl transition-all border border-white dark:border-slate-700"
                    title="Resign as Mod"
                  >
                    <ArrowDown size={16} />
                  </button>
                )}

                {isMod && p.isCustom && (
                  <button
                    onClick={() => {
                      promptConfirm(
                        "Remove Guest?",
                        `Are you sure you want to remove ${p.name}?`,
                        () => session.removeCustomPlayer(p.id),
                        "danger",
                        "Remove",
                      );
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-white/60 dark:bg-slate-800/60 text-red-200 dark:text-red-900/40 rounded-xl transition-all border border-white dark:border-slate-700"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mx-2 mb-2 p-2 glass-card border-2 border-white dark:border-slate-800 relative z-40 rounded-2xl shadow-xl flex gap-2">
        {isMod && (
          <Button
            fullWidth
            size="lg"
            variant="ghost"
            onClick={() => setShowAddPlayer(true)}
            className="h-12 rounded-full bg-white dark:bg-slate-900 text-dreamy-purple dark:text-midnight-purple shadow-sm border-transparent"
          >
            <div className="flex items-center justify-center gap-2">
              <UserPlus size={20} />
              <span className="text-base font-black tracking-tight">
                Add Guest
              </span>
            </div>
          </Button>
        )}
      </div>

      <Modal
        isOpen={showTransferMod}
        onClose={() => setShowTransferMod(false)}
        title="Pass the Crown"
        footer={
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setShowTransferMod(false)}
          >
            Stay as Mod
          </Button>
        }
      >
        <div className="space-y-4">
          <p className="text-dreamy-slate dark:text-slate-400 text-sm font-bold text-center px-4">
            Choose a worthy successor to lead this session!
          </p>
          <div className="max-h-64 overflow-y-auto space-y-2 no-scrollbar px-1 py-1">
            {players
              .filter(
                (p: Player) => p.id !== myId && p.isConnected && !p.isCustom,
              )
              .map((p: Player) => (
                <button
                  key={p.uuid}
                  onClick={() => {
                    session.transferMod(p.id);
                    setShowTransferMod(false);
                  }}
                  className="w-full p-4 glass-card bg-white/60 dark:bg-slate-800/60 rounded-3xl flex items-center justify-between text-dreamy-dark dark:text-midnight-text font-black border-2 border-transparent transition-all shadow-sm active:scale-[0.98]"
                >
                  <span>{p.name}</span>
                  <Crown
                    size={18}
                    className="text-dreamy-yellow dark:text-midnight-yellow"
                  />
                </button>
              ))}
            {players.filter(
              (p: Player) => p.id !== myId && p.isConnected && !p.isCustom,
            ).length === 0 && (
              <div className="text-center text-dreamy-slate dark:text-slate-400 py-10 font-bold bg-white/40 dark:bg-slate-800/40 rounded-3xl border-2 border-dashed border-white dark:border-slate-700">
                No active players to transfer to...
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        title="New Guest"
        footer={
          <div className="flex gap-3 w-full">
            <Button
              className="flex-1 rounded-full"
              variant="ghost"
              onClick={() => setShowAddPlayer(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-full"
              variant="primary"
              onClick={() => {
                if (newPlayerName.trim()) {
                  session.addCustomPlayer(newPlayerName.trim());
                  setNewPlayerName("");
                  setShowAddPlayer(false);
                }
              }}
              disabled={!newPlayerName.trim()}
            >
              Add Guest
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-dreamy-slate dark:text-slate-400 text-sm font-bold text-center leading-relaxed">
            Create a temporary player profile. You'll be able to manage their
            queue turns manually.
          </p>
          <div className="relative">
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Guest Name..."
              className="w-full glass-card bg-white/80 dark:bg-slate-900 font-black placeholder-dreamy-slate/30 dark:placeholder-slate-600 border-2 border-white dark:border-slate-700 rounded-4xl px-6 py-5 text-dreamy-dark dark:text-midnight-text focus:outline-none focus:ring-8 focus:ring-dreamy-purple/10 dark:focus:ring-midnight-purple/10 transition-all text-center text-2xl"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newPlayerName.trim()) {
                  session.addCustomPlayer(newPlayerName.trim());
                  setNewPlayerName("");
                  setShowAddPlayer(false);
                }
              }}
            />
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        variant={confirmModal.variant}
      />

      <KickModal
        isOpen={kickModalState.isOpen}
        onClose={() =>
          setKickModalState((prev) => ({ ...prev, isOpen: false }))
        }
        playerName={kickModalState.playerName}
        onKick={() => {
          session.kickSessionPlayer(kickModalState.playerId, false);
        }}
        onKickPermanently={() => {
          session.kickSessionPlayer(kickModalState.playerId, true);
        }}
      />
    </div>
  );
};

const KickButton: React.FC<{ onAction: () => void }> = ({ onAction }) => {
  const { isArmed, handleInteraction } = useDoubleTap(onAction);

  return (
    <button
      onClick={handleInteraction}
      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-white dark:border-slate-700 ${
        isArmed
          ? "bg-red-500 text-white animate-pulse shadow-red-500/50"
          : "bg-white/60 dark:bg-slate-800/60 text-slate-300 dark:text-slate-500"
      }`}
      title={isArmed ? "Tap again to open menu" : "Kick Player"}
    >
      <Trash2 size={16} />
    </button>
  );
};
