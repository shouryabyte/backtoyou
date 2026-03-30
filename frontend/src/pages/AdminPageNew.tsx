import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Badge } from "../components/Badge";
import { ProgressBar } from "../components/ProgressBar";
import { Modal } from "../components/Modal";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";
import { MatchExplanationPanel } from "../components/MatchExplanationPanel";
import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";

function toneForStatus(status: string) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export default function AdminPageNew() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";

  const q = useQuery({
    queryKey: ["admin", "claims"],
    enabled: isAdmin,
    queryFn: () => api<any>("/api/admin/claims")
  });

  const itemsQ = useQuery({
    queryKey: ["admin", "items"],
    enabled: isAdmin,
    queryFn: () => api<any>("/api/admin/items")
  });

  const claims = q.data?.claims ?? [];
  const items = itemsQ.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(() => claims.find((c: any) => c.id === selectedId) ?? null, [claims, selectedId]);

  const explainQ = useQuery({
    queryKey: ["match", selected?.match?.id, "explanation"],
    enabled: isAdmin && Boolean(selected?.match?.id),
    queryFn: () => api<any>(`/api/admin/matches/${selected.match.id}/explanation`)
  });

  async function decide(id: string, approve: boolean) {
    await api(`/api/admin/claims/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ approve, notes: approve ? "Approved by admin" : "Rejected by admin" })
    });
    toast.success(approve ? "Claim approved" : "Claim rejected");
    await q.refetch();
    setSelectedId("");
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">Admin Review</h1>
            <p className="mt-2 text-zinc-400">Inspect matches, verification answers, and user risk indicators before approving.</p>
          </div>
          <SecondaryButton
            onClick={async () => {
              await Promise.all([q.refetch(), itemsQ.refetch()]);
            }}
          >
            Refresh
          </SecondaryButton>
        </div>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-zinc-100">Recent reports</div>
              <div className="text-sm text-zinc-400">All lost/found submissions (independent of claims).</div>
            </div>
          </div>

          {itemsQ.isLoading ? <div className="mt-4 text-zinc-400">Loading...</div> : null}
          {items.length ? (
            <div className="mt-4 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-400">
                  <tr className="border-b border-white/10">
                    <th className="py-3 pr-2">Type</th>
                    <th className="py-3 pr-2">Title</th>
                    <th className="py-3 pr-2">Owner</th>
                    <th className="py-3 pr-2">Status</th>
                    <th className="py-3 pr-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it: any) => (
                    <tr key={it.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 pr-2">
                        <Badge tone={it.type === "LOST" ? "warning" : "neutral"}>{it.type}</Badge>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="font-semibold text-zinc-100">{it.title}</div>
                        <div className="text-xs text-zinc-400">{[it.category, it.color, it.location].filter(Boolean).join(" • ")}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="text-zinc-100">{it.owner?.email ?? String(it.ownerId).slice(0, 8) + "…"}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <Badge tone={it.status === "RETURNED" ? "success" : it.status === "ARCHIVED" ? "neutral" : "neutral"}>
                          {it.status}
                        </Badge>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="text-xs text-zinc-400">{new Date(it.eventAt).toLocaleDateString()}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : itemsQ.isFetched ? (
            <div className="mt-4 text-zinc-400">
              No items found. If you entered items earlier, check that your backend is connected to the same `MONGODB_URI` as before.
            </div>
          ) : null}
        </Card>

        <Card>
          {q.isLoading ? <div className="text-zinc-400">Loading...</div> : null}

          {claims.length ? (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-zinc-400">
                  <tr className="border-b border-white/10">
                    <th className="py-3 pr-2">Item</th>
                    <th className="py-3 pr-2">Claimant</th>
                    <th className="py-3 pr-2">Score</th>
                    <th className="py-3 pr-2">Status</th>
                    <th className="py-3 pr-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c: any) => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-3 pr-2">
                        <div className="font-semibold text-zinc-100">{c.match?.foundItem?.title}</div>
                        <div className="text-xs text-zinc-400">{c.match?.confidenceLevel}</div>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="text-zinc-100">{c.claimant?.email}</div>
                        <div className="text-xs text-zinc-400">
                          trust {Number(c.claimant?.trustScore ?? 0).toFixed(2)} • suspicion {c.claimant?.suspicionScore ?? 0}
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="w-40">
                            <ProgressBar value={Number(c.match?.finalScore ?? 0)} />
                          </div>
                          <div className="text-xs font-semibold text-zinc-100">{Math.round(Number(c.match?.finalScore ?? 0) * 100)}%</div>
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        <Badge tone={toneForStatus(c.status) as any}>{c.status}</Badge>
                      </td>
                      <td className="py-3 pr-2">
                        <PrimaryButton onClick={() => setSelectedId(c.id)}>Review</PrimaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-zinc-400">
              No claims found. A claim appears only when the lost-item owner completes verification for a match.
            </div>
          )}
        </Card>
      </div>

      <Modal open={Boolean(selected)} title="Claim review" onClose={() => setSelectedId("")}>
        {selected ? (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                <div className="text-xs font-semibold text-zinc-400 mb-1">Lost item</div>
                <div className="font-semibold text-zinc-100">{selected.match?.lostItem?.title}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {[selected.match?.lostItem?.category, selected.match?.lostItem?.color, selected.match?.lostItem?.location]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              </div>
              <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                <div className="text-xs font-semibold text-zinc-400 mb-1">Found item</div>
                <div className="font-semibold text-zinc-100">{selected.match?.foundItem?.title}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {[selected.match?.foundItem?.category, selected.match?.foundItem?.color, selected.match?.foundItem?.location]
                    .filter(Boolean)
                    .join(" • ")}
                </div>
              </div>
            </div>

            {explainQ.data ? <MatchExplanationPanel explanation={explainQ.data} /> : <Card>Loading explanation...</Card>}

            <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
              <div className="font-bold text-zinc-100 mb-2">Verification answers</div>
              {selected.verification ? (
                <div>
                  <div className="text-xs text-zinc-400 mb-3">
                    result: {selected.verification.verifiedCount}/{selected.verification.nTotal} (k={selected.verification.kRequired}) •{" "}
                    {selected.verification.passes ? "PASS" : "FAIL"}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    {Object.entries(selected.verification.answers ?? {}).map(([k, v]) => (
                      <div key={k} className="border border-white/10 rounded-xl p-3 bg-black/20">
                        <div className="text-xs font-semibold text-zinc-400">{k}</div>
                        <div className="text-sm text-zinc-100 mt-1">{String(v ?? "")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-zinc-400">No verification record found.</div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <SecondaryButton type="button" onClick={() => setSelectedId("")}>
                Close
              </SecondaryButton>
              {selected.status === "APPROVED" ? (
                <Link className="inline-flex" to={`/chats`}>
                  <SecondaryButton type="button">Open chats</SecondaryButton>
                </Link>
              ) : null}
              <SecondaryButton
                type="button"
                className="border-red-500/30 text-red-200 hover:bg-red-500/10"
                onClick={() => decide(selected.id, false)}
                disabled={selected.status !== "PENDING"}
              >
                Reject
              </SecondaryButton>
              <PrimaryButton type="button" onClick={() => decide(selected.id, true)} disabled={selected.status !== "PENDING"}>
                Approve
              </PrimaryButton>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
