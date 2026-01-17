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
        <label className="text-sm font-medium text-slate-400 ml-1">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-slate-800 border-2 border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-3 text-white outline-none transition-colors placeholder:text-slate-600 ${className}`}
        {...props}
      />
    </div>
  );
};
