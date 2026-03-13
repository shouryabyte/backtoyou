import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, getAuthUser, requireRole } from "../http/middleware/auth.js";
import { getDbUser, loadUser } from "../http/middleware/loadUser.js";
import { HttpError } from "../http/errors.js";
import { ChatRoom } from "../models/ChatRoom.js";
import { Message } from "../models/Message.js";
import { Match } from "../models/Match.js";
import { Claim } from "../models/Claim.js";
import { Item } from "../models/Item.js";

export const chatRouter = Router();

function canAccessRoom(dbUser: any, room: any) {
  if (dbUser.role === "ADMIN") return true;
  return String(room.lostUserId) === dbUser.id || String(room.foundUserId) === dbUser.id;
}

function canSend(dbUser: any, room: any) {
  // Only participants can message. Admin can view for moderation.
  return String(room.lostUserId) === dbUser.id || String(room.foundUserId) === dbUser.id;
}

async function ensureApprovedMatch(matchId: string) {
  const approved = await Claim.findOne({ matchId, status: "APPROVED" }).lean();
  if (!approved) throw new HttpError(409, "NOT_APPROVED", "Chat is available only after admin approval");
}

async function resolveParticipants(matchId: string) {
  const match = await Match.findById(matchId).lean();
  if (!match) throw new HttpError(404, "NOT_FOUND", "Match not found");

  const [lostItem, foundItem] = await Promise.all([Item.findById(match.lostItemId).lean(), Item.findById(match.foundItemId).lean()]);
  if (!lostItem || !foundItem) throw new HttpError(404, "NOT_FOUND", "Match items not found");
  return { lostUserId: String(lostItem.ownerId), foundUserId: String(foundItem.ownerId) };
}

// Create or return the room for an approved match.
chatRouter.post("/start/:matchId", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");

    const matchId = req.params.matchId;
    if (!mongoose.isValidObjectId(matchId)) throw new HttpError(400, "BAD_ID", "Invalid match id");

    await ensureApprovedMatch(matchId);
    const { lostUserId, foundUserId } = await resolveParticipants(matchId);

    if (dbUser.role !== "ADMIN" && dbUser.id !== lostUserId && dbUser.id !== foundUserId) {
      throw new HttpError(403, "FORBIDDEN", "Not allowed");
    }

    const room = await ChatRoom.findOneAndUpdate(
      { matchId },
      { $setOnInsert: { matchId, lostUserId, foundUserId } },
      { new: true, upsert: true }
    );

    res.json({ chatRoomId: String(room._id) });
  } catch (e) {
    next(e);
  }
});

// List chat rooms for current user (admin sees all).
chatRouter.get("/mine", requireAuth, loadUser, async (req, res, next) => {
  try {
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");

    const filter =
      dbUser.role === "ADMIN"
        ? {}
        : {
            $or: [{ lostUserId: dbUser.id }, { foundUserId: dbUser.id }]
          };

    const rooms = await ChatRoom.find(filter).sort({ createdAt: -1 }).limit(50).lean();

    const matchIds = rooms.map((r: any) => r.matchId).filter(Boolean);
    const matches = await Match.find({ _id: { $in: matchIds } })
      .populate("lostItemId", "title")
      .populate("foundItemId", "title")
      .lean();
    const matchById = new Map(matches.map((m: any) => [String(m._id), m]));

    res.json({
      chatRooms: rooms.map((r: any) => ({
        id: String(r._id),
        matchId: String(r.matchId),
        match: (() => {
          const m: any = matchById.get(String(r.matchId));
          return m
            ? {
                id: String(m._id),
                lostItemTitle: m.lostItemId?.title ?? null,
                foundItemTitle: m.foundItemId?.title ?? null
              }
            : null;
        })(),
        lostUserId: String(r.lostUserId),
        foundUserId: String(r.foundUserId),
        createdAt: new Date(r.createdAt).toISOString()
      }))
    });
  } catch (e) {
    next(e);
  }
});

// Admin moderation: view any chat by matchId (helper).
// NOTE: Must be declared before "/:chatRoomId" to avoid route shadowing.
chatRouter.get("/admin/by-match/:matchId", requireAuth, loadUser, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const matchId = req.params.matchId;
    if (!mongoose.isValidObjectId(matchId)) throw new HttpError(400, "BAD_ID", "Invalid match id");
    const room = await ChatRoom.findOne({ matchId }).lean();
    if (!room) throw new HttpError(404, "NOT_FOUND", "Chat room not found");
    res.json({ chatRoomId: String(room._id) });
  } catch (e) {
    next(e);
  }
});

// Get room + latest messages.
chatRouter.get("/:chatRoomId", requireAuth, loadUser, async (req, res, next) => {
  try {
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");

    const chatRoomId = req.params.chatRoomId;
    if (!mongoose.isValidObjectId(chatRoomId)) throw new HttpError(400, "BAD_ID", "Invalid chat room id");

    const room = await ChatRoom.findById(chatRoomId).lean();
    if (!room) throw new HttpError(404, "NOT_FOUND", "Chat room not found");
    if (!canAccessRoom(dbUser, room)) throw new HttpError(403, "FORBIDDEN", "Not allowed");

    const messages = await Message.find({ chatRoomId: room._id }).sort({ createdAt: 1 }).limit(200).lean();
    res.json({
      chatRoom: {
        id: String(room._id),
        matchId: String(room.matchId),
        lostUserId: String(room.lostUserId),
        foundUserId: String(room.foundUserId),
        createdAt: new Date(room.createdAt).toISOString()
      },
      messages: messages.map((m: any) => ({
        id: String(m._id),
        senderId: String(m.senderId),
        content: m.content,
        timestamp: new Date(m.createdAt).toISOString()
      }))
    });
  } catch (e) {
    next(e);
  }
});

// Send a message (participants only).
chatRouter.post("/:chatRoomId/message", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");

    const chatRoomId = req.params.chatRoomId;
    if (!mongoose.isValidObjectId(chatRoomId)) throw new HttpError(400, "BAD_ID", "Invalid chat room id");

    const body = z.object({ content: z.string().min(1).max(2000) }).parse(req.body);

    const room = await ChatRoom.findById(chatRoomId).lean();
    if (!room) throw new HttpError(404, "NOT_FOUND", "Chat room not found");
    if (!canAccessRoom(dbUser, room)) throw new HttpError(403, "FORBIDDEN", "Not allowed");
    if (!canSend(dbUser, room)) throw new HttpError(403, "FORBIDDEN", "Only participants can send messages");

    await ensureApprovedMatch(String(room.matchId));

    const msg = await Message.create({ chatRoomId: room._id, senderId: auth.id, content: body.content });
    res.status(201).json({
      message: { id: String(msg._id), senderId: auth.id, content: msg.content, timestamp: msg.createdAt.toISOString() }
    });
  } catch (e) {
    next(e);
  }
});
