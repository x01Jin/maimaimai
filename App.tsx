import React, { useState, useEffect } from 'react';
import { usePeerSession } from './hooks/usePeerSession';
import { ConnectionStatus, Player, QueueEntry } from './types';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { Modal } from './components/Modal';
import { getIdentity, getRecentSessions, RecentSession } from './utils/storage';
import { Users, Play, LogOut, Send, MessageSquare, ListOrdered, Share2, Copy, UserPlus, User, ThumbsUp, X, CheckCircle, Music, Clock, Crown, WifiOff, RefreshCw } from 'lucide-react';

const LandingView = ({
  onHost,
  onJoin,
  isConnecting,
  error
}: {
  onHost: (name: string) => void,
  onJoin: (code: string, name: string) => void,
  isConnecting: boolean,
  error: string | null
}) => {
  const [name, setName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'join'>('menu');
  const [history, setHistory] = useState<RecentSession[]>([]);

  useEffect(() => {
    const id = getIdentity();
    if (id.name) setName(id.name);
    setHistory(getRecentSessions());
  }, []);

  if (mode === 'join') {
    return (
      <div className="flex flex-col h-full p-6 justify-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500 mb-2">
            Join Session
          </h1>
          <p className="text-slate-400">Enter the code from the host</p>
        </div>

        <div className="space-y-4">
          <Input
            placeholder="Your IGN (In-Game Name)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
          />
          <Input
            placeholder="Session Code (e.g., A1B2)"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="space-y-3 mt-4">
          <Button
            fullWidth
            onClick={() => onJoin(sessionCode, name)}
            disabled={!name.trim() || !sessionCode.trim() || isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Join Session'}
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setMode('menu')} disabled={isConnecting}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 justify-center gap-8 animate-in fade-in zoom-in-95 duration-500 overflow-y-auto">
      <div className="text-center space-y-2 pt-4">
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-pink-500 rounded-full flex items-center justify-center shadow-xl shadow-pink-500/20">
            <Users className="w-10 h-10 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          Mai<span className="text-cyan-400">Queue</span>
        </h1>
        <p className="text-slate-400 text-lg">Queue management for local sessions</p>
      </div>

      <div className="space-y-4 w-full">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="bg-slate-800/50 p-4 rounded-2xl border border-slate-700 mb-4">
          <Input
            label="Set your IGN"
            placeholder="Enter Name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-2"
            maxLength={12}
          />
        </div>

        <Button
          fullWidth
          variant="primary"
          onClick={() => onHost(name)}
          disabled={!name.trim() || isConnecting}
        >
          {isConnecting ? 'Creating...' : 'Host New Session'}
        </Button>
        <Button
          fullWidth
          variant="secondary"
          onClick={() => setMode('join')}
        >
          Join Existing Session
        </Button>
      </div>

      {history.length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Clock size={14} /> Recent</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <button
                key={i}
                onClick={() => onJoin(h.code, name)}
                disabled={!name.trim()}
                className="w-full bg-slate-800/50 hover:bg-slate-800 p-3 rounded-xl flex justify-between items-center text-left border border-slate-700 transition-colors"
              >
                <span className="font-mono font-bold text-cyan-400">{h.code}</span>
                <span className="text-xs text-slate-500">
                  {new Date(h.lastJoined).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const QueueView = ({
  gameState,
  myId,
  session,
  isHost
}: {
  gameState: any,
  myId: string,
  session: any,
  isHost: boolean
}) => {
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [partnerSelectMode, setPartnerSelectMode] = useState(false);
  const [showPassHost, setShowPassHost] = useState(false);
  const { currentSession, queue, players, sessionName } = gameState;

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
          {isHost && (
            <button
              onClick={() => setShowPassHost(true)}
              className="p-2 bg-slate-700 rounded-full text-yellow-400 hover:bg-slate-600"
              title="Pass Host"
            >
              <Crown size={16} />
            </button>
          )}
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
                  {currentSession.playerIds.map(id => {
                    const p = players.find((pl: any) => pl.id === id);
                    return (
                      <div key={id} className={`px-3 py-1 rounded-lg border border-slate-600 flex items-center gap-2 ${p?.isConnected ? 'bg-slate-700/50' : 'bg-red-500/20 border-red-500/50'}`}>
                        {p?.name || 'Unknown'}
                        {!p?.isConnected && <WifiOff size={12} className="text-red-400" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              {isMePlaying && (
                <Button fullWidth variant="primary" onClick={session.finishTurn} className="relative z-0">
                  <CheckCircle size={20} className="mr-2 inline" /> Finish Turn
                </Button>
              )}
              {!isMePlaying && (
                <div className="text-center text-xs text-slate-500 italic">
                  Wait for players to finish...
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
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-2 opacity-50 py-8">
              <ListOrdered size={48} />
              <p>Queue is empty</p>
            </div>
          ) : (
            queue.map((item: QueueEntry, index: number) => {
              const playersInEntry = item.playerIds.map(id => players.find((p: any) => p.id === id)).filter(Boolean);
              const isMeIn = item.playerIds.includes(myId);

              return (
                <div
                  key={item.id}
                  className={`relative flex flex-col p-3 rounded-xl border-l-4 shadow-sm animate-in slide-in-from-bottom-2 duration-300 ${getEntryColor(item.type)} ${isMeIn ? 'bg-slate-800' : 'bg-slate-800/50'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs shadow-inner">
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                        {getEntryIcon(item.type)}
                        {item.type}
                      </div>
                    </div>
                    {(isHost || isMeIn) && (
                      <button onClick={() => session.removeFromQueue(item.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
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
                </div>
              )
            })
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

      {/* Pass Host Modal */}
      <Modal
        isOpen={showPassHost}
        onClose={() => setShowPassHost(false)}
        title="Pass Host Role"
        footer={<Button variant="ghost" onClick={() => setShowPassHost(false)}>Cancel</Button>}
      >
        <div className="space-y-3">
          <p className="text-slate-400 text-sm">Select a player to transfer host duties to. You will be disconnected and rejoined as a participant.</p>
          <div className="max-h-60 overflow-y-auto space-y-2 no-scrollbar">
            {players.filter((p: Player) => p.id !== myId && p.isConnected).map((p: Player) => (
              <button
                key={p.id}
                onClick={() => { session.passHost(p.id); setShowPassHost(false); }}
                className="w-full p-3 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center justify-between text-white font-bold"
              >
                {p.name}
                <Crown size={16} className="text-slate-500" />
              </button>
            ))}
            {players.filter((p: Player) => p.id !== myId && p.isConnected).length === 0 && (
              <div className="text-center text-slate-500">No available players</div>
            )}
          </div>
        </div>
      </Modal>

      <div className="p-4 bg-slate-800 border-t border-slate-700 sticky bottom-0 z-10">
        <Button fullWidth onClick={() => setShowJoinOptions(true)} className="flex items-center justify-center gap-2">
          <Play size={20} className="fill-current" /> Join Queue
        </Button>
      </div>
    </div>
  );
};

const ChatView = ({
  gameState,
  myId,
  onSend,
  onVote
}: {
  gameState: any,
  myId: string,
  onSend: (msg: string) => void,
  onVote: (approve: boolean) => void
}) => {
  const [input, setInput] = useState('');
  const endRef = React.useRef<HTMLDivElement>(null);
  const { activeVote, players } = gameState;

  React.useEffect(() => {
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
          const isMe = msg.senderId === myId;
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

export default function App() {
  const session = usePeerSession();
  const [tab, setTab] = useState<'queue' | 'chat'>('queue');
  const [confirmLeave, setConfirmLeave] = useState(false);

  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  if (session.status === ConnectionStatus.IDLE || session.status === ConnectionStatus.ERROR) {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex items-center justify-center">
        <div className="w-full max-w-md h-[100dvh] bg-slate-900 relative">
          <LandingView
            onHost={(name) => session.hostSession(name)}
            onJoin={session.joinSession}
            isConnecting={false}
            error={session.error}
          />
        </div>
      </div>
    );
  }

  if (session.status === ConnectionStatus.CONNECTING || session.status === ConnectionStatus.MIGRATING) {
    return (
      <div className="min-h-[100dvh] bg-slate-900 flex flex-col items-center justify-center text-cyan-400 gap-4">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="animate-pulse font-medium">{session.status === ConnectionStatus.MIGRATING ? 'Migrating Host...' : 'Connecting...'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-slate-900 flex justify-center">
      <div className="w-full max-w-md bg-slate-900 flex flex-col h-[100dvh] shadow-2xl relative">
        <div className="flex-1 overflow-hidden relative">
          {tab === 'queue' && (
            <QueueView
              gameState={session.gameState}
              myId={session.myId}
              session={session}
              isHost={session.isHost}
            />
          )}
          {tab === 'chat' && (
            <ChatView
              gameState={session.gameState}
              myId={session.myId}
              onSend={session.sendMessage}
              onVote={session.castVote}
            />
          )}
        </div>

        <div className="bg-slate-800 border-t border-slate-700 safe-area-bottom">
          <div className="flex justify-around items-center h-16">
            <button
              onClick={() => setTab('queue')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${tab === 'queue' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <ListOrdered size={24} />
              <span className="text-[10px] font-bold uppercase">Queue</span>
            </button>
            <button
              onClick={() => setTab('chat')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 relative ${tab === 'chat' ? 'text-pink-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <MessageSquare size={24} />
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

      <Modal
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave Session?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => { setConfirmLeave(false); session.disconnect(); }}>Leave</Button>
          </>
        }
      >
        <p className="text-slate-300">Are you sure you want to leave? You can rejoin later from the history.</p>
      </Modal>
    </div>
  );
}