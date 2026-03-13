import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { MatchExplanationPanel } from "../components/MatchExplanationPanel";
import { Badge } from "../components/Badge";

export default function MatchDetailPageNew() {
  const nav = useNavigate();
  const { matchId } = useParams();

  const matchQ = useQuery({
    queryKey: ["match", matchId],
    enabled: Boolean(matchId),
    queryFn: () => api<any>(`/api/matches/${matchId}`)
  });

  const m = matchQ.data?.match;
  const relationship = String(m?.relationship ?? "");

  const adminExplainQ = useQuery({
    queryKey: ["admin", "match", matchId, "explanation"],
    enabled: Boolean(matchId) && relationship === "ADMIN",
    queryFn: () => api<any>(`/api/admin/matches/${matchId}/explanation`)
  });

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Possible match</h1>
          <p className="mt-2 text-zinc-400">Matching suggests candidates only. Verification + admin approval decide the return.</p>
        </div>
        <div className="flex gap-3">
          <Link to="/matches" className="text-sm font-semibold text-pink-300 hover:text-pink-200">
            {"<-"} Back to matches
          </Link>
        </div>
      </div>

      {matchQ.isLoading ? <div className="text-zinc-400">Loading...</div> : null}

      {m ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {m.lostItem ? (
              <Card>
                <div className="text-sm font-bold text-zinc-100">Lost item</div>
                <div className="mt-2 text-xl font-bold text-zinc-100">{m.lostItem?.title}</div>
                <div className="text-zinc-400 mt-1">
                  {[m.lostItem?.category, m.lostItem?.color, m.lostItem?.location].filter(Boolean).join(" • ")}
                </div>
                <div className="text-sm text-zinc-400 mt-3">{m.lostItem?.description}</div>
              </Card>
            ) : null}
            {m.foundItem ? (
              <Card>
                <div className="text-sm font-bold text-zinc-100">Found item</div>
                <div className="mt-2 text-xl font-bold text-zinc-100">{m.foundItem?.title}</div>
                <div className="text-zinc-400 mt-1">
                  {[m.foundItem?.category, m.foundItem?.color, m.foundItem?.location].filter(Boolean).join(" • ")}
                </div>
                <div className="text-sm text-zinc-400 mt-3">{m.foundItem?.description}</div>
              </Card>
            ) : null}
          </div>

          {relationship === "ADMIN" ? (
            adminExplainQ.data ? (
              <MatchExplanationPanel explanation={adminExplainQ.data} />
            ) : (
              <Card>Loading explanation...</Card>
            )
          ) : relationship === "LOST_OWNER" ? (
            <Card>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-lg font-bold text-zinc-100">Match confidence</div>
                  <div className="text-sm text-zinc-400 mt-1">{m.shortExplanation ?? "Suggested as a candidate match."}</div>
                </div>
                <Badge tone={m.confidence === "High" ? "success" : m.confidence === "Medium" ? "warning" : "danger"}>
                  {m.confidence ?? "Low"} confidence
                </Badge>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-lg font-bold text-zinc-100">Status</div>
              <div className="text-sm text-zinc-400 mt-2">{m.message ?? "Someone may claim this item. Waiting for verification."}</div>
            </Card>
          )}

          <div className="flex justify-end">
            {m.canClaim ? <PrimaryButton onClick={() => nav(`/verify/${m.id}`)}>Claim this item</PrimaryButton> : null}
          </div>
        </>
      ) : matchQ.isFetched ? (
        <div className="text-zinc-400">Match not found.</div>
      ) : null}
    </div>
  );
}
