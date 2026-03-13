import dotenv from "dotenv";
dotenv.config();

function must(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 8080),
  APP_ORIGIN: process.env.APP_ORIGIN ?? "http://localhost:5173",
  MONGODB_URI: must("MONGODB_URI"),
  MONGODB_DB: process.env.MONGODB_DB ?? "backtoyou",
  JWT_SECRET: must("JWT_SECRET"),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
  ADMIN_LOGIN_SECRET: process.env.ADMIN_LOGIN_SECRET,
  ML_SERVICE_URL: process.env.ML_SERVICE_URL ?? "http://localhost:8090",
  HIGH_CONFIDENCE_THRESHOLD: Number(process.env.HIGH_CONFIDENCE_THRESHOLD ?? 0.9),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8080}`,
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "uploads",
  CLOUDINARY_URL: process.env.CLOUDINARY_URL,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM ?? "BackToYou <no-reply@backtoyou.local>"
};
