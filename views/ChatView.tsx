
import React, { useState, useRef, useEffect } from 'react';
import { Send, User } from 'lucide-react';
import { GameState } from '../types';

interface ChatViewProps {
    gameState: GameState;
    myId: string;
    myUuid: string;
    onSend: (msg: string) => void;
    onVote: (approve: boolean) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
    gameState,
    myId,
    myUuid,
    onSend,
    onVote
}) => {
    const [input, setInput] = useState('');
    const endRef = useRef<HTMLDivElement>(null);
    const { activeVote } = gameState;

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [gameState.messages]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim()) return;
        onSend(input);
        setInput('');
    };

    const hasVoted = activeVote?.approvals.includes(myId);

    return (
        <div className="flex flex-col h-full bg-slate-900 relative">
            {activeVote && (
                <div className="absolute top-4 left-4 right-4 z-20 animate-in slide-in-from-top-4 duration-300">
                    <div className="bg-slate-800 border border-orange-500/50 rounded-xl p-4 shadow-2xl">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className="font-bold text-orange-400 flex items-center gap-2">
                                    <User size={16} /> Solo Request
                                </h3>
                                <p className="text-sm text-slate-300">
                                    <span className="font-bold text-white">{activeVote.requesterName}</span> wants to play solo.
                                </p>
                            </div>
                            <div className="text-2xl font-black text-slate-500">
                                {activeVote.approvals.length}/{activeVote.required}
                            </div>
                        </div>

                        {!hasVoted && activeVote.requesterId !== myId && (
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => onVote(true)} className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 rounded-lg font-bold transition-colors">
                                    Approve
                                </button>
                            </div>
                        )}
                        {hasVoted && (
                            <div className="text-center text-xs text-slate-500 mt-2 font-bold uppercase tracking-wider">
                                Vote Cast
                            </div>
                        )}
                        {activeVote.requesterId === myId && (
                            <div className="text-center text-xs text-slate-500 mt-2 italic">
                                Waiting for votes...
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar pt-4">
                {activeVote && <div className="h-28"></div>}

                {gameState.messages.map((msg: any) => {
                    if (msg.isSystem) {
                        return (
                            <div key={msg.id} className="text-center text-xs text-slate-500 my-2 italic px-8">
                                {msg.content}
                            </div>
                        )
                    }
                    // Use UUID if available for persistent identity, fallback to ID if legacy/system
                    const isMe = msg.senderUuid ? msg.senderUuid === myUuid : msg.senderId === myId;

                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`text-xs mb-1 text-slate-400 ${isMe ? 'mr-1' : 'ml-1'}`}>{msg.senderName}</div>
                            <div
                                className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm break-words shadow-sm ${isMe
                                    ? 'bg-cyan-500 text-slate-900 rounded-tr-none'
                                    : 'bg-slate-700 text-white rounded-tl-none'
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 bg-slate-800 border-t border-slate-700 flex gap-2">
                <input
                    className="flex-1 bg-slate-700 border-none rounded-full px-4 text-white focus:ring-2 focus:ring-cyan-400 outline-none text-sm"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button
                    type="submit"
                    disabled={!input.trim()}
                    className="w-10 h-10 bg-cyan-400 rounded-full flex items-center justify-center text-slate-900 hover:bg-cyan-300 disabled:opacity-50 transition-colors"
                >
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
};
