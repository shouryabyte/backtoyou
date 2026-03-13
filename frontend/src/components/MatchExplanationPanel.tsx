import { Card } from "./Card";
import { Badge } from "./Badge";
import { ProgressBar } from "./ProgressBar";

export type MatchExplanation = {
  scores: {
    textSimilarity: number;
    categoryScore: number;
    colorScore: number;
    locationScore: number;
    dateScore: number;
    ruleScore: number;
    finalScore: number;
  };
  confidence: "High" | "Medium" | "Low";
  confidenceLevel?: string;
};

function pct(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

function toneForConfidence(c: MatchExplanation["confidence"]) {
  if (c === "High") return "success";
  if (c === "Medium") return "warning";
  return "danger";
}

export function MatchExplanationPanel({ explanation }: { explanation: MatchExplanation }) {
  const s = explanation.scores;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-lg font-bold text-zinc-100">Match Explanation</div>
          <div className="text-sm text-zinc-400 mt-1">Why this item was suggested as a candidate match.</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={toneForConfidence(explanation.confidence) as any}>{explanation.confidence} confidence</Badge>
          <div className="text-sm font-semibold text-zinc-100">{pct(s.finalScore)}%</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-2">
            <span>Final score</span>
            <span>{pct(s.finalScore)}%</span>
          </div>
          <ProgressBar value={s.finalScore} />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Text similarity</span>
              <span>{pct(s.textSimilarity)}%</span>
            </div>
            <ProgressBar value={s.textSimilarity} />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Rule score (avg)</span>
              <span>{pct(s.ruleScore)}%</span>
            </div>
            <ProgressBar value={s.ruleScore} />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Category match</span>
              <span>{pct(s.categoryScore)}%</span>
            </div>
            <ProgressBar value={s.categoryScore} />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Color match</span>
              <span>{pct(s.colorScore)}%</span>
            </div>
            <ProgressBar value={s.colorScore} />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Location proximity</span>
              <span>{pct(s.locationScore)}%</span>
            </div>
            <ProgressBar value={s.locationScore} />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-400 mb-2">
              <span>Date proximity</span>
              <span>{pct(s.dateScore)}%</span>
            </div>
            <ProgressBar value={s.dateScore} />
          </div>
        </div>
      </div>
    </Card>
  );
}

