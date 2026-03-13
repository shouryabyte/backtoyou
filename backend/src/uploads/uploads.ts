import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import multer from "multer";
import { env } from "../config/env.js";

const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

if (env.CLOUDINARY_URL) {
  // defer cloudinary import until needed so local dev doesn't crash if deps weren't installed correctly yet
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safe}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

export function publicFileUrl(filename: string) {
  return `${env.PUBLIC_BASE_URL}/${env.UPLOAD_DIR}/${encodeURIComponent(filename)}`;
}

export async function storeImageFromUpload(file: Express.Multer.File): Promise<{ url: string; provider: "local" | "cloudinary" }> {
  if (!env.CLOUDINARY_URL) {
    return { url: publicFileUrl(file.filename), provider: "local" };
  }
  const mod = await import("cloudinary");
  const cloudinary = mod.v2;
  cloudinary.config({ cloudinary_url: env.CLOUDINARY_URL });

  const uploaded = await cloudinary.uploader.upload(file.path, { folder: "backtoyou" });
  try {
    await fsp.unlink(file.path);
  } catch {
    // ignore
  }
  return { url: uploaded.secure_url, provider: "cloudinary" };
}
