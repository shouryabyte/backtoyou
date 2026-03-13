import natural from "natural";

import type { MlItemPublic, MlScoreResult } from "./mlClient.js";
import { env } from "../config/env.js";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeText(v: unknown) {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(v: unknown) {
  const s = normalizeText(v);
  const parts = s ? s.split(" ") : [];
  const stop = new Set((natural as any).stopwords ?? []);
  return parts.filter((t) => t.length >= 2 && !stop.has(t));
}

function cosineFromTfidfMaps(a: Map<string, number>, b: Map<string, number>) {
  if (!a.size || !b.size) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [term, av] of small) {
    const bv = big.get(term);
    if (bv != null) dot += av * bv;
  }
  let na = 0;
  for (const av of a.values()) na += av * av;
  let nb = 0;
  for (const bv of b.values()) nb += bv * bv;
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return clamp01(dot / denom);
}

function ruleScore(target: MlItemPublic, cand: MlItemPublic) {
  const categoryScore = normalizeText(target.category) && normalizeText(target.category) === normalizeText(cand.category) ? 1 : 0;

  const colorA = normalizeText(target.color);
  const colorB = normalizeText(cand.color);
  const colorScore = !colorA || !colorB ? 0 : colorA === colorB || colorA.includes(colorB) || colorB.includes(colorA) ? 1 : 0;

  const locA = new Set(tokenize(target.location));
  const locB = new Set(tokenize(cand.location));
  let locationScore = 0;
  if (locA.size && locB.size) {
    let inter = 0;
    for (const t of locA) if (locB.has(t)) inter += 1;
    const union = new Set([...locA, ...locB]).size;
    locationScore = union ? inter / union : 0;
  }

  const dateA = Date.parse(target.eventAt);
  const dateB = Date.parse(cand.eventAt);
  let dateScore = 0;
  if (Number.isFinite(dateA) && Number.isFinite(dateB)) {
    const diffDays = Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24);
    dateScore = clamp01(1 - diffDays / 14);
  }

  // Prompt requirement: rule_score is an unweighted average of component scores.
  const score = clamp01((categoryScore + colorScore + locationScore + dateScore) / 4);

  return {
    score,
    breakdown: { categoryScore, colorScore, locationScore, dateScore }
  };
}

function docText(item: MlItemPublic) {
  return normalizeText([item.title, item.description, item.category, item.color, item.location].filter(Boolean).join(" "));
}

export function scoreCandidatesLocal(target: MlItemPublic, candidates: MlItemPublic[]): MlScoreResult[] {
  const tfidf = new natural.TfIdf();
  const docs = [docText(target), ...candidates.map(docText)];
  for (const d of docs) tfidf.addDocument(d);

  function tfidfMap(docIndex: number) {
    const m = new Map<string, number>();
    for (const t of tfidf.listTerms(docIndex)) {
      if (t && t.term && Number.isFinite(t.tfidf)) m.set(String(t.term), Number(t.tfidf));
    }
    return m;
  }

  const targetMap = tfidfMap(0);

  const out: MlScoreResult[] = candidates.map((c, idx) => {
    const cMap = tfidfMap(idx + 1);
    const textSimilarity = cosineFromTfidfMaps(targetMap, cMap);
    const rules = ruleScore(target, c);
    const finalScore = clamp01(0.6 * textSimilarity + 0.4 * rules.score);
    return {
      candidateId: c.id,
      textSimilarity,
      ruleScore: rules.score,
      finalScore,
      confidenceLevel: finalScore >= env.HIGH_CONFIDENCE_THRESHOLD ? "HIGH_CONFIDENCE" : "AMBIGUOUS",
      breakdown: {
        engine: "local",
        scores: {
          textSimilarity,
          ...rules.breakdown,
          ruleScore: rules.score,
          finalScore
        },
        formula: "final = 0.6*text + 0.4*rules"
      }
    };
  });

  out.sort((a, b) => b.finalScore - a.finalScore);
  return out;
}
