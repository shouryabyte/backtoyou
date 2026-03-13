import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requireRole, getAuthUser } from "../http/middleware/auth.js";
import { loadUser } from "../http/middleware/loadUser.js";
import { HttpError } from "../http/errors.js";
import { sendEmail } from "../email/mailer.js";
import { Claim } from "../models/Claim.js";
import { Match } from "../models/Match.js";
import { Verification } from "../models/Verification.js";
import { User } from "../models/User.js";
import { Item } from "../models/Item.js";
import { FraudLog } from "../models/FraudLog.js";
import { serializeItem } from "../serializers/item.js";
import { ChatRoom } from "../models/ChatRoom.js";

export const adminRouter = Router();

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normalizeText(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

function tokenSet(v: unknown) {
  return new Set(
    normalizeText(v)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 2)
  );
}

function computeRuleScores(lost: any, found: any) {
  const categoryScore = normalizeText(lost.category) && normalizeText(lost.category) === normalizeText(found.category) ? 1 : 0;

  const ca = normalizeText(lost.color);
  const cb = normalizeText(found.color);
  const colorScore = ca && cb && (ca === cb || ca.includes(cb) || cb.includes(ca)) ? 1 : 0;

  const la = tokenSet(lost.location);
  const lb = tokenSet(found.location);
  let locationScore = 0;
  if (la.size && lb.size) {
    let inter = 0;
    for (const t of la) if (lb.has(t)) inter += 1;
    const union = new Set([...la, ...lb]).size;
    locationScore = union ? inter / union : 0;
  }

  const a = Date.parse(String(lost.eventAt ?? ""));
  const b = Date.parse(String(found.eventAt ?? ""));
  let dateScore = 0;
  if (Number.isFinite(a) && Number.isFinite(b)) {
    const diffDays = Math.abs(a - b) / (1000 * 60 * 60 * 24);
    dateScore = clamp01(1 - diffDays / 14);
  }

  const ruleScore = clamp01((categoryScore + colorScore + locationScore + dateScore) / 4);
  return { categoryScore, colorScore, locationScore, dateScore, ruleScore };
}

function confidenceLabel(finalScore: number) {
  if (finalScore >= 0.9) return "High";
  if (finalScore >= 0.75) return "Medium";
  return "Low";
}

adminRouter.get("/matches/:id/explanation", requireAuth, loadUser, requireRole("ADMIN"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "BAD_ID", "Invalid match id");
    const match = await Match.findById(req.params.id).populate("lostItemId").populate("foundItemId").lean();
    if (!match) throw new HttpError(404, "NOT_FOUND", "Match not found");

    const lostItem: any = (match as any).lostItemId;
    const foundItem: any = (match as any).foundItemId;

    const bd: any = (match as any).breakdown ?? {};
    const storedScores: any = bd?.scores && typeof bd.scores === "object" ? bd.scores : null;
    const computedRules = computeRuleScores(lostItem, foundItem);

    const scores = {
      textSimilarity: clamp01(Number(storedScores?.textSimilarity ?? (match as any).scores?.textSimilarity ?? (match as any).textSimilarity ?? 0)),
      categoryScore: clamp01(Number(storedScores?.categoryScore ?? (match as any).scores?.categoryScore ?? computedRules.categoryScore)),
      colorScore: clamp01(Number(storedScores?.colorScore ?? (match as any).scores?.colorScore ?? computedRules.colorScore)),
      locationScore: clamp01(Number(storedScores?.locationScore ?? (match as any).scores?.locationScore ?? computedRules.locationScore)),
      dateScore: clamp01(Number(storedScores?.dateScore ?? (match as any).scores?.dateScore ?? computedRules.dateScore)),
      ruleScore: clamp01(Number(storedScores?.ruleScore ?? (match as any).scores?.ruleScore ?? (match as any).ruleScore ?? computedRules.ruleScore)),
      finalScore: clamp01(Number(storedScores?.finalScore ?? (match as any).scores?.finalScore ?? (match as any).finalScore ?? 0))
    };

    res.json({
      lostItemId: String(lostItem._id),
      foundItemId: String(foundItem._id),
      scores,
      confidence: confidenceLabel(scores.finalScore),
      confidenceLevel: (match as any).confidenceLevel
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/items", requireAuth, loadUser, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");

    const status = z.enum(["ACTIVE", "RETURNED", "ARCHIVED"]).optional().parse(req.query.status);
    const type = z.enum(["LOST", "FOUND"]).optional().parse(req.query.type);

    const filter: any = {};
    if (status) filter.status = status;
    if (type) filter.type = type;

    const items = await Item.find(filter).sort({ createdAt: -1 }).limit(50).populate("ownerId").lean();

    res.json({
      items: items.map((it: any) => ({
        ...serializeItem(it, { id: auth.id, role: "ADMIN" }),
        owner: it.ownerId
          ? {
              id: String(it.ownerId._id),
              email: it.ownerId.email,
              name: it.ownerId.name ?? null
            }
          : { id: String(it.ownerId), email: null, name: null }
      }))
    });
  } catch (e) {
    next(e);
  }
});

adminRouter.get("/claims", requireAuth, loadUser, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const claims = await Claim.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const matchIds = claims.map((c) => c.matchId);
    const claimantIds = claims.map((c) => c.claimantId);

    const [matches, users, verifications] = await Promise.all([
      Match.find({ _id: { $in: matchIds } }).populate("lostItemId").populate("foundItemId").lean(),
      User.find({ _id: { $in: claimantIds } }).lean(),
      Verification.find({ claimId: { $in: claims.map((c) => c._id) } }).sort({ attemptNo: -1 }).lean()
    ]);

    const matchById = new Map(matches.map((m: any) => [String(m._id), m]));
    const userById = new Map(users.map((u: any) => [String(u._id), u]));
    const latestVerificationByClaim = new Map<string, any>();
    for (const v of verifications as any[]) {
      const key = String(v.claimId);
      if (!latestVerificationByClaim.has(key)) latestVerificationByClaim.set(key, v);
    }

    const out = claims.map((c: any) => {
      const m: any = matchById.get(String(c.matchId));
      const u: any = userById.get(String(c.claimantId));
      const v: any = latestVerificationByClaim.get(String(c._id));
      return {
        id: String(c._id),
        status: c.status,
        createdAt: new Date(c.createdAt).toISOString(),
        decidedAt: c.decidedAt ? new Date(c.decidedAt).toISOString() : null,
        decisionNotes: c.decisionNotes ?? null,
        claimant: u
          ? {
              id: String(u._id),
              email: u.email,
              name: u.name ?? null,
              trustScore: u.trustScore,
              suspicionScore: u.suspicionScore,
              flags: u.flags ?? {}
            }
          : null,
        match: m
          ? {
              id: String(m._id),
              lostItem: serializeItem(m.lostItemId, { id: String(u?._id ?? ""), role: "ADMIN" }),
              foundItem: serializeItem(m.foundItemId, { id: String(u?._id ?? ""), role: "ADMIN" }),
              textSimilarity: m.textSimilarity,
              ruleScore: m.ruleScore,
              finalScore: m.finalScore,
              confidenceLevel: m.confidenceLevel,
              breakdown: m.breakdown ?? {}
            }
          : null,
        verification: v
          ? {
              attemptNo: v.attemptNo,
              passes: v.passes,
              verifiedCount: v.verifiedCount,
              nTotal: v.nTotal,
              kRequired: v.kRequired,
              answers: v.answers ?? {},
              breakdown: v.breakdown ?? {}
            }
          : null
      };
    });

    res.json({ claims: out });
  } catch (e) {
    next(e);
  }
});

adminRouter.post("/claims/:id/decision", requireAuth, loadUser, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "BAD_ID", "Invalid claim id");
    const body = z.object({ approve: z.boolean(), notes: z.string().optional() }).parse(req.body);

    const claim = await Claim.findById(req.params.id).lean();
    if (!claim) throw new HttpError(404, "NOT_FOUND", "Claim not found");
    if (claim.status !== "PENDING") throw new HttpError(409, "ALREADY_DECIDED", "Claim already decided");

    const updated = await Claim.findByIdAndUpdate(
      claim._id,
      {
        $set: {
          status: body.approve ? "APPROVED" : "REJECTED",
          adminId: auth.id,
          decisionNotes: body.notes,
          decidedAt: new Date()
        }
      },
      { new: true }
    );
    if (!updated) throw new HttpError(500, "UPDATE_FAILED", "Failed to update claim");

    const match = await Match.findById(claim.matchId).populate("lostItemId").populate("foundItemId").lean();
    if (!match) throw new HttpError(404, "NOT_FOUND", "Match not found");
    const lostItem: any = (match as any).lostItemId;
    const foundItem: any = (match as any).foundItemId;

    const claimant = await User.findById(claim.claimantId).lean();
    if (!claimant) throw new HttpError(404, "NOT_FOUND", "Claimant not found");

    if (body.approve) {
      await Item.updateOne({ _id: lostItem._id }, { $set: { status: "RETURNED" } });
      await Item.updateOne({ _id: foundItem._id }, { $set: { status: "RETURNED" } });
      await User.updateOne({ _id: claim.claimantId }, { $inc: { trustScore: 0.05 }, $set: { "flags.isBlocked": false } });

      // Chat is created only after admin approval (secure communication).
      await ChatRoom.findOneAndUpdate(
        { matchId: match._id },
        { $setOnInsert: { matchId: match._id, lostUserId: lostItem.ownerId, foundUserId: foundItem.ownerId } },
        { upsert: true, new: true }
      );

      await sendEmail(
        claimant.email,
        "BackToYou: Claim approved",
        `Your claim for "${foundItem.title}" was approved. Please coordinate pickup with the admin desk.`
      );
    } else {
      await FraudLog.create({
        userId: claim.claimantId,
        reason: "REJECTED_CLAIM",
        meta: { claimId: String(claim._id), notes: body.notes ?? null }
      });
      await User.updateOne({ _id: claim.claimantId }, { $inc: { trustScore: -0.01, suspicionScore: 1 } });
    }

    res.json({
      claim: {
        id: String(updated._id),
        status: updated.status,
        decidedAt: updated.decidedAt ? updated.decidedAt.toISOString() : null,
        decisionNotes: updated.decisionNotes ?? null,
        match: {
          id: String(match._id),
          lostItem: serializeItem(lostItem, { id: auth.id, role: "ADMIN" }),
          foundItem: serializeItem(foundItem, { id: auth.id, role: "ADMIN" }),
          finalScore: match.finalScore,
          confidenceLevel: match.confidenceLevel
        }
      }
    });
  } catch (e) {
    next(e);
  }
});
