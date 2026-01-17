import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  ...props
}) => {
  const baseStyles =
    "py-3 px-6 rounded-xl font-bold transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary:
      "bg-cyan-400 text-slate-900 hover:bg-cyan-300 shadow-lg shadow-cyan-400/20",
    secondary:
      "bg-pink-500 text-white hover:bg-pink-400 shadow-lg shadow-pink-500/20",
    danger: "bg-red-500 text-white hover:bg-red-400",
    ghost: "bg-slate-800 text-slate-300 hover:bg-slate-700",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
