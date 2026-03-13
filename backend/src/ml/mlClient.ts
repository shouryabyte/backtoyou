import { env } from "../config/env.js";
import { HttpError } from "../http/errors.js";
import { scoreCandidatesLocal } from "./localScorer.js";

export type MlItemPublic = {
  id: string;
  type: "LOST" | "FOUND";
  title: string;
  description?: string;
  category: string;
  color?: string;
  location?: string;
  eventAt: string; // ISO
};

export type MlScoreResult = {
  candidateId: string;
  textSimilarity: number;
  ruleScore: number;
  finalScore: number;
  confidenceLevel: "HIGH_CONFIDENCE" | "AMBIGUOUS";
  breakdown: unknown;
};

export async function scoreCandidates(target: MlItemPublic, candidates: MlItemPublic[]): Promise<MlScoreResult[]> {
  if ((process.env.ML_MODE ?? "").toLowerCase() === "local") {
    return scoreCandidatesLocal(target, candidates);
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.ML_TIMEOUT_MS ?? 2500);
  const t = setTimeout(() => controller.abort(), Math.max(250, timeoutMs));

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (env.ML_SERVICE_TOKEN) headers["x-ml-token"] = env.ML_SERVICE_TOKEN;

    const res = await fetch(`${env.ML_SERVICE_URL}/score`, {
      method: "POST",
      headers,
      body: JSON.stringify({ target, candidates }),
      signal: controller.signal
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new HttpError(502, "ML_SERVICE_ERROR", "ML service error", { status: res.status, body: data });
    }
    return Array.isArray(data) ? (data as MlScoreResult[]) : [];
  } catch (e: any) {
    // If Python service is unavailable, fall back to local classical scoring (TF‑IDF + cosine + rules).
    if (process.env.ML_FALLBACK_DISABLE === "1") throw e;
    return scoreCandidatesLocal(target, candidates);
  } finally {
    clearTimeout(t);
  }
}
