import React, { useState } from "react";
import {
  HelpCircle,
  ListOrdered,
  Users,
  MessageSquare,
  Info,
  Music,
  Github,
  Menu,
  X,
  Heart,
  User,
  Crown,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HelpViewProps {
  onClose?: () => void;
}

type HelpSection = "general" | "queue" | "players" | "chat" | "about";

export const HelpView: React.FC<HelpViewProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState<HelpSection>("general");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const sections: { id: HelpSection; label: string; icon: React.ReactNode }[] =
    [
      { id: "general", label: "General Help", icon: <HelpCircle size={18} /> },
      { id: "queue", label: "Queue System", icon: <ListOrdered size={18} /> },
      { id: "players", label: "Players", icon: <Users size={18} /> },
      { id: "chat", label: "Chat Features", icon: <MessageSquare size={18} /> },
      { id: "about", label: "About", icon: <Info size={18} /> },
    ];

  const renderContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-4 animate-in fade-in duration-300 select-none">
            <div>
              <h3 className="text-xl font-black text-dreamy-dark mb-2 tracking-tight">
                Welcome to MaiMaiMai!
              </h3>
              <p className="text-slate-600 text-sm font-bold leading-relaxed">
                A whimsical arcade companion for rhythm gamers. Fair queues.
                Live updates. Zero stress.
              </p>
            </div>

            <div className="glass-card p-5 rounded-3xl border-2 border-white shadow-lg space-y-3">
              <h4 className="font-black text-dreamy-purple uppercase tracking-widest text-[10px]">
                The Loop
              </h4>
              <ul className="space-y-2">
                {[
                  "One person hosts a session.",
                  "Friends join via shorthand code.",
                  "Queue up when you're ready to play.",
                  "Track live turn updates!",
                ].map((text, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2.5 text-dreamy-dark font-black text-xs"
                  >
                    <div className="w-4 h-4 rounded-full bg-dreamy-purple/20 flex items-center justify-center text-[8px] text-dreamy-purple font-black shrink-0">
                      {i + 1}
                    </div>
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-black text-dreamy-slate uppercase tracking-widest text-[10px] ml-2">
                Queue Modes
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <div className="glass-card p-3 rounded-2xl border-2 border-white flex gap-3 items-center">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-dreamy-blue/20 flex items-center justify-center text-dreamy-blue border-2 border-white">
                    <Users size={18} />
                  </div>
                  <div>
                    <strong className="text-dreamy-dark text-sm font-black">
                      Duo Match
                    </strong>
                    <p className="text-dreamy-slate text-[10px] font-bold leading-none mt-0.5">
                      Join alone, get matched!
                    </p>
                  </div>
                </div>
                <div className="glass-card p-3 rounded-2xl border-2 border-white flex gap-3 items-center">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-dreamy-pink/20 flex items-center justify-center text-dreamy-pink border-2 border-white">
                    <Heart size={18} />
                  </div>
                  <div>
                    <strong className="text-dreamy-dark text-sm font-black">
                      Partner
                    </strong>
                    <p className="text-dreamy-slate text-[10px] font-bold leading-none mt-0.5">
                      Link up with your bestie.
                    </p>
                  </div>
                </div>
                <div className="glass-card p-3 rounded-2xl border-2 border-white flex gap-3 items-center">
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-dreamy-yellow/20 flex items-center justify-center text-dreamy-yellow border-2 border-white">
                    <User size={18} />
                  </div>
                  <div>
                    <strong className="text-dreamy-dark text-sm font-black">
                      Solo Play
                    </strong>
                    <p className="text-dreamy-slate text-[10px] font-bold leading-none mt-0.5">
                      The stage all to yourself.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "queue":
        return (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div>
              <h3 className="text-2xl font-black text-dreamy-dark mb-3 tracking-tight">
                The Queue System
              </h3>
              <p className="text-slate-600 font-bold leading-relaxed">
                Our dynamic queue ensures everyone gets a fair go. No more
                guessing when it's your turn!
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="glass-card p-4 rounded-3xl border-2 border-white shadow-md">
                <h4 className="font-black text-dreamy-dark mb-1.5 flex items-center gap-2 text-sm">
                  <Music size={16} className="text-dreamy-pink" /> On Stage
                </h4>
                <p className="text-slate-600 text-[11px] font-bold leading-relaxed">
                  Who's playing right now! See if they are almost finished or if
                  they've stepped away.
                </p>
              </div>

              <div className="glass-card p-4 rounded-3xl border-2 border-white shadow-md">
                <h4 className="font-black text-dreamy-dark mb-1.5 flex items-center gap-2 text-sm">
                  <ListOrdered size={16} className="text-dreamy-blue" /> Next Up
                </h4>
                <p className="text-slate-600 text-[11px] font-bold leading-relaxed">
                  The ordered list of players. Watch your rank climb as groups
                  move onto the stage!
                </p>
              </div>
            </div>

            <div className="bg-amber-50 p-5 rounded-3xl border-2 border-amber-200 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-3 opacity-10 rotate-12">
                <Crown size={48} className="text-amber-500" />
              </div>
              <h4 className="font-black text-amber-600 uppercase tracking-widest text-[9px] mb-2.5">
                Mod Powers
              </h4>
              <ul className="space-y-1.5">
                {[
                  "Reorder any group",
                  "Remove missing players",
                  "Add custom player/guest",
                  "Force finish lingering turns",
                ].map((text, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-1.5 text-slate-700 font-black text-[10px] uppercase tracking-tight"
                  >
                    <div className="w-1 h-1 rounded-full bg-amber-500" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );

      case "players":
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="text-2xl font-black text-dreamy-dark mb-3 tracking-tight">
                Player List
              </h3>
              <p className="text-dreamy-slate font-bold leading-relaxed">
                Connect and keep tabs on fellow rhythm enthusiasts.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Online Status",
                  desc: "A glowing green bubble means they are live and ready!",
                  icon: (
                    <div className="w-3 h-3 bg-dreamy-green rounded-full shadow-[0_0_10px_rgba(178,242,187,0.8)]" />
                  ),
                  color: "bg-dreamy-green/10",
                },
                {
                  title: "Custom Players",
                  desc: "Players managed by the host. Ideal for local arcade friends.",
                  icon: <User size={20} className="text-dreamy-purple" />,
                  color: "bg-dreamy-purple/10",
                },
                {
                  title: "Moderator",
                  desc: "The session leader who keeps the peace and handles the flow.",
                  icon: <Crown size={20} className="text-dreamy-yellow" />,
                  color: "bg-dreamy-yellow/10",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 p-3 glass-card rounded-2xl border-2 border-white"
                >
                  <div
                    className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0 border-2 border-white`}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-black text-dreamy-dark text-sm">
                      {item.title}
                    </h4>
                    <p className="text-dreamy-slate text-[10px] font-bold leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "chat":
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="text-2xl font-black text-dreamy-dark mb-3 tracking-tight">
                Socializing
              </h3>
              <p className="text-dreamy-slate font-bold leading-relaxed">
                Coordinate with teammates or just share your glory!
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {[
                {
                  label: "Mentions",
                  color: "text-dreamy-blue",
                  bg: "bg-dreamy-blue/5",
                  code: "@name",
                },
                {
                  label: "Replies",
                  color: "text-dreamy-pink",
                  bg: "bg-dreamy-pink/5",
                  code: "Tap message",
                },
                {
                  label: "Reactions",
                  color: "text-dreamy-yellow",
                  bg: "bg-dreamy-yellow/5",
                  code: "❤️ 🔥 😂",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-2xl glass-card border-2 border-white space-y-1.5`}
                >
                  <h4 className={`font-black text-sm ${item.color}`}>
                    {item.label}
                  </h4>
                  <p className="text-dreamy-slate text-[10px] font-bold bg-white/40 p-1.5 rounded-lg inline-block border border-white">
                    {item.label === "Mentions"
                      ? "Use "
                      : item.label === "Replies"
                        ? "Action: "
                        : "Supports: "}
                    <code className="bg-white/80 px-1.5 rounded font-black text-dreamy-dark">
                      {item.code}
                    </code>
                  </p>
                </div>
              ))}
            </div>
          </div>
        );

      case "about":
        return (
          <div className="space-y-8 animate-in fade-in duration-300 text-center pt-8">
            <div className="flex flex-col items-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 glass-card border-4 border-white rounded-3xl flex items-center justify-center relative shadow-xl"
              >
                <div className="absolute inset-2 bg-gradient-to-br from-dreamy-blue to-dreamy-pink rounded-2xl opacity-20" />
                <span className="text-3xl font-black text-dreamy-dark relative">
                  M
                </span>
              </motion.div>
              <h2 className="text-2xl font-black text-dreamy-dark mt-4 mb-1 tracking-tight">
                MaiMaiMai
              </h2>
              <p className="text-dreamy-slate font-black uppercase tracking-widest text-[9px] opacity-40">
                Companion
              </p>
            </div>

            <div className="glass-card rounded-3xl p-6 border-2 border-white max-w-sm mx-auto shadow-lg">
              <h3 className="text-[9px] uppercase tracking-[0.2em] font-black text-dreamy-slate mb-4 pb-2 border-b border-white/50">
                Hall of Fame
              </h3>

              <div className="space-y-5">
                <div>
                  <div className="text-[8px] font-black uppercase text-dreamy-slate mb-0.5">
                    Created By
                  </div>
                  <div className="text-lg font-black text-dreamy-purple">
                    x01Jin
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-[8px] font-black uppercase text-dreamy-slate mb-0.5">
                    Contributors
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5 px-2">
                    {["zzzeus", "lonelymoon_01", "Bro-k"].map((name) => (
                      <span
                        key={name}
                        className="px-2.5 py-1 glass-card bg-white rounded-xl text-dreamy-dark font-black text-[10px] border border-white italic"
                      >
                        @{name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="https://github.com/x01Jin/maimaimai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3 glass-card bg-white/50 hover:bg-white text-dreamy-dark font-black rounded-2xl transition-all border-2 border-white shadow-md active:scale-95 group"
              >
                <Github
                  size={18}
                  className="group-hover:rotate-12 transition-transform"
                />
                <span className="text-sm">GitHub Repo</span>
              </a>
            </div>

            <div className="text-[10px] font-black text-slate-300 tracking-widest uppercase">
              v0.1.0 • Magic & Pixels
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex bg-transparent h-full relative overflow-hidden font-sans">
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="absolute inset-0 bg-white/20 backdrop-blur-md z-30"
          />
        )}
      </AnimatePresence>

      <div
        className={`flex-1 overflow-y-auto no-scrollbar p-6 pb-24 transition-all duration-500 ${isSidebarOpen ? "scale-[0.98] blur-sm opacity-50" : ""}`}
      >
        {renderContent()}
      </div>

      <div className="fixed top-6 right-6 z-50">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="w-12 h-12 glass-card bg-white flex items-center justify-center rounded-2xl shadow-xl border-2 border-white text-dreamy-dark hover:text-dreamy-purple transition-all active:scale-90"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <motion.div
        initial={false}
        animate={{
          x: isSidebarOpen ? 0 : "100%",
          opacity: isSidebarOpen ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute inset-y-0 right-0 z-40 w-72 h-full glass-card p-6 border-l-2 border-white shadow-2xl flex flex-col"
      >
        <div className="flex flex-col h-full pt-4">
          <div className="mb-8 px-2">
            <h2 className="text-[10px] font-black text-dreamy-slate uppercase tracking-[0.3em]">
              Library
            </h2>
            <p className="text-dreamy-dark font-black text-xl tracking-tight">
              Need help?
            </p>
          </div>

          <nav className="space-y-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl font-black transition-all group ${
                  activeSection === section.id
                    ? "bg-dreamy-blue text-white border-2 border-white shadow-md shadow-dreamy-blue/20"
                    : "text-dreamy-slate hover:bg-white border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {section.icon}
                  <span className="text-xs uppercase tracking-tight">
                    {section.label}
                  </span>
                </div>
                <ChevronRight
                  size={14}
                  className={`transition-transform ${activeSection === section.id ? "rotate-90" : "group-hover:translate-x-1"}`}
                />
              </button>
            ))}
          </nav>

          <div className="mt-auto p-4 glass-card rounded-3xl border-2 border-white text-center">
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">
              Current Session
            </div>
            <div className="text-dreamy-purple font-black text-xl tracking-widest font-mono">
              LIVE
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
