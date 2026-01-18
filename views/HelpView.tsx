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
  Code,
  User,
  Crown,
} from "lucide-react";

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
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                Welcome to MaiMaiMai!
              </h3>
              <p className="text-slate-300 leading-relaxed">
                MaiMaiMai is a queueing service designed for the arcade rhythm
                game "maimai". It helps organize player turns, manage queues
                fairly, and enable communication between players.
              </p>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h4 className="font-bold text-cyan-400 mb-2">How it works</h4>
              <ul className="space-y-2 text-slate-300 list-disc list-inside">
                <li>
                  One person creates a <strong>Session</strong> and becomes the
                  Host/Mod.
                </li>
                <li>
                  Others join using the <strong>Session Code</strong>.
                </li>
                <li>
                  Players join the <strong>Queue</strong> when they are ready to
                  play.
                </li>
                <li>
                  The system tracks who is currently playing and who is up next.
                </li>
              </ul>
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h4 className="font-bold text-cyan-400 mb-2">Queue Modes</h4>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Users size={16} />
                  </div>
                  <div>
                    <strong className="text-white">Duo Match</strong>
                    <p className="text-slate-400 text-sm">
                      Join the queue alone and get matched with the next
                      available player.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400">
                    <Heart size={16} />
                  </div>
                  <div>
                    <strong className="text-white">With Partner</strong>
                    <p className="text-slate-400 text-sm">
                      Join the queue together with a specific friend (both must
                      be online).
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center text-orange-400">
                    <User size={16} />
                  </div>
                  <div>
                    <strong className="text-white">Solo Play</strong>
                    <p className="text-slate-400 text-sm">
                      Request to play alone. if there are more than 4 players,
                      this will require adequate votes (&gt;50%) from other
                      players to be approved. or the mod can approve it
                      directly.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        );

      case "queue":
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                The Queue System
              </h3>
              <p className="text-slate-300">
                The core of MaiMaiMai is the dynamic queue. It ensures everyone
                gets a fair turn.
              </p>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                <Music size={16} className="text-pink-400" /> Currently Playing
              </h4>
              <p className="text-slate-400 text-sm">
                See exactly who is playing right now.
              </p>
            </div>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                <ListOrdered size={16} className="text-cyan-400" /> Up Next
              </h4>
              <p className="text-slate-400 text-sm">
                Shows the ordered list of players waiting for their turn. You
                can verify your position here.
              </p>
            </div>

            <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
              <h4 className="font-bold text-yellow-500 mb-2">
                Moderator Powers
              </h4>
              <p className="text-slate-300 text-sm">The session Mod can:</p>
              <ul className="list-disc list-inside text-slate-400 text-sm mt-2 space-y-1">
                <li>Reorder the queue by dragging items.</li>
                <li>Remove players or entire groups from the queue.</li>
                <li>Force finish a turn if players forget to end it.</li>
                <li>
                  Add and Queue <strong>Custom Players</strong> who don't have a
                  device.
                </li>
              </ul>
            </div>
          </div>
        );

      case "players":
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Player List</h3>
              <p className="text-slate-300">
                See who is currently connected to the session.
              </p>
            </div>

            <ul className="space-y-4">
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 flex-shrink-0">
                  <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                </div>
                <div>
                  <h4 className="font-bold text-white">Online Status</h4>
                  <p className="text-slate-400 text-sm">
                    A glowing green dot indicates the player is online and
                    connected. Offline players are greyed out but remain in the
                    list for history.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-500 flex-shrink-0">
                  <span className="font-bold text-xs">OFF</span>
                </div>
                <div>
                  <h4 className="font-bold text-white">Custom Players</h4>
                  <p className="text-slate-400 text-sm">
                    Mods can create "Custom Players" for people without
                    devices/internet connection. They appear with a purple label
                    and their specific queue actions are managed by the Mod.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 flex-shrink-0">
                  <Crown size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-white">Moderator</h4>
                  <p className="text-slate-400 text-sm">
                    The player with the Crown icon is the Mod. They manage the
                    session state. The mod can transfer their role to another
                    player if they want to.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        );

      case "chat":
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">
                Chat & Communication
              </h3>
              <p className="text-slate-300">
                Stay in touch with other players. With this instead of waiting
                in the cab they can go out and do other stuff and still see the
                queue, they can track whenever they need to go back to the cab
                if it's almost their turn.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-cyan-400 mb-1">Mentions</h4>
                <p className="text-slate-400 text-sm">
                  Type <code>@name</code> to mention a player. They will receive
                  a notification.
                </p>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-pink-400 mb-1">Replies</h4>
                <p className="text-slate-400 text-sm">
                  Tap a message to see the reply and react buttons. Threaded
                  conversations are easier to follow.
                </p>
              </div>

              <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                <h4 className="font-bold text-orange-400 mb-1">Reactions</h4>
                <p className="text-slate-400 text-sm">
                  React to messages with emojis like ❤️, 😂, 💀, etc. to express
                  yourself.
                </p>
              </div>
            </div>
          </div>
        );

      case "about":
        return (
          <div className="space-y-6 animate-in fade-in duration-300 text-center pt-4">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl shadow-cyan-500/20">
                <span className="text-3xl font-black">M</span>
              </div>
              <h2 className="text-2xl font-black text-white mb-1">MaiMaiMai</h2>
              <p className="text-slate-400 text-sm">maimai queueing service</p>
            </div>

            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 max-w-sm mx-auto">
              <h3 className="text-sm uppercase tracking-widest font-bold text-slate-500 mb-4">
                Credits
              </h3>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Creator</div>
                  <div className="text-lg font-bold text-cyan-400">x01Jin</div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1">
                    Contributors
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <span className="px-2 py-1 bg-slate-700 rounded-md text-white text-sm">
                      zzzeus
                    </span>
                    <span className="px-2 py-1 bg-slate-700 rounded-md text-white text-sm">
                      lonelymoon_01
                    </span>
                    <span className="px-2 py-1 bg-slate-700 rounded-md text-white text-sm">
                      Bro-k
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <a
                href="https://github.com/x01Jin/maimaimai"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors border border-slate-700"
              >
                <Github size={20} />
                <span>View on GitHub</span>
              </a>
            </div>

            <div className="text-xs text-slate-600 mt-8">
              v0.1.0 • Built with React & Vite
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex bg-slate-900 h-full relative overflow-hidden">
      {/* Sidebar Toggle - Visible when sidebar is closed */}
      {!isSidebarOpen && (
        <div className="absolute top-4 right-4 z-50">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full shadow-lg border border-slate-700 backdrop-blur-sm transition-all active:scale-95"
          >
            <Menu size={20} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`flex-1 overflow-y-auto no-scrollbar p-6 pb-24 transition-all duration-300 ${isSidebarOpen ? "blur-sm" : ""}`}
      >
        {renderContent()}
      </div>

      {/* Content Overlay & Blur Trigger */}
      {isSidebarOpen && (
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] z-30 transition-all duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Right Sidebar Navigation */}
      <div
        className={`
        absolute inset-y-0 right-0 z-40 bg-slate-800 border-l border-slate-700 shadow-2xl transition-all duration-300 ease-in-out
        ${isSidebarOpen ? "w-64 translate-x-0" : "w-0 translate-x-full overflow-hidden"}
      `}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Help & Info
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-medium transition-all ${
                  activeSection === section.id
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : "text-slate-400 hover:bg-slate-700/50 hover:text-slate-200"
                }`}
              >
                {section.icon}
                <span className="text-sm">{section.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
};
