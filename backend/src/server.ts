import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./http/middleware/errorHandler.js";
import { connectMongo, disconnectMongo } from "./db/mongoose.js";
import { authRouter } from "./routes/auth.routes.js";
import { itemsRouter } from "./routes/items.routes.js";
import { matchesRouter } from "./routes/matches.routes.js";
import { claimsRouter } from "./routes/claims.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { uploadsRouter } from "./routes/uploads.routes.js";
import { chatRouter } from "./routes/chat.routes.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.APP_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false
  })
);

app.use(`/${env.UPLOAD_DIR}`, express.static(path.resolve(process.cwd(), env.UPLOAD_DIR)));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/items", itemsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/claims", claimsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/chat", chatRouter);

app.use(errorHandler);

async function main() {
  await connectMongo();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${env.PORT}`);
  });

  async function shutdown() {
    server.close(() => {});
    await disconnectMongo();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
