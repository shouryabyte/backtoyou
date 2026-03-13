import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import { HttpError } from "../errors.js";

export type AuthUser = { id: string; role: "USER" | "ADMIN" };

export function getAuthUser(req: Request): AuthUser | null {
  // @ts-expect-error attached at runtime
  return req.user ?? null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(new HttpError(401, "UNAUTHORIZED", "Missing bearer token"));
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser;
    // @ts-expect-error attach
    req.user = { id: payload.id, role: payload.role };
    return next();
  } catch {
    return next(new HttpError(401, "UNAUTHORIZED", "Invalid token"));
  }
}

export function requireRole(role: AuthUser["role"]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const tokenUser = getAuthUser(req);
    // Prefer DB-loaded role if available (prevents stale role).
    // @ts-expect-error attach
    const dbUser = req.dbUser as { role?: AuthUser["role"]; adminSingleton?: boolean } | undefined;
    const effectiveRole = dbUser?.role ?? tokenUser?.role;
    if (!effectiveRole) return next(new HttpError(401, "UNAUTHORIZED", "Missing auth"));

    // Enforce the "single admin" invariant: admin-only routes require the primary admin record.
    if (role === "ADMIN") {
      if (!dbUser) return next(new HttpError(401, "UNAUTHORIZED", "Missing auth context"));
      if (effectiveRole !== "ADMIN") return next(new HttpError(403, "FORBIDDEN", "Insufficient role"));
      if (!dbUser.adminSingleton) return next(new HttpError(403, "FORBIDDEN", "Not the primary admin"));
      return next();
    }
    if (effectiveRole !== role) return next(new HttpError(403, "FORBIDDEN", "Insufficient role"));
    return next();
  };
}
