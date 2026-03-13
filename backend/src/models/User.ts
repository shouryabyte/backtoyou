import mongoose, { Schema } from "mongoose";

export type UserRole = "USER" | "ADMIN";

export type UserDoc = mongoose.InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

const FlagsSchema = new Schema(
  {
    isBlocked: { type: Boolean, default: false }
  },
  { _id: false }
);

export const UserSchema = new Schema(
  {
    role: { type: String, enum: ["USER", "ADMIN"], default: "USER", index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    // Enforces a single admin account in the system (unique partial index below).
    adminSingleton: { type: Boolean, default: false },
    trustScore: { type: Number, default: 0.5, min: 0, max: 1 },
    suspicionScore: { type: Number, default: 0, min: 0 },
    flags: { type: FlagsSchema, default: () => ({}) }
  },
  { timestamps: true }
);

UserSchema.index({ suspicionScore: -1, trustScore: 1 });
UserSchema.index({ adminSingleton: 1 }, { unique: true, partialFilterExpression: { adminSingleton: true } });

export type UserShape = mongoose.InferSchemaType<typeof UserSchema>;
export type UserModel = mongoose.Model<UserShape>;

export const User: UserModel = (mongoose.models.User as UserModel) || mongoose.model<UserShape>("User", UserSchema);
