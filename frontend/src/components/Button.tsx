import React from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ children, variant, className, ...rest }: Props) {

  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition " +
    "focus:outline-none focus-visible:ring-4 focus-visible:ring-white/10 focus-visible:ring-offset-0 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const styles =
    variant === "secondary"
      ? "bg-white/5 text-zinc-100 border border-white/10 hover:bg-white/10"
      : variant === "danger"
      ? "bg-red-600 text-white hover:bg-red-500"
      : variant === "ghost"
      ? "bg-transparent text-zinc-100 hover:bg-white/10"
      : "text-white bg-gradient-to-r from-fuchsia-500 via-pink-500 to-indigo-500 hover:from-fuchsia-400 hover:via-pink-400 hover:to-indigo-400 shadow-xl shadow-pink-500/20";

  return (
    <button
      {...rest}
      className={[
        base,
        styles,
        "active:scale-[0.99]",
        className ?? ""
      ].join(" ")}
    >
      {children}
    </button>
  );
}
