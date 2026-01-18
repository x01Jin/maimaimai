import React, { Component, type ReactNode } from "react";
import { LogOut } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("UI Crash caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 bg-white/30 backdrop-blur-xl rounded-4xl border-2 border-white shadow-2xl m-4">
          <div className="w-20 h-20 bg-red-100 text-red-500 rounded-3xl flex items-center justify-center animate-bounce shadow-inner">
            <LogOut size={40} className="rotate-90" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
              Interface Glitch
            </h2>
            <p className="text-slate-500 font-medium text-sm leading-relaxed">
              Something went wrong while rendering this tab. You can try
              reloading the interface.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-dreamy-blue text-white rounded-2xl font-black shadow-lg shadow-dreamy-blue/20 active:scale-95 transition-all text-sm uppercase tracking-widest"
          >
            Refresh App
          </button>
        </div>
      );
    }

    return children;
  }
}
