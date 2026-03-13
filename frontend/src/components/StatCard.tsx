import { Card } from "./Card";

export function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Card className="rounded-3xl shadow-xl">
      <div className="text-sm font-semibold text-zinc-400">{title}</div>
      <div className="mt-2 text-3xl font-bold text-zinc-100">{value}</div>
    </Card>
  );
}
