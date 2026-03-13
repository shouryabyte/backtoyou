import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.js";
import { getAuthUser } from "./auth.js";
import { User } from "../../models/User.js";

export type DbUser = {
  id: string;
  role: "USER" | "ADMIN";
  email: string;
  adminSingleton?: boolean;
  trustScore?: number;
  suspicionScore?: number;
  flags?: { isBlocked?: boolean };
};

declare global {
  // eslint-disable-next-line no-var
  var __btyDbUser: DbUser | undefined;
}

export function getDbUser(req: Request): DbUser | null {
  // @ts-expect-error attached at runtime
  return req.dbUser ?? null;
}

export async function loadUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const auth = getAuthUser(req);
    if (!auth) return next(new HttpError(401, "UNAUTHORIZED", "Missing auth"));

    const user = await User.findById(auth.id).lean();
    if (!user) return next(new HttpError(401, "UNAUTHORIZED", "Unknown user"));
    if (user.flags?.isBlocked) return next(new HttpError(403, "BLOCKED", "User is blocked"));

    // @ts-expect-error attach
    req.dbUser = {
      id: String(user._id),
      role: user.role,
      email: user.email,
      adminSingleton: Boolean((user as any).adminSingleton),
      trustScore: user.trustScore,
      suspicionScore: user.suspicionScore,
      flags: user.flags
    } satisfies DbUser;

    return next();
  } catch (e) {
    return next(e);
  }
}
