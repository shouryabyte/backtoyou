import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { Badge } from "../components/Badge";

type Item = { id: string; type: "LOST" | "FOUND"; title: string; status: string };

export default function MatchesPageNew() {
  const nav = useNavigate();
  const [itemId, setItemId] = useState<string>("");

  const itemsQ = useQuery({
    queryKey: ["items", "mine"],
    queryFn: () => api<{ items: Item[] }>("/api/items?mine=1")
  });

  const lostItems = useMemo(
    () => (itemsQ.data?.items ?? []).filter((i) => i.type === "LOST" && i.status === "ACTIVE"),
    [itemsQ.data]
  );

  const matchesQ = useQuery({
    queryKey: ["matches", itemId],
    enabled: Boolean(itemId),
    queryFn: () => api<any>(`/api/matches?itemId=${encodeURIComponent(itemId)}`)
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">Matches</h1>
        <p className="mt-2 text-zinc-400">Candidates only. Verification + admin approval decide the return.</p>
      </div>

      <Card>
        <div className="text-sm font-bold text-zinc-100 mb-3">Select your lost item</div>
        <select
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 shadow-sm focus:outline-none focus:ring-4 focus:ring-pink-500/15 focus:border-pink-400/40"
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        >
          <option value="">-- Select --</option>
          {lostItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
      </Card>

      {itemId ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-zinc-100">Candidate matches</div>
              <div className="text-sm text-zinc-400">Confidence is shown. Detailed scoring is visible to admins only.</div>
            </div>
            <SecondaryButton
              onClick={async () => {
                await api(`/api/items/${itemId}/match`, { method: "POST" });
                await matchesQ.refetch();
              }}
            >
              Re-run matching
            </SecondaryButton>
          </div>

          {matchesQ.isLoading ? <div className="mt-4 text-zinc-400">Loading...</div> : null}

          {matchesQ.data?.matches?.length ? (
            <div className="mt-5 grid gap-4">
              {matchesQ.data.matches.map((m: any) => (
                <div key={m.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-400">Found item</div>
                      <div className="text-xl font-bold text-zinc-100">{m.foundItem?.title}</div>
                      <div className="text-sm text-zinc-400 mt-1">{[m.foundItem?.category, m.foundItem?.location].filter(Boolean).join(" • ")}</div>
                      <div className="text-sm text-zinc-400 mt-2">{m.shortExplanation ?? "Suggested as a candidate match."}</div>
                    </div>
                    <Badge tone={m.confidence === "High" ? "success" : m.confidence === "Medium" ? "warning" : "danger"}>
                      {m.confidence ?? "Low"} confidence
                    </Badge>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link to={`/matches/${m.id}`} className="text-pink-300 hover:text-pink-200 font-semibold text-sm">
                      View details {"->"}
                    </Link>
                    <PrimaryButton onClick={() => nav(`/verify/${m.id}`)}>Claim this item</PrimaryButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-zinc-400">No matches yet. Try re-running matching after more items are reported.</div>
          )}
        </Card>
      ) : null}

      <div className="text-xs text-zinc-500">Tip: stronger reports (category/color/location/time) improve matching quality.</div>
    </div>
  );
}
