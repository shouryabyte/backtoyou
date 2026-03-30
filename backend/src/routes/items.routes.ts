import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, getAuthUser } from "../http/middleware/auth.js";
import { getDbUser, loadUser } from "../http/middleware/loadUser.js";
import { HttpError } from "../http/errors.js";
import { generateMatchesForItem } from "../matching/matcher.js";
import { Item } from "../models/Item.js";
import { serializeItem } from "../serializers/item.js";

export const itemsRouter = Router();

itemsRouter.post("/", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const viewer = { id: auth.id, role: dbUser.role } as const;

    const body = z
      .object({
        type: z.enum(["LOST", "FOUND"]),
        title: z.string().trim().min(3),
        description: z.string().trim().min(1),
        category: z.string().trim().min(2),
        color: z.string().optional(),
        location: z.string().trim().min(2),
        eventAt: z.string().datetime(),
        publicDetails: z.record(z.string(), z.any()).optional(),
        privateDetails: z
          .object({
            brand: z.string().trim().min(1),
            uniqueMark: z.string().trim().min(1),
            contents: z.string().trim().min(1)
          })
          .strict()
      })
      .parse(req.body);

    const item = await Item.create({
      ownerId: auth.id,
      type: body.type,
      title: body.title,
      description: body.description,
      category: body.category,
      color: body.color ?? "",
      location: body.location,
      eventAt: new Date(body.eventAt),
      publicDetails: body.publicDetails ?? {},
      privateDetails: body.privateDetails,
      images: []
    });

    let matchResult: any = null;
    try {
      matchResult = await generateMatchesForItem(String(item._id));
    } catch (e: any) {
      // If matching is temporarily unavailable (e.g., ML service down), still accept the report.
      // Clients can manually trigger matching later via POST /api/items/:id/match.
      matchResult = { created: 0, error: e?.code ?? "MATCHING_UNAVAILABLE" };
    }
    res.status(201).json({ item: serializeItem(item.toObject(), viewer), matchResult });
  } catch (e) {
    next(e);
  }
});

itemsRouter.get("/", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const viewer = { id: auth.id, role: dbUser.role } as const;
    const mine = req.query.mine === "1";
    const filter = mine ? { ownerId: auth.id } : dbUser.role === "ADMIN" ? {} : { ownerId: auth.id };
    const items = await Item.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ items: items.map((it) => serializeItem(it, viewer)) });
  } catch (e) {
    next(e);
  }
});

itemsRouter.get("/:id", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const viewer = { id: auth.id, role: dbUser.role } as const;
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "BAD_ID", "Invalid item id");
    const item = await Item.findById(req.params.id).lean();
    if (!item) throw new HttpError(404, "NOT_FOUND", "Item not found");
    if (dbUser.role !== "ADMIN" && String(item.ownerId) !== dbUser.id) throw new HttpError(403, "FORBIDDEN", "Not allowed");
    return res.json({ item: serializeItem(item, viewer) });
  } catch (e) {
    next(e);
  }
});

itemsRouter.post("/:id/match", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "BAD_ID", "Invalid item id");
    const item = await Item.findById(req.params.id).lean();
    if (!item) throw new HttpError(404, "NOT_FOUND", "Item not found");
    if (String(item.ownerId) !== auth.id && dbUser.role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Not allowed");
    const matchResult = await generateMatchesForItem(String(item._id));
    res.json({ matchResult });
  } catch (e) {
    next(e);
  }
});
