import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../http/errors.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { signToken } from "../security/jwt.js";
import { requireAuth, getAuthUser } from "../http/middleware/auth.js";
import { getDbUser, loadUser } from "../http/middleware/loadUser.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1).optional()
      })
      .parse(req.body);

    const email = body.email.trim().toLowerCase();
    const exists = await User.findOne({ email }).lean();
    if (exists) throw new HttpError(409, "EMAIL_TAKEN", "Email already registered");

    const user = await User.create({ email, passwordHash: await hashPassword(body.password), name: body.name, role: "USER" });

    const token = signToken({ id: String(user._id), role: user.role });
    res.json({ token, user: { id: String(user._id), email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const email = body.email.trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    if (user.role === "ADMIN") throw new HttpError(403, "ADMIN_LOGIN_REQUIRED", "Use the admin login page");
    if (user.flags?.isBlocked) throw new HttpError(403, "BLOCKED", "User is blocked");
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    const token = signToken({ id: String(user._id), role: user.role });
    res.json({ token, user: { id: String(user._id), email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/admin/login", async (req, res, next) => {
  try {
    if (!env.ADMIN_LOGIN_SECRET) throw new HttpError(501, "ADMIN_SECRET_MISSING", "Admin login secret is not configured");
    const body = z.object({ email: z.string().email(), password: z.string().min(1), secret: z.string().min(1) }).parse(req.body);
    if (body.secret !== env.ADMIN_LOGIN_SECRET) throw new HttpError(403, "FORBIDDEN", "Invalid admin secret");
    const email = body.email.trim().toLowerCase();
    const user = await User.findOne({ email });
    if (!user) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    if (user.role !== "ADMIN") throw new HttpError(403, "FORBIDDEN", "Not an admin account");
    if (!(user as any).adminSingleton) throw new HttpError(403, "FORBIDDEN", "Not the primary admin");
    if (user.flags?.isBlocked) throw new HttpError(403, "BLOCKED", "User is blocked");
    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    const token = signToken({ id: String(user._id), role: user.role });
    res.json({ token, user: { id: String(user._id), email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", requireAuth, loadUser, async (req, res, next) => {
  try {
    const auth = getAuthUser(req);
    if (!auth) throw new HttpError(401, "UNAUTHORIZED", "Missing auth");
    const dbUser = getDbUser(req);
    if (!dbUser) throw new HttpError(401, "UNAUTHORIZED", "Unknown user");
    const user = await User.findById(auth.id).lean();
    if (!user) throw new HttpError(401, "UNAUTHORIZED", "Unknown user");
    res.json({
      user: {
        id: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
        trustScore: user.trustScore,
        suspicionScore: user.suspicionScore,
        flags: user.flags
      }
    });
  } catch (e) {
    next(e);
  }
});
