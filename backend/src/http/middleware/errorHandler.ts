import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../errors.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return res.status(500).json({ error: { code: "INTERNAL", message } });
}

