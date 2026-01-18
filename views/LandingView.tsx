import React, { useState, useEffect } from "react";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { Clock, Trash2, CloudLightning, Crown } from "lucide-react";
import logo from "../assets/logo.png";
import {
  getIdentity,
  getRecentSessions,
  removeRecentSession,
  RecentSession,
  loadHostState,
} from "../utils/storage";

interface LandingViewProps {
  onCreateSession: (name: string, recoverCode?: string) => void;
  onJoin: (code: string, name: string) => void;
  onRecoverSession: (code: string, name: string) => void;
  isConnecting: boolean;
  error: string | null;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onCreateSession,
  onJoin,
  onRecoverSession,
  isConnecting,
  error,
}) => {
  const [name, setName] = useState("");
  const [sessionCode, setSessionCode] = useState("");
  const [mode, setMode] = useState<"menu" | "join">("menu");
  const [history, setHistory] = useState<RecentSession[]>([]);

  useEffect(() => {
    const id = getIdentity();
    if (id.name) setName(id.name);
    setHistory(getRecentSessions());
  }, []);

  const handleDeleteSession = (code: string) => {
    removeRecentSession(code);
    setHistory(getRecentSessions());
  };

  const lastSession = history[0];

  if (mode === "join") {
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
            {isConnecting ? "Connecting..." : "Join Session"}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setMode("menu")}
            disabled={isConnecting}
          >
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
          <div className="w-24 h-24 bg-gradient-to-br from-cyan-400/20 to-pink-500/20 rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/10 border border-white/10 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10" />
            <img
              src={logo}
              alt="Logo"
              className="w-20 h-20 object-contain relative z-20 group-hover:scale-110 transition-transform duration-500"
            />
          </div>
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight">
          Mai<span className="text-cyan-400">Mai</span>Mai
        </h1>
        <p className="text-slate-400 text-lg">A mamai queueing service</p>
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

        {lastSession && (
          <Button
            fullWidth
            className="bg-orange-500 text-white hover:bg-orange-400 shadow-lg shadow-orange-500/20 mb-2"
            onClick={() => {
              if (loadHostState(lastSession.code)) {
                onRecoverSession(lastSession.code, name);
              } else {
                onJoin(lastSession.code, name);
              }
            }}
            disabled={!name.trim() || isConnecting}
          >
            <div className="flex items-center justify-center gap-2">
              <CloudLightning size={20} />
              {loadHostState(lastSession.code)
                ? `Resume Session ${lastSession.code}`
                : `Rejoin Session ${lastSession.code}`}
            </div>
          </Button>
        )}

        <Button
          fullWidth
          variant="primary"
          onClick={() => onCreateSession(name)}
          disabled={!name.trim() || isConnecting}
        >
          {isConnecting ? "Creating..." : "Host New Session"}
        </Button>
        <Button fullWidth variant="secondary" onClick={() => setMode("join")}>
          Join Existing Session
        </Button>
      </div>

      {history.length > 0 && (
        <div className="w-full">
          <h3 className="text-sm font-bold text-slate-500 uppercase mb-2 flex items-center gap-2">
            <Clock size={14} /> Recent
          </h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex gap-2">
                <button
                  onClick={() => {
                    if (loadHostState(h.code)) {
                      onRecoverSession(h.code, name);
                    } else {
                      onJoin(h.code, name);
                    }
                  }}
                  disabled={!name.trim()}
                  className="flex-1 bg-slate-800/50 hover:bg-slate-800 p-3 rounded-xl flex justify-between items-center text-left border border-slate-700 transition-colors group"
                >
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-cyan-400 group-hover:text-cyan-300">
                      {h.code}
                    </span>
                    {loadHostState(h.code) && (
                      <div className="flex items-center gap-1">
                        <Crown size={10} className="text-orange-400" />
                        <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider">
                          Host
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {new Date(h.lastJoined).toLocaleDateString()}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(h.code);
                  }}
                  className="p-3 bg-slate-800/50 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/50 rounded-xl text-slate-500 hover:text-red-400 transition-colors"
                  title="Remove from history"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
