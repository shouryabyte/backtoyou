import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { api, apiErrorMessage } from "../lib/apiClient";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { ErrorAlert } from "../components/ErrorAlert";
import { PrimaryButton } from "../components/PrimaryButton";
import { SecondaryButton } from "../components/SecondaryButton";

export default function VerifyPage() {
  const { matchId } = useParams();
  const nav = useNavigate();

  const promptsQ = useQuery({
    queryKey: ["claimPrompts", matchId],
    enabled: Boolean(matchId),
    queryFn: () => api<any>(`/api/matches/${matchId}/claim-prompts`)
  });

  const { register, handleSubmit, formState, setError } = useForm<Record<string, string>>({ defaultValues: {} });

  async function onSubmit(values: Record<string, string>) {
    try {
      await api("/api/claims", { method: "POST", body: JSON.stringify({ matchId, answers: values }) });
      toast.success("Verification submitted. Awaiting admin review.");
      nav("/claims");
    } catch (e) {
      setError("root", { message: apiErrorMessage(e) });
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <Card className="p-10">
        <h1 className="text-2xl font-bold text-zinc-100">Verify ownership</h1>
        <p className="mt-2 text-zinc-400">Answer private questions. False claims are blocked.</p>

        {promptsQ.isLoading ? <div className="mt-6 text-zinc-400">Loading questions…</div> : null}

        <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {(promptsQ.data?.prompts ?? []).map((p: any) => (
            <Input key={p.key} label={p.label} {...register(p.key)} />
          ))}

          {formState.errors.root?.message ? <ErrorAlert message={formState.errors.root.message} /> : null}

          <div className="flex items-center justify-between gap-3 pt-2">
            <Link to="/matches" className="text-sm font-semibold text-pink-300 hover:text-pink-200">
              ← Back
            </Link>
            <div className="flex gap-3">
              <SecondaryButton type="button" onClick={() => nav("/matches")}>
                Cancel
              </SecondaryButton>
              <PrimaryButton type="submit" disabled={formState.isSubmitting}>
                {formState.isSubmitting ? "Submitting…" : "Submit verification"}
              </PrimaryButton>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

