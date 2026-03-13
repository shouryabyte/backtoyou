import React from "react";

export function Badge({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const styles =
    tone === "success"
      ? "bg-emerald-500/10 text-emerald-200 border-emerald-500/20"
      : tone === "warning"
      ? "bg-amber-400/10 text-amber-200 border-amber-400/20"
      : tone === "danger"
      ? "bg-red-500/10 text-red-200 border-red-500/20"
      : "bg-white/5 text-zinc-200 border-white/10";

  return <span className={`inline-flex items-center px-2 py-0.5 text-xs border rounded-full ${styles}`}>{children}</span>;
}
