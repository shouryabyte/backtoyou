export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
      <div
        className="h-2 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-indigo-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
