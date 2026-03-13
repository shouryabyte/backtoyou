import { Router } from "express";
import { requireAuth, getAuthUser } from "../http/middleware/auth.js";
import { getDbUser, loadUser } from "../http/middleware/loadUser.js";
import { HttpError } from "../http/errors.js";
import { upload, storeImageFromUpload } from "../uploads/uploads.js";
import { Item } from "../models/Item.js";
import mongoose from "mongoose";

export const uploadsRouter = Router();

uploadsRouter.post("/items/:id/images", requireAuth, loadUser, upload.single("image"), async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, "BAD_ID", "Invalid item id");
    const item = await Item.findById(req.params.id);
    if (!item) throw new HttpError(404, "NOT_FOUND", "Item not found");
    if (String(item.ownerId) !== auth.id && dbUser.role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Not allowed");
    if (!req.file) throw new HttpError(400, "NO_FILE", "No file uploaded");

    const stored = await storeImageFromUpload(req.file);
    item.images.push({ url: stored.url, provider: stored.provider });
    await item.save();
    res.status(201).json({ url: stored.url, provider: stored.provider });
  } catch (e) {
    next(e);
  }
});
