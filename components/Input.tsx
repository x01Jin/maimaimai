import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  className = "",
  ...props
}) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      {label && (
        <label className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 ml-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-white/60 dark:bg-slate-900/60 border-2 border-white/80 dark:border-slate-800 focus:border-dreamy-purple dark:focus:border-midnight-purple focus:shadow-[0_0_20px_rgba(159,134,255,0.2)] dark:focus:shadow-[0_0_20px_rgba(167,139,250,0.15)] rounded-2xl px-4 py-3 text-dreamy-dark dark:text-midnight-text outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 backdrop-blur-md ${className}`}
        {...props}
      />
    </div>
  );
};
