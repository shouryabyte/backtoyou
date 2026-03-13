import React from "react";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "bty-card p-6",
        className ?? ""
      ].join(" ")}
    >
      {children}
    </div>
  );
}
