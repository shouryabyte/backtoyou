import { connectMongo, disconnectMongo } from "../db/mongoose.js";
import { hashPassword } from "../security/password.js";
import { User } from "../models/User.js";

type Json = Record<string, unknown> | unknown[] | null;

const BACKEND_URL = process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? "8080"}`;
const ML_URL = process.env.ML_SERVICE_URL ?? process.env.ML_URL ?? "http://localhost:8090";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin12345";
const ADMIN_LOGIN_SECRET = process.env.ADMIN_LOGIN_SECRET ?? "ADMIN2026";

function randomEmail(prefix: string) {
  const tag = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}.${tag}@example.com`;
}

async function requestJson(path: string, opts?: RequestInit & { token?: string }) {
  const headers = new Headers(opts?.headers);
  headers.set("Accept", "application/json");
  if (opts?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (opts?.token) headers.set("Authorization", `Bearer ${opts.token}`);

  const res = await fetch(`${BACKEND_URL}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = (text ? (JSON.parse(text) as Json) : null) as Json;
  if (!res.ok) {
    const msg = typeof data === "object" && data && "message" in data ? String((data as any).message) : res.statusText;
    throw new Error(`HTTP ${res.status} ${path}: ${msg}`);
  }
  return data;
}

async function requestMlHealthOptional() {
  try {
    const res = await fetch(`${ML_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json().catch(() => null);
    if (!data || (typeof data === "object" && "ok" in (data as any) && !(data as any).ok)) {
      throw new Error(`unexpected payload: ${JSON.stringify(data)}`);
    }
    // eslint-disable-next-line no-console
    console.log("ML health OK");
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.warn("ML health skipped (using backend local scorer fallback if needed):", e?.message ?? e);
  }
}

async function ensureAdmin() {
  await connectMongo();
  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (!existing) {
    await User.create({
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: "ADMIN",
      adminSingleton: true,
      name: "Admin",
      trustScore: 1,
      suspicionScore: 0,
      flags: { isBlocked: false }
    });
  } else {
    await User.updateOne(
      { _id: existing._id },
      {
        $set: { role: "ADMIN", adminSingleton: true, "flags.isBlocked": false },
        $setOnInsert: { trustScore: 1, suspicionScore: 0 }
      }
    );
  }
  await disconnectMongo();
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("Smoke starting:", { BACKEND_URL, ML_URL });

  await requestJson("/health");
  await requestMlHealthOptional();
  await ensureAdmin();

  const lostEmail = randomEmail("lost-owner");
  const finderEmail = randomEmail("finder");
  const password = "Passw0rd!123";

  const lostReg = (await requestJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: lostEmail, password, name: "Lost Owner" })
  })) as any;
  const finderReg = (await requestJson("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: finderEmail, password, name: "Finder" })
  })) as any;

  const lostToken = String(lostReg.token);
  const finderToken = String(finderReg.token);

  const privateDetails = {
    brand: "Apple",
    uniqueMarkDamage: "Small scratch near camera",
    contents: "SIM + 2 photos in case",
    idPresent: false,
    exactLocation: "Library main entrance"
  };

  const now = new Date();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const lostItemRes = (await requestJson("/api/items", {
    method: "POST",
    token: lostToken,
    body: JSON.stringify({
      type: "LOST",
      title: "Black iPhone 13",
      description: "Lost near the library around lunchtime.",
      category: "Phone",
      color: "Black",
      location: "Library",
      eventAt: yesterday.toISOString(),
      privateDetails
    })
  })) as any;

  const foundItemRes = (await requestJson("/api/items", {
    method: "POST",
    token: finderToken,
    body: JSON.stringify({
      type: "FOUND",
      title: "iPhone 13 (black)",
      description: "Found at the library entrance; looks recently dropped.",
      category: "Phone",
      color: "Black",
      location: "Library",
      eventAt: now.toISOString()
    })
  })) as any;

  const lostItemId = String(lostItemRes.item.id);
  const foundItemId = String(foundItemRes.item.id);

  await requestJson(`/api/items/${lostItemId}/match`, { method: "POST", token: lostToken });

  const matchesRes = (await requestJson(`/api/matches?itemId=${encodeURIComponent(lostItemId)}`, { token: lostToken })) as any;
  const matches = Array.isArray(matchesRes.matches) ? matchesRes.matches : [];
  const match = matches.find((m: any) => String(m?.foundItem?.id) === foundItemId) ?? matches[0];
  if (!match) throw new Error("No match candidates generated");

  const matchId = String(match.id);
  const promptsRes = (await requestJson(`/api/matches/${matchId}/claim-prompts`, { token: lostToken })) as any;
  const prompts = Array.isArray(promptsRes.prompts) ? promptsRes.prompts : [];
  if (!prompts.length) throw new Error("No verification prompts returned");

  const answers: Record<string, unknown> = {};
  for (const p of prompts) {
    const key = String(p.key);
    if (key in privateDetails) answers[key] = (privateDetails as any)[key];
  }
  // Ensure we send something even if prompts don't align with keys.
  if (!Object.keys(answers).length) Object.assign(answers, privateDetails);

  const claimRes = (await requestJson("/api/claims", {
    method: "POST",
    token: lostToken,
    body: JSON.stringify({ matchId, answers })
  })) as any;

  const claimId = String(claimRes.claim.id);

  const adminLogin = (await requestJson("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, secret: ADMIN_LOGIN_SECRET })
  })) as any;
  const adminToken = String(adminLogin.token);

  await requestJson(`/api/admin/claims/${claimId}/decision`, {
    method: "POST",
    token: adminToken,
    body: JSON.stringify({ approve: true, notes: "smoke: ok" })
  });

  const lostItemAfter = (await requestJson(`/api/items/${lostItemId}`, { token: adminToken })) as any;
  const foundItemAfter = (await requestJson(`/api/items/${foundItemId}`, { token: adminToken })) as any;

  const lostStatus = String(lostItemAfter.item.status);
  const foundStatus = String(foundItemAfter.item.status);
  if (lostStatus !== "RETURNED" || foundStatus !== "RETURNED") {
    throw new Error(`Expected RETURNED statuses, got lost=${lostStatus} found=${foundStatus}`);
  }

  // Chat created only after admin approval; both participants can access and message.
  const roomFromLost = (await requestJson(`/api/chat/start/${matchId}`, { method: "POST", token: lostToken })) as any;
  const roomFromFound = (await requestJson(`/api/chat/start/${matchId}`, { method: "POST", token: finderToken })) as any;
  if (String(roomFromLost.chatRoomId) !== String(roomFromFound.chatRoomId)) throw new Error("Chat room id mismatch between participants");

  const chatRoomId = String(roomFromLost.chatRoomId);
  await requestJson(`/api/chat/${chatRoomId}/message`, {
    method: "POST",
    token: lostToken,
    body: JSON.stringify({ content: "Hi, I got approval. When can we coordinate pickup?" })
  });
  const thread = (await requestJson(`/api/chat/${chatRoomId}`, { token: finderToken })) as any;
  const msgs = Array.isArray(thread.messages) ? thread.messages : [];
  if (!msgs.length) throw new Error("Expected chat messages after sending");

  // eslint-disable-next-line no-console
  console.log("Smoke OK:", { matchId, claimId, lostItemId, foundItemId, chatRoomId });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Smoke FAILED:", e);
  process.exit(1);
});
