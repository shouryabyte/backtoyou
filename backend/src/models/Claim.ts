import mongoose, { Schema } from "mongoose";

export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED";

export const ClaimSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true, index: true },
    claimantId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["PENDING", "APPROVED", "REJECTED"], default: "PENDING", index: true },
    adminId: { type: Schema.Types.ObjectId, ref: "User" },
    decisionNotes: { type: String },
    decidedAt: { type: Date }
  },
  { timestamps: true }
);

ClaimSchema.index({ claimantId: 1, createdAt: -1 });

export type ClaimShape = mongoose.InferSchemaType<typeof ClaimSchema>;
export type ClaimModel = mongoose.Model<ClaimShape>;

export const Claim: ClaimModel = (mongoose.models.Claim as ClaimModel) || mongoose.model<ClaimShape>("Claim", ClaimSchema);
