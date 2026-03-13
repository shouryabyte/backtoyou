import mongoose from "mongoose";
import { env } from "../config/env.js";
import { HttpError } from "../http/errors.js";
import { Item } from "../models/Item.js";
import { Match } from "../models/Match.js";
import { scoreCandidates, type MlItemPublic } from "../ml/mlClient.js";

function toMlItem(item: any): MlItemPublic {
  return {
    id: String(item._id),
    type: item.type,
    title: item.title,
    description: item.description ?? "",
    category: item.category,
    color: item.color ?? "",
    location: item.location ?? "",
    eventAt: new Date(item.eventAt).toISOString()
  };
}

export async function generateMatchesForItem(itemId: string) {
  if (!mongoose.isValidObjectId(itemId)) throw new HttpError(400, "BAD_ID", "Invalid item id");
  const item = await Item.findById(itemId).lean();
  if (!item) throw new HttpError(404, "NOT_FOUND", "Item not found");
  if (item.status !== "ACTIVE") return { created: 0 };

  const oppositeType = item.type === "LOST" ? "FOUND" : "LOST";
  const candidates = await Item.find({ type: oppositeType, status: "ACTIVE" }).sort({ createdAt: -1 }).limit(400).lean();
  if (!candidates.length) return { created: 0 };

  const target = toMlItem(item);
  const scored = await scoreCandidates(target, candidates.map(toMlItem));

  const best = scored[0];
  const second = scored[1];
  const separation = best && second ? best.finalScore - second.finalScore : null;

  let created = 0;
  for (const s of scored.slice(0, 10)) {
    const candId = s.candidateId;
    if (!mongoose.isValidObjectId(candId)) continue;
    const candObjId = new mongoose.Types.ObjectId(candId);
    const lostItemId = item.type === "LOST" ? item._id : candObjId;
    const foundItemId = item.type === "FOUND" ? item._id : candObjId;
    const finalScore = Number(s.finalScore) || 0;

    const confidenceLevel = finalScore >= env.HIGH_CONFIDENCE_THRESHOLD ? "HIGH_CONFIDENCE" : "AMBIGUOUS";
    const confidence = finalScore >= 0.9 ? "High" : finalScore >= 0.75 ? "Medium" : "Low";

    const bd: any = typeof s.breakdown === "object" && s.breakdown ? s.breakdown : {};
    const scoreBag: any = bd?.scores && typeof bd.scores === "object" ? bd.scores : null;
    const scores = scoreBag
      ? {
          textSimilarity: Number(scoreBag.textSimilarity ?? s.textSimilarity) || 0,
          categoryScore: Number(scoreBag.categoryScore) || 0,
          colorScore: Number(scoreBag.colorScore) || 0,
          locationScore: Number(scoreBag.locationScore) || 0,
          dateScore: Number(scoreBag.dateScore) || 0,
          ruleScore: Number(scoreBag.ruleScore ?? s.ruleScore) || 0,
          finalScore: Number(scoreBag.finalScore ?? s.finalScore) || 0
        }
      : {
          textSimilarity: Number(s.textSimilarity) || 0,
          categoryScore: 0,
          colorScore: 0,
          locationScore: 0,
          dateScore: 0,
          ruleScore: Number(s.ruleScore) || 0,
          finalScore
        };

    await Match.findOneAndUpdate(
      { lostItemId, foundItemId },
      {
        $set: {
          lostItemId,
          foundItemId,
          textSimilarity: Number(s.textSimilarity) || 0,
          ruleScore: Number(s.ruleScore) || 0,
          finalScore,
          scores,
          confidence,
          confidenceLevel,
          breakdown: { ...(typeof s.breakdown === "object" && s.breakdown ? s.breakdown : {}), separation }
        }
      },
      { upsert: true, new: true }
    );
    created += 1;
  }

  return { created, separation };
}
