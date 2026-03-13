import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { SecondaryButton } from "../components/SecondaryButton";
import { useNavigate } from "react-router-dom";

export default function ClaimsPage() {
  const nav = useNavigate();
  const q = useQuery({
    queryKey: ["claims", "mine"],
    queryFn: () => api<any>("/api/claims?mine=1")
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100">My claims</h1>
        <p className="mt-2 text-zinc-400">Claims stay pending until an admin reviews and approves/rejects.</p>
      </div>

      <Card>
        {q.isLoading ? <div className="text-zinc-400">Loading…</div> : null}
        {q.data?.claims?.length ? (
          <div className="grid gap-4">
            {q.data.claims.map((c: any) => (
              <div key={c.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-bold text-zinc-100">{c.match?.foundItem?.title}</div>
                    <div className="text-sm text-zinc-400 mt-1">{c.match?.confidenceLevel}</div>
                  </div>
                  <Badge tone={c.status === "APPROVED" ? "success" : c.status === "REJECTED" ? "danger" : "warning"}>{c.status}</Badge>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-zinc-400 mb-2">
                    <span>Final score</span>
                    <span>{Math.round(Number(c.match?.finalScore ?? 0) * 100)}%</span>
                  </div>
                  <ProgressBar value={Number(c.match?.finalScore ?? 0)} />
                </div>

                {c.status === "APPROVED" ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <SecondaryButton
                      onClick={async () => {
                        const res = await api<any>(`/api/chat/start/${c.match?.id}`, { method: "POST" });
                        nav(`/chat/${res.chatRoomId}`);
                      }}
                    >
                      Open chat
                    </SecondaryButton>
                    <div className="text-xs text-zinc-400">Chat opens only after admin approval.</div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-400">No claims yet.</div>
        )}
      </Card>
    </div>
  );
}
