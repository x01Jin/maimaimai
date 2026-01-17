import React, { useState, useRef, useEffect } from "react";
import { Send, User, Smile, Reply, X, Plus } from "lucide-react";
import { GameState, ChatMessage } from "../types";

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
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReact: (messageId: string, emoji: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  gameState,
  myId,
  myUuid,
  onSend,
  onVote,
  onReact,
  onRemoveReact,
}) => {
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState<string | null>(
    null,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const { activeVote } = gameState;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [gameState.messages]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && !replyingTo) return;
    onSend(input, replyingTo?.id);
    setInput("");
    setReplyingTo(null);
  };

  const emojiList = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

  const renderContent = (msg: ChatMessage) => {
    // Mention highlighting
    const parts = msg.content.split(/(@\w+)/g);
    return (
      <span className="whitespace-pre-wrap">
        {parts.map((part, i) => {
          if (part.startsWith("@")) {
            const name = part.substring(1);
            const player = gameState.players.find((p) => p.name === name);
            if (player) {
              const isMe = player.uuid === myUuid;
              return (
                <span
                  key={i}
                  className={`font-bold px-1 rounded ${isMe ? "text-white bg-cyan-600" : "text-cyan-400 bg-cyan-400/10"}`}
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

  const hasVoted = activeVote?.approvals.includes(myId);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const myPlayerName =
    gameState.players.find((p) => p.uuid === myUuid)?.name || "";

  return (
    <div className="flex flex-col h-full bg-slate-900 relative text-slate-200 overflow-hidden">
      {/* Header / Active Vote Overlay */}
      {activeVote && (
        <div className="absolute top-0 left-0 right-0 z-30 p-2 bg-slate-800/80 backdrop-blur-md border-b border-slate-700">
          <div className="bg-slate-800 rounded-md p-3 shadow-lg flex items-center justify-between border-l-4 border-orange-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center text-orange-500">
                <User size={20} />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-orange-400 opacity-80">
                  Solo Request Active
                </div>
                <div className="text-sm font-semibold text-white">
                  {activeVote.requesterName} wants to play solo
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-400">VOTES</div>
                <div className="text-lg font-black text-white leading-none">
                  {activeVote.approvals.length}
                  <span className="text-slate-500 mx-0.5 text-sm">/</span>
                  {activeVote.required}
                </div>
              </div>

              {!hasVoted && activeVote.requesterId !== myId && (
                <button
                  onClick={() => onVote(true)}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded font-bold text-xs transition-colors shadow-sm"
                >
                  APPROVE
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-0 pt-1 pb-1 no-scrollbar scroll-smooth">
        {/* Placeholder for header spacing when vote is active */}
        {activeVote && <div className="h-16"></div>}

        {gameState.messages.map((msg: ChatMessage, idx) => {
          if (msg.isSystem) {
            return (
              <div
                key={msg.id}
                className="group flex flex-row-reverse px-4 py-[2px] transition-colors hover:bg-slate-800/50"
              >
                <span className="text-[11px] font-medium text-slate-500 opacity-50">
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

          // Check if previous message was from same user within 7 minutes
          const prevMsg = idx > 0 ? gameState.messages[idx - 1] : null;
          const isCompact =
            prevMsg &&
            !prevMsg.isSystem &&
            (msg.senderUuid
              ? prevMsg.senderUuid === msg.senderUuid
              : prevMsg.senderId === msg.senderId) &&
            msg.timestamp - prevMsg.timestamp < 420000 &&
            !msg.replyToId; // Don't group if it's a reply

          const isModNow = !!gameState.players.find(
            (p) => p.uuid === msg.senderUuid || p.id === msg.senderId,
          )?.isMod;
          const wasModThen = !!msg.senderIsMod;
          const isExMod = wasModThen && !isModNow;

          // Mentions or Replies to me
          const isMentioned = msg.content.includes(`@${myPlayerName}`);
          const isReplyToMe = replyMsg && replyMsg.senderUuid === myUuid;
          const isHighlighted = isMentioned || isReplyToMe;

          return (
            <div
              key={msg.id}
              className={`group relative flex flex-col px-2 ${isCompact ? "mt-0 py-[0.5px]" : "mt-3.5 py-[2px]"} transition-colors hover:bg-slate-800/10 ${idx === 0 ? "mt-2" : ""} ${isHighlighted ? "border-l-4 border-cyan-500/50 bg-cyan-900/10" : ""}`}
            >
              {/* Reply Reference Line */}
              {replyMsg && (
                <div className="ml-10 -mb-[2px] flex items-center gap-1 text-[13px] text-slate-400 opacity-80">
                  <div className="w-[18px] h-[9px] border-l-2 border-t-2 border-slate-600 rounded-tl-[4px] mt-[10px] -mr-[1px]"></div>
                  <div className="w-[14px] h-[14px] rounded-full bg-slate-700 flex-shrink-0 flex items-center justify-center -ml-[3px]">
                    <Reply size={9} className="text-slate-300" />
                  </div>
                  <span
                    className={`font-semibold hover:underline cursor-pointer truncate max-w-[150px] ${replyMsg.senderUuid === myUuid ? "text-cyan-400" : ""}`}
                  >
                    @{replyMsg.senderName}
                  </span>
                  <span className="truncate opacity-50 italic text-[12px] ml-1">
                    {replyMsg.content}
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                {/* Avatar Column */}
                <div className="flex-shrink-0 w-10 flex justify-center">
                  {!isCompact ? (
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-slate-900 font-bold shadow-md ${
                        isMe ? "bg-cyan-400" : "bg-slate-700 text-slate-100"
                      }`}
                    >
                      {msg.senderName.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <div className="w-10 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity leading-none">
                      {formatTime(msg.timestamp)}
                    </div>
                  )}
                </div>

                {/* Content Column */}
                <div className="flex-1 min-w-0 flex flex-col">
                  {!isCompact && (
                    <div className="flex items-center gap-2 mb-[1px]">
                      <span
                        className={`cursor-pointer text-sm font-semibold hover:underline ${isModNow ? "text-orange-400" : isMe ? "text-cyan-400" : "text-white"}`}
                      >
                        {msg.senderName}
                      </span>
                      {wasModThen && (
                        <span
                          className={`rounded-[3px] px-1 text-[10px] font-black uppercase tracking-tighter shadow-sm ${isModNow ? "bg-orange-400 text-slate-900" : "bg-slate-600 text-slate-300 opacity-60"}`}
                          title={isExMod ? "Former Mod" : "Moderator"}
                        >
                          MOD
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 font-medium">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  <div className="text-[15px] leading-[1.3rem] text-slate-200 break-words">
                    {renderContent(msg)}
                  </div>

                  {/* Reactions Display */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {Object.entries(msg.reactions).map(([emoji, users]) => {
                        const iReacted = users.includes(myId);
                        return (
                          <button
                            key={emoji}
                            onClick={() =>
                              iReacted
                                ? onRemoveReact(msg.id, emoji)
                                : onReact(msg.id, emoji)
                            }
                            className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-[13px] font-bold transition-all border ${
                              iReacted
                                ? "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                                : "bg-slate-800 border-transparent hover:border-slate-600 text-slate-400"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-xs">{users.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Toolbar on Hover */}
              <div className="absolute -top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <div className="flex items-center bg-slate-800 border border-slate-700 rounded-[4px] shadow-lg overflow-hidden h-[32px]">
                  <button
                    onClick={() =>
                      setShowEmojiPickerFor(
                        showEmojiPickerFor === msg.id ? null : msg.id,
                      )
                    }
                    className="w-8 h-full flex items-center justify-center hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border-r border-slate-700"
                    title="Add Reaction"
                  >
                    <Smile size={18} />
                  </button>
                  <button
                    onClick={() => setReplyingTo(msg)}
                    className="w-8 h-full flex items-center justify-center hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Reply"
                  >
                    <Reply size={18} />
                  </button>
                </div>
              </div>

              {/* Inline Emoji Picker */}
              {showEmojiPickerFor === msg.id && (
                <div className="absolute right-4 top-6 z-20 bg-slate-800 border border-slate-700 p-1.5 rounded-lg shadow-2xl flex gap-1 animate-in zoom-in-95 duration-75 origin-top-right">
                  {emojiList.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReact(msg.id, emoji);
                        setShowEmojiPickerFor(null);
                      }}
                      className="hover:scale-125 hover:bg-slate-700 p-1.5 rounded transition-all text-xl"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} className="h-4" />
      </div>

      {/* Input Container */}
      <div className="px-1 pb-2 pt-1 bg-slate-900">
        {replyingTo && (
          <div className="px-4 py-1.5 bg-slate-800/50 border-l-2 border-cyan-500 rounded-t-lg flex items-center justify-between text-[11px] animate-in slide-in-from-bottom-2 mx-1">
            <div className="flex items-center gap-2 text-slate-400 overflow-hidden">
              <span className="opacity-60">Replying to</span>
              <span className="text-white font-bold">
                @{replyingTo.senderName}
              </span>
              <span className="truncate opacity-40 italic">
                {replyingTo.content}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 text-slate-500 hover:text-white transition-colors bg-slate-700/50 rounded-full"
            >
              <X size={12} />
            </button>
          </div>
        )}
        <form
          onSubmit={handleSend}
          className={`relative mx-1 flex items-center bg-[#383a40] rounded-lg px-4 gap-2 min-h-[44px] ${replyingTo ? "rounded-t-none border-t border-slate-700/20" : ""}`}
        >
          <input
            className="flex-1 bg-transparent border-none py-3 text-slate-100 placeholder-slate-500 focus:outline-none text-[16px]"
            placeholder={
              replyingTo
                ? `Replying to ${replyingTo.senderName}...`
                : "Type a message..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={!input.trim() && !replyingTo}
              className={`p-1.5 rounded-md transition-all ${
                input.trim() || replyingTo
                  ? "text-cyan-400 hover:bg-cyan-500/10 scale-105"
                  : "text-slate-600 opacity-40 cursor-not-allowed"
              }`}
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
