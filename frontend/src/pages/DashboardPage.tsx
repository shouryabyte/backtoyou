import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { StatCard } from "../components/StatCard";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { Link } from "react-router-dom";
import { Badge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";

type Item = { id: string; type: "LOST" | "FOUND"; status: string };

export default function DashboardPage() {
  const itemsQ = useQuery({
    queryKey: ["items", "mine"],
    queryFn: () => api<{ items: Item[] }>("/api/items?mine=1")
  });

  const matchesQ = useQuery({
    queryKey: ["matches", "mine"],
    queryFn: () => api<{ matches: any[] }>("/api/matches?mine=1")
  });

  const stats = useMemo(() => {
    const items = itemsQ.data?.items ?? [];
    const lost = items.filter((i) => i.type === "LOST").length;
    const found = items.filter((i) => i.type === "FOUND").length;
    const matches = matchesQ.data?.matches ?? [];
    const activeMatches = matches.length;
    return { lost, found, activeMatches };
  }, [itemsQ.data, matchesQ.data]);

  return (
    <div className="max-w-6xl mx-auto py-2 space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Dashboard</h1>
          <div className="text-zinc-400 mt-2">Track your items, matches, and claims—safely and transparently.</div>
        </div>
        <div className="flex gap-3">
          <Link to="/report">
            <PrimaryButton>Report an item</PrimaryButton>
          </Link>
          <Link to="/matches">
            <SecondaryButton>View matches</SecondaryButton>
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <StatCard title="Lost Items" value={stats.lost} />
        <StatCard title="Found Items" value={stats.found} />
        <StatCard title="Active Matches" value={stats.activeMatches} />
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-zinc-100">Recent matches</div>
          <Link to="/matches" className="text-sm font-semibold text-pink-300 hover:text-pink-200">
            Explore all →
          </Link>
        </div>

        {matchesQ.isLoading ? <div className="mt-4 text-zinc-400">Loading…</div> : null}
        {matchesQ.data?.matches?.length ? (
          <div className="mt-4 grid gap-4">
            {matchesQ.data.matches.slice(0, 5).map((m: any) => (
              <div key={m.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-zinc-100">{m.foundItem?.title}</div>
                    <div className="text-sm text-zinc-400 mt-1">
                      {m.lostItem?.title} ↔ {m.foundItem?.title}
                    </div>
                  </div>
                  <Badge tone={m.confidenceLevel === "HIGH_CONFIDENCE" ? "success" : "warning"}>{m.confidenceLevel}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Final score</div>
                  <div className="text-sm font-semibold text-zinc-100">{Math.round(Number(m.finalScore) * 100)}%</div>
                </div>
                <div className="mt-2">
                  <ProgressBar value={Number(m.finalScore)} />
                </div>
                <div className="mt-3">
                  <Link to={`/matches/${m.id}`} className="text-sm font-semibold text-pink-300 hover:text-pink-200">
                    View details →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 text-zinc-400">No matches yet. Report an item to generate candidates.</div>
        )}
      </Card>
    </div>
  );
}

