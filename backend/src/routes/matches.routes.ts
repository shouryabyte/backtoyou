import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, getAuthUser } from "../http/middleware/auth.js";
import { getDbUser, loadUser } from "../http/middleware/loadUser.js";
import { HttpError } from "../http/errors.js";
import { buildVerificationPrompts } from "../verification/evaluateClaim.js";
import { Match } from "../models/Match.js";
import { serializeItem } from "../serializers/item.js";
import { Item } from "../models/Item.js";

export const matchesRouter = Router();

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

function shortExplanationFromScores(scores: any) {
  const parts: string[] = [];
  const t = Number(scores?.textSimilarity ?? 0);
  const category = Number(scores?.categoryScore ?? 0);
  const color = Number(scores?.colorScore ?? 0);
  const location = Number(scores?.locationScore ?? 0);
  const date = Number(scores?.dateScore ?? 0);

  if (t >= 0.6) parts.push("description similarity");
  if (category >= 1) parts.push("category match");
  if (color >= 1) parts.push("color match");
  if (location >= 0.4) parts.push("location overlap");
  if (date >= 0.6) parts.push("date proximity");

  if (!parts.length) return "Suggested based on the item details you provided.";
  return `Suggested due to ${parts.slice(0, 3).join(" and ")}.`;
}

function readScores(match: any, lostItem: any, foundItem: any) {
  const bd: any = match?.breakdown ?? {};
  const storedScores: any = bd?.scores && typeof bd.scores === "object" ? bd.scores : null;
  const computedRules = computeRuleScores(lostItem, foundItem);

  const textSimilarity = clamp01(Number(storedScores?.textSimilarity ?? match?.textSimilarity ?? 0));
  const categoryScore = clamp01(Number(storedScores?.categoryScore ?? match?.scores?.categoryScore ?? computedRules.categoryScore));
  const colorScore = clamp01(Number(storedScores?.colorScore ?? match?.scores?.colorScore ?? computedRules.colorScore));
  const locationScore = clamp01(Number(storedScores?.locationScore ?? match?.scores?.locationScore ?? computedRules.locationScore));
  const dateScore = clamp01(Number(storedScores?.dateScore ?? match?.scores?.dateScore ?? computedRules.dateScore));
  const ruleScore = clamp01(Number(storedScores?.ruleScore ?? match?.ruleScore ?? computedRules.ruleScore));
  const finalScore = clamp01(Number(storedScores?.finalScore ?? match?.finalScore ?? 0));

  return { textSimilarity, categoryScore, colorScore, locationScore, dateScore, ruleScore, finalScore };
}

matchesRouter.get("/", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const viewer = { id: auth.id, role: dbUser.role } as const;
    const itemId = z.string().optional().parse(req.query.itemId);
    const mine = req.query.mine === "1";

    let filter: any = {};
    if (itemId) {
      if (!mongoose.isValidObjectId(itemId)) throw new HttpError(400, "BAD_ID", "Invalid item id");

      const item = await Item.findById(itemId).lean();
      if (!item) throw new HttpError(404, "NOT_FOUND", "Item not found");
      if (dbUser.role !== "ADMIN" && String(item.ownerId) !== dbUser.id) {
        throw new HttpError(403, "FORBIDDEN", "Not allowed");
      }

      filter = { $or: [{ lostItemId: itemId }, { foundItemId: itemId }] };
    } else if (dbUser.role !== "ADMIN" || mine) {
      const myItems = await Item.find({ ownerId: auth.id }, { _id: 1 }).lean();
      const ids = myItems.map((i: any) => i._id);
      filter = { $or: [{ lostItemId: { $in: ids } }, { foundItemId: { $in: ids } }] };
    }
    const matches = await Match.find(filter)
      .sort({ finalScore: -1 })
      .limit(50)
      .populate("lostItemId")
      .populate("foundItemId")
      .lean();

    const isAdmin = dbUser.role === "ADMIN";
    const out = matches.map((m: any) => {
      const lostItem: any = m.lostItemId;
      const foundItem: any = m.foundItemId;
      const isLostOwner = String(lostItem.ownerId) === viewer.id;
      const isFoundOwner = String(foundItem.ownerId) === viewer.id;

      if (isAdmin) {
        const scores = readScores(m, lostItem, foundItem);
        return {
          id: String(m._id),
          lostItem: serializeItem(lostItem, viewer),
          foundItem: serializeItem(foundItem, viewer),
          scores,
          confidence: confidenceLabel(scores.finalScore),
          confidenceLevel: m.confidenceLevel,
          createdAt: new Date(m.createdAt).toISOString()
        };
      }

      if (isLostOwner) {
        const scores = readScores(m, lostItem, foundItem);
        return {
          id: String(m._id),
          relationship: "LOST_OWNER",
          lostItem: serializeItem(lostItem, viewer),
          foundItem: serializeItem(foundItem, viewer),
          confidenceLevel: m.confidenceLevel,
          confidence: confidenceLabel(scores.finalScore),
          shortExplanation: shortExplanationFromScores(scores),
          canClaim: true,
          createdAt: new Date(m.createdAt).toISOString()
        };
      }

      if (isFoundOwner) {
        return {
          id: String(m._id),
          relationship: "FOUND_REPORTER",
          foundItem: serializeItem(foundItem, viewer),
          message: "Someone may claim this item. Waiting for verification.",
          createdAt: new Date(m.createdAt).toISOString()
        };
      }

      return {
        id: String(m._id),
        message: "Not available",
        createdAt: new Date(m.createdAt).toISOString()
      };
    });

    res.json({ matches: out });
  } catch (e) {
    next(e);
  }
});

matchesRouter.get("/:id/claim-prompts", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const match = await Match.findById(req.params.id).populate("lostItemId").populate("foundItemId").lean();
    if (!match) throw new HttpError(404, "NOT_FOUND", "Match not found");
    const lostItem: any = (match as any).lostItemId;
    if (String(lostItem.ownerId) !== auth.id && dbUser.role !== "ADMIN") {
      throw new HttpError(403, "FORBIDDEN", "Only the lost-item reporter can claim");
    }
    const prompts = buildVerificationPrompts(lostItem.privateDetails);
    res.json({ prompts });
  } catch (e) {
    next(e);
  }
});

matchesRouter.get("/:id", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const viewer = { id: auth.id, role: dbUser.role } as const;
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "BAD_ID", "Invalid match id");

    const match = await Match.findById(req.params.id).populate("lostItemId").populate("foundItemId").lean();
    if (!match) throw new HttpError(404, "NOT_FOUND", "Match not found");

    const lostItem: any = (match as any).lostItemId;
    const foundItem: any = (match as any).foundItemId;
    const isAdmin = dbUser.role === "ADMIN";
    const isLostOwner = String(lostItem.ownerId) === auth.id;
    const isFoundOwner = String(foundItem.ownerId) === auth.id;

    // user can view only matches involving their items
    if (!isAdmin) {
      const canSee = isLostOwner || isFoundOwner;
      if (!canSee) throw new HttpError(403, "FORBIDDEN", "Not allowed");
    }

    if (isAdmin) {
      const scores = readScores(match, lostItem, foundItem);
      return res.json({
        match: {
          id: String(match._id),
          relationship: "ADMIN",
          lostItem: serializeItem(lostItem, viewer),
          foundItem: serializeItem(foundItem, viewer),
          scores,
          confidence: confidenceLabel(scores.finalScore),
          confidenceLevel: match.confidenceLevel,
          createdAt: new Date(match.createdAt).toISOString()
        }
      });
    }

    if (isLostOwner) {
      const scores = readScores(match, lostItem, foundItem);
      return res.json({
        match: {
          id: String(match._id),
          relationship: "LOST_OWNER",
          lostItem: serializeItem(lostItem, viewer),
          foundItem: serializeItem(foundItem, viewer),
          confidenceLevel: match.confidenceLevel,
          confidence: confidenceLabel(scores.finalScore),
          shortExplanation: shortExplanationFromScores(scores),
          canClaim: true,
          createdAt: new Date(match.createdAt).toISOString()
        }
      });
    }

    return res.json({
      match: {
        id: String(match._id),
        relationship: "FOUND_REPORTER",
        foundItem: serializeItem(foundItem, viewer),
        message: "Someone may claim this item. Waiting for verification.",
        canClaim: false,
        createdAt: new Date(match.createdAt).toISOString()
      }
    });
  } catch (e) {
    next(e);
  }
});
