import { connectMongo, disconnectMongo } from "../db/mongoose.js";
import { hashPassword } from "../security/password.js";
import { User } from "../models/User.js";

async function main() {
  await connectMongo();
  const email = (process.env.ADMIN_EMAIL ?? "admin@gmail.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin12345";
  const resetPassword = process.env.RESET_ADMIN_PASSWORD === "1";
  const allowEmailChange = process.env.ALLOW_ADMIN_EMAIL_CHANGE === "1";

  const existingPrimary = await User.findOne({ adminSingleton: true }).lean();
  if (existingPrimary && existingPrimary.email !== email) {
    if (!allowEmailChange) {
      // eslint-disable-next-line no-console
      console.log("Primary admin already exists:", existingPrimary.email);
      // eslint-disable-next-line no-console
      console.log(
        "Refusing to change primary admin email. Set ALLOW_ADMIN_EMAIL_CHANGE=1 to update it to ADMIN_EMAIL (and optionally RESET_ADMIN_PASSWORD=1)."
      );
      return;
    }

    const conflict = await User.findOne({ email }).lean();
    if (conflict && String(conflict._id) !== String(existingPrimary._id)) {
      // eslint-disable-next-line no-console
      console.log("Cannot change admin email: another user already has", email);
      return;
    }

    const update: any = { $set: { email, role: "ADMIN", adminSingleton: true, "flags.isBlocked": false } };
    if (resetPassword) update.$set.passwordHash = await hashPassword(password);
    await User.updateOne({ _id: existingPrimary._id }, update);

    // eslint-disable-next-line no-console
    console.log("Primary admin updated:", { email, password: resetPassword ? password : "(unchanged)" });
    return;
  }
  const exists = await User.findOne({ email }).lean();
  if (exists) {
    const update: any = { $set: { role: "ADMIN", name: exists.name ?? "Admin", "flags.isBlocked": false } };
    update.$set.adminSingleton = true;
    if (resetPassword) update.$set.passwordHash = await hashPassword(password);
    await User.updateOne({ _id: exists._id }, update);

    // eslint-disable-next-line no-console
    console.log("Admin ensured:", { email, password: resetPassword ? password : "(unchanged)" });
    if (!resetPassword) {
      // eslint-disable-next-line no-console
      console.log('Tip: set RESET_ADMIN_PASSWORD=1 to reset the admin password to ADMIN_PASSWORD (or default "admin12345").');
    }
    return;
  }
  await User.create({ email, passwordHash: await hashPassword(password), role: "ADMIN", adminSingleton: true, name: "Admin" });
  // eslint-disable-next-line no-console
  console.log("Seeded admin:", { email, password });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectMongo();
  });
