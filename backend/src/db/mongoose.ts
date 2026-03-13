import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectMongo() {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      // Helps Windows setups where `localhost` resolves to IPv6 first and Mongo only listens on IPv4.
      ...(env.MONGODB_URI.includes("localhost") ? { family: 4 } : {})
    });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    // eslint-disable-next-line no-console
    console.error("Mongo connection failed.");
    // eslint-disable-next-line no-console
    console.error("MONGODB_URI:", env.MONGODB_URI);
    // eslint-disable-next-line no-console
    console.error("MONGODB_DB:", env.MONGODB_DB);
    // eslint-disable-next-line no-console
    console.error("Error:", msg);
    // eslint-disable-next-line no-console
    console.error(
      "If using MongoDB Atlas: ensure Network Access allows your IP (or 0.0.0.0/0 for dev) and the DB user/password are correct."
    );
    throw e;
  }
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}
