import React, { forwardRef } from "react";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "ref"> & { label: string; error?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea({ label, error, className, ...props }, ref) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-zinc-200 mb-2">{label}</div>
      <textarea
        {...props}
        ref={ref}
        className={[
          "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 shadow-sm",
          "placeholder:text-zinc-500 focus:outline-none focus:ring-4 focus:ring-pink-500/15 focus:border-pink-400/40",
          error ? "border-red-500/40 focus:ring-red-500/20" : "",
          className ?? ""
        ].join(" ")}
      />
      {error ? <div className="mt-2 text-sm text-red-400">{error}</div> : null}
    </label>
  );
});
