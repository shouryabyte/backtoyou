import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export function signToken(payload: { id: string; role: "USER" | "ADMIN" }) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] });
}
