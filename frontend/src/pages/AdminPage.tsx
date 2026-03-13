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

function toneForStatus(status: string) {
  if (status === "APPROVED") return "success";
  if (status === "REJECTED") return "danger";
  return "warning";
}

export default function AdminPage() {
  const q = useQuery({
    queryKey: ["admin", "claims"],
    queryFn: () => api<any>("/api/admin/claims")
  });

  const claims = q.data?.claims ?? [];
  const [selectedId, setSelectedId] = useState<string>("");
  const selected = useMemo(() => claims.find((c: any) => c.id === selectedId) ?? null, [claims, selectedId]);

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
          <SecondaryButton onClick={() => q.refetch()}>Refresh</SecondaryButton>
        </div>

        <Card>
          {q.isLoading ? <div className="text-zinc-400">Loading…</div> : null}

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
            <div className="text-zinc-400">No claims found.</div>
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
                  {selected.match?.lostItem?.category} • {selected.match?.lostItem?.color} • {selected.match?.lostItem?.location}
                </div>
              </div>
              <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
                <div className="text-xs font-semibold text-zinc-400 mb-1">Found item</div>
                <div className="font-semibold text-zinc-100">{selected.match?.foundItem?.title}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {selected.match?.foundItem?.category} • {selected.match?.foundItem?.color} • {selected.match?.foundItem?.location}
                </div>
              </div>
            </div>

            <div className="border border-white/10 rounded-2xl p-4 bg-white/5">
              <div className="flex items-center justify-between">
                <div className="font-bold text-zinc-100">Score breakdown</div>
                <Badge tone={selected.match?.confidenceLevel === "HIGH_CONFIDENCE" ? "success" : "warning"}>{selected.match?.confidenceLevel}</Badge>
              </div>
              <div className="mt-4 grid md:grid-cols-3 gap-4">
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-2">
                    <span>Text similarity</span>
                    <span>{Math.round(Number(selected.match?.textSimilarity ?? 0) * 100)}%</span>
                  </div>
                  <ProgressBar value={Number(selected.match?.textSimilarity ?? 0)} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-2">
                    <span>Rule score</span>
                    <span>{Math.round(Number(selected.match?.ruleScore ?? 0) * 100)}%</span>
                  </div>
                  <ProgressBar value={Number(selected.match?.ruleScore ?? 0)} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-zinc-400 mb-2">
                    <span>Final score</span>
                    <span>{Math.round(Number(selected.match?.finalScore ?? 0) * 100)}%</span>
                  </div>
                  <ProgressBar value={Number(selected.match?.finalScore ?? 0)} />
                </div>
              </div>
            </div>

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

