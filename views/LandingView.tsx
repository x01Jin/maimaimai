import React, { useState, useEffect } from "react";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import {
  Clock,
  Trash2,
  CloudLightning,
  Crown,
  ChevronLeft,
  Sun,
  Moon,
} from "lucide-react";
import logo from "../assets/logo.png";
import { motion, AnimatePresence } from "framer-motion";
import {
  getIdentity,
  getRecentSessions,
  removeRecentSession,
  RecentSession,
} from "../utils/storage";

interface LandingViewProps {
  onCreateSession: (name: string, recoverCode?: string) => void;
  onJoin: (code: string, name: string) => void;
  onRecoverSession: (code: string, name: string) => void;
  isConnecting: boolean;
  error: string | null;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onCreateSession,
  onJoin,
  onRecoverSession,
  isConnecting,
  error,
  theme,
  toggleTheme,
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

  const containerVariants = {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: -10 },
  };

  if (mode === "join") {
    return (
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex flex-col h-full p-6 justify-center gap-6"
      >
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-black text-dreamy-dark dark:text-midnight-text">
            Join Session
          </h1>
          <p className="text-dreamy-slate dark:text-midnight-slate font-bold uppercase text-[10px] tracking-widest leading-none">
            Enter the code from the host
          </p>
        </div>

        <div className="space-y-4">
          <Input
            label="Your IGN (In-Game Name)"
            placeholder="Enter Name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
          />
          <Input
            label="Session Code"
            placeholder="e.g. A1B2"
            value={sessionCode}
            onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-red-400/10 border-2 border-red-400/20 text-red-500 text-sm font-bold text-center"
          >
            {error}
          </motion.div>
        )}

        <div className="space-y-3">
          <Button
            fullWidth
            size="lg"
            variant="accent"
            onClick={() => onJoin(sessionCode, name)}
            disabled={!name.trim() || !sessionCode.trim() || isConnecting}
          >
            {isConnecting ? "Connecting..." : "Join Now!"}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setMode("menu")}
            disabled={isConnecting}
          >
            <ChevronLeft size={18} className="mr-1" /> Back to Menu
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex flex-col h-full p-6 justify-center gap-6 overflow-y-auto no-scrollbar relative"
    >
      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={toggleTheme}
          className="w-12 h-12 glass-card bg-white/50 dark:bg-slate-800/50 flex items-center justify-center rounded-2xl shadow-xl border-2 border-white dark:border-slate-800 text-dreamy-slate dark:text-midnight-slate transition-all active:scale-90"
          title={
            theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"
          }
        >
          {theme === "dark" ? (
            <Sun size={24} className="text-dreamy-yellow" />
          ) : (
            <Moon size={24} className="text-dreamy-blue" />
          )}
        </button>
      </div>

      <div className="text-center space-y-2.5 pt-2">
        <motion.div
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="flex justify-center mb-4"
        >
          <div className="w-24 h-24 glass-card rounded-4xl flex items-center justify-center shadow-xl border-2 border-white dark:border-slate-800 relative overflow-hidden bg-white/40 dark:bg-slate-900/40">
            <div className="absolute inset-0 bg-gradient-to-tr from-dreamy-pink/10 to-dreamy-blue/10 dark:from-midnight-pink/10 dark:to-midnight-blue/10" />
            <img
              src={logo}
              alt="Logo"
              className="w-16 h-16 object-contain relative z-10"
            />
          </div>
        </motion.div>
        <h1 className="text-3xl font-black text-dreamy-dark dark:text-midnight-text tracking-tight leading-none">
          Mai
          <span className="text-dreamy-blue dark:text-midnight-blue">Mai</span>
          Mai
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-[11px] font-black uppercase tracking-[0.15em] opacity-80">
          A maimai Queueing Service
        </p>
      </div>

      <div className="space-y-4 w-full">
        {error && (
          <div className="p-4 rounded-2xl bg-red-400/10 border-2 border-red-400/20 text-red-500 text-sm font-bold text-center">
            {error}
          </div>
        )}

        <div className="glass-card p-4 rounded-3xl border-2 border-white dark:border-slate-800 shadow-lg mb-2">
          <Input
            label="Set your IGN"
            placeholder="Whatev's name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={12}
          />
        </div>

        <div className="grid grid-cols-1 gap-3">
          {lastSession && (
            <Button
              fullWidth
              size="lg"
              className="bg-dreamy-yellow dark:bg-midnight-yellow text-dreamy-dark dark:text-slate-900 border-b-4 border-yellow-400 dark:border-yellow-600 shadow-md shadow-yellow-200 dark:shadow-none"
              onClick={() => {
                onRecoverSession(lastSession.code, name);
              }}
              disabled={!name.trim() || isConnecting}
            >
              <div className="flex items-center justify-center gap-2">
                <CloudLightning size={20} className="text-orange-400" />
                <span>Rejoin ({lastSession.code})</span>
              </div>
            </Button>
          )}

          <Button
            fullWidth
            size="lg"
            variant="primary"
            className="border-b-4 border-dreamy-blue/50"
            onClick={() => onCreateSession(name)}
            disabled={!name.trim() || isConnecting}
          >
            {isConnecting ? "Sparkling..." : "Host Session"}
          </Button>

          <Button
            fullWidth
            size="lg"
            variant="secondary"
            className="border-b-4 border-dreamy-pink/50"
            onClick={() => setMode("join")}
          >
            Join Someone
          </Button>
        </div>
      </div>

      {history.length > 0 && (
        <div className="w-full mt-2">
          <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 ml-2 flex items-center gap-2">
            <Clock size={14} /> History
          </h3>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {history.map((h, i) => (
                <motion.div
                  key={h.code}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-2"
                >
                  <button
                    onClick={() => {
                      onRecoverSession(h.code, name);
                    }}
                    disabled={!name.trim()}
                    className="flex-1 glass-card p-3 rounded-2xl flex justify-between items-center text-left border-2 border-white/80 dark:border-slate-800 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono font-black text-lg text-dreamy-purple dark:text-midnight-purple transition-colors">
                        {h.code}
                      </span>
                    </div>
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-800/50 px-2.5 py-0.5 rounded-full border border-white dark:border-slate-700">
                      {new Date(h.lastJoined).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSession(h.code);
                    }}
                    className="w-12 glass-card border-2 border-white dark:border-slate-800 rounded-2xl flex items-center justify-center text-dreamy-slate dark:text-midnight-slate transition-all active:scale-90"
                    title="Remove from history"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
};
