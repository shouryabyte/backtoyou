import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, getAuthUser } from "../http/middleware/auth.js";
import { getDbUser, loadUser } from "../http/middleware/loadUser.js";
import { HttpError } from "../http/errors.js";
import { buildVerificationPrompts, evaluateClaim } from "../verification/evaluateClaim.js";
import { Claim } from "../models/Claim.js";
import { Match } from "../models/Match.js";
import { Verification } from "../models/Verification.js";
import { FraudLog } from "../models/FraudLog.js";
import { User } from "../models/User.js";
import { serializeItem } from "../serializers/item.js";

export const claimsRouter = Router();

function isVague(v: unknown) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return true;
  if (s.length <= 2) return true;
  return ["idk", "i dont know", "dont know", "unknown", "na", "n/a", "none"].includes(s);
}

claimsRouter.post("/", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const viewer = { id: auth.id, role: dbUser.role } as const;
    const body = z.object({ matchId: z.string().min(1), answers: z.record(z.string(), z.any()) }).parse(req.body);
    if (!mongoose.isValidObjectId(body.matchId)) throw new HttpError(400, "BAD_ID", "Invalid match id");

    const recentCount = await Claim.countDocuments({
      claimantId: auth.id,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    if (recentCount >= 10) {
      await FraudLog.create({ userId: auth.id, reason: "CLAIM_RATE_LIMIT", meta: { recentCount } });
      await User.findByIdAndUpdate(auth.id, { $inc: { suspicionScore: 1 } });
      throw new HttpError(429, "RATE_LIMITED", "Too many claims in 24 hours");
    }

    const match = await Match.findById(body.matchId).populate("lostItemId").populate("foundItemId").lean();
    if (!match) throw new HttpError(404, "NOT_FOUND", "Match not found");
    const lostItem: any = (match as any).lostItemId;
    const foundItem: any = (match as any).foundItemId;
    if (String(lostItem.ownerId) !== auth.id) throw new HttpError(403, "FORBIDDEN", "Only the lost-item owner can claim");

    const prompts = buildVerificationPrompts(lostItem.privateDetails);
    for (const p of prompts) {
      const v = (body.answers as any)?.[p.key];
      if (typeof v !== "string" || !v.trim()) {
        throw new HttpError(400, "MISSING_ANSWERS", "All verification answers are required");
      }
    }

    const evaluation = evaluateClaim({ lostItem, answers: body.answers });

    const claim = await Claim.create({ matchId: match._id, claimantId: auth.id, status: "PENDING" });
    await Verification.create({
      claimId: claim._id,
      attemptNo: 1,
      answers: body.answers,
      kRequired: evaluation.kRequired,
      nTotal: evaluation.nTotal,
      verifiedCount: evaluation.verifiedCount,
      passes: evaluation.passes,
      breakdown: evaluation.breakdown
    });

    const answerValues = Object.values(body.answers ?? {});
    const vagueCount = answerValues.filter(isVague).length;
    if (answerValues.length >= 3 && vagueCount / answerValues.length >= 0.6) {
      await FraudLog.create({
        userId: auth.id,
        reason: "VAGUE_ANSWERS",
        meta: { claimId: String(claim._id), vagueCount, total: answerValues.length }
      });
      await User.findByIdAndUpdate(auth.id, { $inc: { suspicionScore: 1 } });
    }

    if (!evaluation.passes) {
      await FraudLog.create({ userId: auth.id, reason: "FAILED_CLAIM", meta: { claimId: String(claim._id) } });
      const updated = await User.findByIdAndUpdate(auth.id, { $inc: { suspicionScore: 1, trustScore: -0.02 } }, { new: true }).lean();
      if (updated?.suspicionScore != null && updated.suspicionScore >= 5) {
        await User.findByIdAndUpdate(auth.id, { $set: { "flags.isBlocked": true } });
      }
    }

    res.status(201).json({
      claim: {
        id: String(claim._id),
        status: claim.status,
        createdAt: claim.createdAt.toISOString(),
        match: {
          id: String(match._id),
          lostItem: serializeItem(lostItem, viewer),
          foundItem: serializeItem(foundItem, viewer),
          finalScore: match.finalScore,
          confidenceLevel: match.confidenceLevel
        }
      }
    });
  } catch (e) {
    next(e);
  }
});

claimsRouter.get("/", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const viewer = { id: auth.id, role: dbUser.role } as const;
    const mine = req.query.mine === "1";
    const filter = mine ? { claimantId: auth.id } : dbUser.role === "ADMIN" ? {} : { claimantId: auth.id };
    const claims = await Claim.find(filter).sort({ createdAt: -1 }).limit(50).lean();

    const matchIds = claims.map((c) => c.matchId);
    const matches = await Match.find({ _id: { $in: matchIds } }).populate("lostItemId").populate("foundItemId").lean();
    const byId = new Map(matches.map((m: any) => [String(m._id), m]));

    const out = claims.map((c: any) => {
      const m: any = byId.get(String(c.matchId));
      return {
        id: String(c._id),
        status: c.status,
        createdAt: new Date(c.createdAt).toISOString(),
        match: m
          ? {
              id: String(m._id),
              lostItem: serializeItem(m.lostItemId, viewer),
              foundItem: serializeItem(m.foundItemId, viewer),
              finalScore: m.finalScore,
              confidenceLevel: m.confidenceLevel
            }
          : null
      };
    });

    res.json({ claims: out });
  } catch (e) {
    next(e);
  }
});
