
import React, { useState, useRef, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { Button } from '../components/Button';
import { Copy, Music, Play, Check, WifiOff, CheckCircle, ListOrdered, GripVertical, X, UserPlus, Users, User } from 'lucide-react';
import { GameState, QueueEntry, Player } from '../types';

interface QueueViewProps {
    gameState: GameState;
    myId: string;
    session: any; // Using explicit any for the hook return type to avoid circular dep complexity, or export the type from hook
    isHost: boolean;
}

export const QueueView: React.FC<QueueViewProps> = ({
    gameState,
    myId,
    session,
    isHost
}) => {
    const [showJoinOptions, setShowJoinOptions] = useState(false);
    const [partnerSelectMode, setPartnerSelectMode] = useState(false);
    const { currentSession, queue, players, sessionName, finishApprovals } = gameState;

    // Local state for dragging to prevent jitter
    const [localQueue, setLocalQueue] = useState(queue);

    // Ref for debouncing reorder
    const reorderTimeoutRef = useRef<any>(null);

    useEffect(() => {
        // Sync when source changes, unless we are potentially in a drag operation?
        // Actually framer motion handles the drag state on localQueue. 
        // We just need to make sure we don't overwrite if we are the ones reordering?
        // But since this is a simple P2P, simply syncing is safer to avoid desyncs.
        setLocalQueue(queue);
    }, [queue]);

    const handleReorder = (newOrder: QueueEntry[]) => {
        setLocalQueue(newOrder);

        if (isHost) {
            // Debounce the network call
            if (reorderTimeoutRef.current) {
                clearTimeout(reorderTimeoutRef.current);
            }

            reorderTimeoutRef.current = setTimeout(() => {
                session.reorderQueue(newOrder.map((q: any) => q.id));
            }, 500);
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(sessionName);
    };

    const getEntryColor = (type: string) => {
        switch (type) {
            case 'SOLO': return 'border-orange-500 bg-orange-500/10';
            case 'PARTNER': return 'border-pink-500 bg-pink-500/10';
            case 'MATCH': return 'border-cyan-500 bg-cyan-500/10';
            default: return 'border-slate-500';
        }
    }

    const getEntryIcon = (type: string) => {
        switch (type) {
            case 'SOLO': return <User size={16} className="text-orange-400" />;
            case 'PARTNER': return <Users size={16} className="text-pink-400" />;
            case 'MATCH': return <UserPlus size={16} className="text-cyan-400" />;
            default: return null;
        }
    }

    const availablePartners = players.filter((p: Player) => p.id !== myId && p.isConnected);
    const isMePlaying = currentSession?.playerIds.includes(myId);
    const haveIApprovedFinish = finishApprovals?.includes(myId);

    return (
        <div className="flex flex-col h-full relative">
            <div className="p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center shadow-md z-10">
                <div>
                    <h2 className="font-bold text-lg text-white">MaiQueue</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Code: <span className="font-mono text-cyan-400 font-bold text-base">{sessionName}</span></span>
                        <button onClick={copyCode} className="p-1 hover:text-white"><Copy size={12} /></button>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-2xl font-black text-cyan-400 leading-none">{queue.length}</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">Waiting</div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
                <div className="p-4 border-b border-slate-700 bg-slate-900">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Music size={14} className="text-pink-500 animate-pulse" /> Currently Playing
                    </h3>

                    {currentSession ? (
                        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700 shadow-inner relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <Play size={64} />
                            </div>
                            <div className="flex justify-between items-start mb-4 relative z-0">
                                <div className="flex gap-2 text-white font-bold text-lg">
                                    {currentSession.playerIds.map((id: string) => {
                                        const p = players.find((pl: any) => pl.id === id);
                                        const isDone = finishApprovals?.includes(id);
                                        return (
                                            <div key={id} className={`px-3 py-1 rounded-lg border border-slate-600 flex items-center gap-2 ${p?.isConnected ? 'bg-slate-700/50' : 'bg-red-500/20 border-red-500/50'}`}>
                                                {p?.name || 'Unknown'}
                                                {isDone && <Check size={14} className="text-green-400" />}
                                                {!p?.isConnected && <WifiOff size={12} className="text-red-400" />}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {isMePlaying && (
                                <Button
                                    fullWidth
                                    variant={haveIApprovedFinish ? "secondary" : "primary"}
                                    onClick={session.finishTurn}
                                    className="relative z-0"
                                    disabled={haveIApprovedFinish}
                                >
                                    {haveIApprovedFinish ? (
                                        <><Check size={20} className="mr-2 inline" /> Waiting for partner...</>
                                    ) : (
                                        <><CheckCircle size={20} className="mr-2 inline" /> Finish Turn</>
                                    )}
                                </Button>
                            )}
                            {!isMePlaying && (
                                <div className="text-center text-xs text-slate-500 italic">
                                    Players are playing... {finishApprovals?.length > 0 && `(${finishApprovals.length} finished)`}
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
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Up Next</h3>
                    {localQueue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50 py-8">
                            <ListOrdered size={48} />
                            <p>Queue is empty</p>
                        </div>
                    ) : (
                        <Reorder.Group axis="y" values={localQueue} onReorder={handleReorder} className="space-y-3">
                            {localQueue.map((item: QueueEntry, index: number) => {
                                const playersInEntry = item.playerIds.map(id => players.find((p: any) => p.id === id)).filter(Boolean);
                                const isMeIn = item.playerIds.includes(myId);

                                // Permission logic:
                                // User can remove if they are in it (Leave)
                                // Host can remove if they are NOT in it (Admin remove) or if they ARE in it (Leave)
                                // UI: Just a button, action determined by membership
                                const canRemove = isHost || isMeIn;

                                return (
                                    <Reorder.Item
                                        key={item.id}
                                        value={item}
                                        dragListener={isHost}
                                        className={`relative flex flex-col p-3 rounded-xl border-l-4 shadow-sm ${getEntryColor(item.type)} ${isMeIn ? 'bg-slate-800' : 'bg-slate-800/50'}`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                {isHost && <GripVertical size={16} className="text-slate-500 cursor-grab active:cursor-grabbing" />}
                                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shadow-inner">
                                                    {index + 1}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                                                    {getEntryIcon(item.type)}
                                                    {item.type}
                                                </div>
                                            </div>
                                            {canRemove && (
                                                <button
                                                    onClick={() => {
                                                        if (isMeIn) session.leaveQueue(item.id);
                                                        else if (isHost) session.removeFromQueue(item.id);
                                                    }}
                                                    className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex gap-2">
                                            <div className="flex-1 bg-slate-900/50 p-2 rounded-lg flex items-center justify-center text-sm font-medium text-white border border-slate-700/50">
                                                {playersInEntry[0]?.name || 'Unknown'}
                                                {playersInEntry[0]?.id === myId && ' (You)'}
                                                {!playersInEntry[0]?.isConnected && <WifiOff size={12} className="ml-2 text-red-500" />}
                                            </div>
                                            <div className={`flex-1 p-2 rounded-lg flex items-center justify-center text-sm font-medium border border-dashed ${item.type === 'SOLO' ? 'bg-orange-500/5 border-orange-500/30 text-orange-500/50' : 'bg-slate-900/30 border-slate-700 text-slate-500'}`}>
                                                {item.type === 'SOLO' ? (
                                                    <span className="text-xs uppercase font-bold">Locked</span>
                                                ) : (
                                                    playersInEntry[1] ? (
                                                        <div className="flex items-center">
                                                            {playersInEntry[1].name}
                                                            {playersInEntry[1].id === myId && ' (You)'}
                                                            {!playersInEntry[1].isConnected && <WifiOff size={12} className="ml-2 text-red-500" />}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs italic opacity-50">Waiting...</span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </Reorder.Item>
                                )
                            })}
                        </Reorder.Group>
                    )}
                </div>
            </div>

            {showJoinOptions && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-20 flex flex-col items-center justify-end p-4 animate-in fade-in duration-200">
                    <div className="w-full bg-slate-800 rounded-2xl p-4 shadow-2xl border border-slate-700 space-y-3">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-white">Choose Mode</h3>
                            <button onClick={() => { setShowJoinOptions(false); setPartnerSelectMode(false) }} className="p-2 bg-slate-700 rounded-full hover:bg-slate-600"><X size={16} /></button>
                        </div>

                        {!partnerSelectMode ? (
                            <>
                                <button onClick={() => { session.joinQueueMatch(); setShowJoinOptions(false); }} className="w-full p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/50 hover:bg-cyan-500/20 flex items-center gap-3 transition-colors text-left">
                                    <div className="p-2 bg-cyan-500 rounded-lg text-slate-900"><UserPlus size={20} /></div>
                                    <div>
                                        <div className="font-bold text-cyan-400">Duo Match</div>
                                        <div className="text-xs text-slate-400">Queue alone, match with anyone</div>
                                    </div>
                                </button>

                                <button onClick={() => setPartnerSelectMode(true)} className="w-full p-4 rounded-xl bg-pink-500/10 border border-pink-500/50 hover:bg-pink-500/20 flex items-center gap-3 transition-colors text-left">
                                    <div className="p-2 bg-pink-500 rounded-lg text-white"><Users size={20} /></div>
                                    <div>
                                        <div className="font-bold text-pink-400">With Partner</div>
                                        <div className="text-xs text-slate-400">Join together with a friend</div>
                                    </div>
                                </button>

                                <button onClick={() => { session.requestSolo(); setShowJoinOptions(false); }} className="w-full p-4 rounded-xl bg-orange-500/10 border border-orange-500/50 hover:bg-orange-500/20 flex items-center gap-3 transition-colors text-left">
                                    <div className="p-2 bg-orange-500 rounded-lg text-white"><User size={20} /></div>
                                    <div>
                                        <div className="font-bold text-orange-400">Solo Play</div>
                                        <div className="text-xs text-slate-400">Requires vote (&gt;50% approval)</div>
                                    </div>
                                </button>
                            </>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-slate-400 mb-2">Select your partner:</p>
                                <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                                    {availablePartners.length === 0 ? (
                                        <div className="text-center text-slate-500 py-4">No available partners</div>
                                    ) : (
                                        availablePartners.map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => { session.joinQueuePartner(p.id); setShowJoinOptions(false); setPartnerSelectMode(false); }}
                                                className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-left font-bold text-white flex justify-between items-center"
                                            >
                                                {p.name}
                                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            </button>
                                        ))
                                    )}
                                </div>
                                <Button variant="ghost" fullWidth onClick={() => setPartnerSelectMode(false)}>Back</Button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="p-4 bg-slate-800 border-t border-slate-700 sticky bottom-0 z-10">
                <Button fullWidth onClick={() => setShowJoinOptions(true)} className="flex items-center justify-center gap-2">
                    <Play size={20} className="fill-current" /> Join Queue
                </Button>
            </div>
        </div>
    );
};
