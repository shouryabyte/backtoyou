import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { PrimaryButton } from "../components/PrimaryButton";

export default function MatchDetailPage() {
  const nav = useNavigate();
  const { matchId } = useParams();

  const q = useQuery({
    queryKey: ["match", matchId],
    enabled: Boolean(matchId),
    queryFn: () => api<any>(`/api/matches/${matchId}`)
  });

  const m = q.data?.match;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Possible match</h1>
          <p className="mt-2 text-zinc-400">Matching suggests candidates only. Verification + admin approval decide the return.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/matches" className="text-sm font-semibold text-pink-300 hover:text-pink-200">
            ← Back to matches
          </Link>
        </div>
      </div>

      {q.isLoading ? <div className="text-zinc-400">Loading…</div> : null}
      {m ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <div className="text-sm font-bold text-zinc-100">Lost item</div>
              <div className="mt-2 text-xl font-bold text-zinc-100">{m.lostItem?.title}</div>
              <div className="text-zinc-400 mt-1">{m.lostItem?.category} • {m.lostItem?.color} • {m.lostItem?.location}</div>
              <div className="text-sm text-zinc-400 mt-3">{m.lostItem?.description}</div>
            </Card>
            <Card>
              <div className="text-sm font-bold text-zinc-100">Found item</div>
              <div className="mt-2 text-xl font-bold text-zinc-100">{m.foundItem?.title}</div>
              <div className="text-zinc-400 mt-1">{m.foundItem?.category} • {m.foundItem?.color} • {m.foundItem?.location}</div>
              <div className="text-sm text-zinc-400 mt-3">{m.foundItem?.description}</div>
            </Card>
          </div>

          <Card>
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold text-zinc-100">Score breakdown</div>
              <Badge tone={m.confidenceLevel === "HIGH_CONFIDENCE" ? "success" : "warning"}>{m.confidenceLevel}</Badge>
            </div>

            <div className="mt-5 grid md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs font-semibold text-zinc-400 mb-2">Text similarity</div>
                <ProgressBar value={Number(m.textSimilarity)} />
                <div className="text-xs text-zinc-500 mt-2">{Math.round(Number(m.textSimilarity) * 100)}%</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-400 mb-2">Rule score</div>
                <ProgressBar value={Number(m.ruleScore)} />
                <div className="text-xs text-zinc-500 mt-2">{Math.round(Number(m.ruleScore) * 100)}%</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-400 mb-2">Final score</div>
                <ProgressBar value={Number(m.finalScore)} />
                <div className="text-xs text-zinc-500 mt-2">{Math.round(Number(m.finalScore) * 100)}%</div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <PrimaryButton onClick={() => nav(`/verify/${m.id}`)}>Claim this item</PrimaryButton>
            </div>
          </Card>
        </>
      ) : q.isFetched ? (
        <div className="text-zinc-400">Match not found.</div>
      ) : null}
    </div>
  );
}

