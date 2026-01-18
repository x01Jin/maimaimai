import React, { useState } from "react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Crown, Users, Trash2 } from "lucide-react";
import { GameState, Player } from "../types";
import { UsePeerSessionReturn } from "../hooks/usePeerSession";
import { ConfirmationModal } from "../components/ConfirmationModal";

interface PlayersViewProps {
  gameState: GameState;
  myId: string;
  session: UsePeerSessionReturn;
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
  const players = gameState.players as Player[];

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

  const sortedPlayers = [...players].sort((a, b) => {
    // 1. Mod
    if (a.isMod !== b.isMod) return a.isMod ? -1 : 1;
    // 2. Self
    if ((a.id === myId) !== (b.id === myId)) return a.id === myId ? -1 : 1;
    // 3. Connected
    if (a.isConnected !== b.isConnected) return a.isConnected ? -1 : 1;
    // 4. Name
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full relative">
      <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
        <div>
          <h2 className="font-bold text-lg text-white">Players</h2>
          <p className="text-xs text-slate-400">
            {players.filter((p) => p.isConnected).length} Online /{" "}
            {players.length} Total
          </p>
        </div>
        <div className="flex items-center gap-4">
          {isMod && (
            <>
              <button
                onClick={() => setShowAddPlayer(true)}
                className="px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-xs font-bold border border-green-500/50 transition-colors"
              >
                + Add Player
              </button>
              <button
                onClick={() => setShowTransferMod(true)}
                className="p-2 bg-slate-700 rounded-full text-yellow-400 hover:bg-slate-600 shadow-sm border border-slate-600"
                title="Transfer Mod"
              >
                <Crown size={16} />
              </button>
            </>
          )}
          <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
            <Users size={20} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pb-32">
        {sortedPlayers.map((p) => (
          <div
            key={p.uuid}
            className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all ${
              p.isConnected
                ? "bg-slate-800 border-slate-700 shadow-sm"
                : "bg-slate-800/30 border-slate-800 opacity-50"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-inner shrink-0 ${
                p.isMod
                  ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-slate-900"
                  : p.id === myId
                    ? "bg-gradient-to-br from-cyan-400 to-blue-500 text-slate-900"
                    : "bg-slate-700 text-slate-300"
              }`}
            >
              {p.isMod ? (
                <Crown size={20} />
              ) : (
                p.name.substring(0, 1).toUpperCase()
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-white truncate text-lg leading-tight">
                  {p.name}
                </span>
                <div className="flex gap-1">
                  {p.id === myId && (
                    <span className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 text-[10px] font-bold uppercase rounded border border-cyan-500/20">
                      You
                    </span>
                  )}
                  {p.isMod && (
                    <span className="px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold uppercase rounded border border-yellow-500/20">
                      Mod
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div
                  className={`w-2 h-2 rounded-full ${p.isCustom ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]" : p.isConnected ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-slate-600"}`}
                />
                <span
                  className={
                    p.isCustom
                      ? "text-purple-400 font-bold"
                      : p.isConnected
                        ? "text-slate-400"
                        : "text-slate-600"
                  }
                >
                  {p.isCustom ? "Custom" : p.isConnected ? "Online" : "Offline"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0">
              {p.joinedAt && (
                <span className="text-slate-600 text-[10px] font-medium whitespace-nowrap">
                  {new Date(p.joinedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              {isMod && (
                <div className="w-10 h-10 flex items-center justify-center">
                  {p.isCustom ? (
                    <button
                      onClick={() => {
                        promptConfirm(
                          "Remove Custom Player?",
                          `Are you sure you want to remove ${p.name}? This will also remove them from any current queues.`,
                          () => session.removeCustomPlayer(p.id),
                          "danger",
                          "Remove",
                        );
                      }}
                      className="w-10 h-10 flex items-center justify-center bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700/50 hover:border-red-500/30"
                      title="Remove Custom Player"
                    >
                      <Trash2 size={18} />
                    </button>
                  ) : (
                    <div className="w-10" />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Transfer Mod Modal */}
      <Modal
        isOpen={showTransferMod}
        onClose={() => setShowTransferMod(false)}
        title="Transfer Mod Role"
        footer={
          <Button variant="ghost" onClick={() => setShowTransferMod(false)}>
            Cancel
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">
            Select a player to transfer mod duties to. You will remain in the
            session as a regular participant.
          </p>
          <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
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
                  className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-between text-white font-bold"
                >
                  {p.name}
                  <Crown size={16} className="text-slate-500" />
                </button>
              ))}
            {players.filter((p: Player) => p.id !== myId && p.isConnected)
              .length === 0 && (
              <div className="text-center text-slate-500">
                No available players
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Add Player Modal */}
      <Modal
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        title="Add Custom Player"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="ghost" onClick={() => setShowAddPlayer(false)}>
              Cancel
            </Button>
            <Button
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
              Add Player
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Create a temporary player for someone without a device. You can
            manage their queue actions.
          </p>
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter player name..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
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
    </div>
  );
};
