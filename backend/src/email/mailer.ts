import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export async function sendEmail(to: string, subject: string, text: string) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    // eslint-disable-next-line no-console
    console.log("[email:dev]", { to, subject, text });
    return { sent: false as const, mode: "log" as const };
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS }
  });

  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text });
  return { sent: true as const, mode: "smtp" as const };
}

