import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface ButtonProps extends Omit<
  HTMLMotionProps<"button">,
  "variant" | "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"
> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "success" | "accent";
  fullWidth?: boolean;
  size?: "default" | "square" | "lg";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  fullWidth = false,
  size = "default",
  className = "",
  ...props
}) => {
  const baseStyles =
    "rounded-2xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center select-none";

  const sizeStyles = {
    default: "py-2.5 px-5 text-sm",
    lg: "py-3 px-6 text-base",
    square: "p-2.5",
  };

  const variants = {
    primary:
      "bg-dreamy-blue text-slate-700 dark:bg-midnight-blue dark:text-slate-900 shadow-md shadow-dreamy-blue/20",
    secondary:
      "bg-dreamy-pink text-slate-700 dark:bg-midnight-pink dark:text-slate-900 shadow-md shadow-dreamy-pink/20",
    accent:
      "bg-dreamy-purple text-white dark:bg-midnight-purple dark:text-slate-900 shadow-md shadow-dreamy-purple/20",
    danger: "bg-red-400 text-white dark:bg-red-500",
    ghost:
      "bg-white/40 text-slate-600 dark:bg-slate-800/40 dark:text-slate-200 backdrop-blur-sm",
    success:
      "bg-dreamy-green text-slate-700 dark:bg-midnight-green dark:text-slate-900 shadow-md shadow-dreamy-green/20",
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};
