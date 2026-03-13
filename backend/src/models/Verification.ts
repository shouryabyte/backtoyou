import mongoose, { Schema } from "mongoose";

export const VerificationSchema = new Schema(
  {
    claimId: { type: Schema.Types.ObjectId, ref: "Claim", required: true, index: true },
    attemptNo: { type: Number, default: 1 },
    answers: { type: Schema.Types.Mixed, default: {} },
    kRequired: { type: Number, required: true },
    nTotal: { type: Number, required: true },
    verifiedCount: { type: Number, required: true },
    passes: { type: Boolean, required: true },
    breakdown: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

VerificationSchema.index({ claimId: 1, attemptNo: -1 });

export type VerificationShape = mongoose.InferSchemaType<typeof VerificationSchema>;
export type VerificationModel = mongoose.Model<VerificationShape>;

export const Verification: VerificationModel =
  (mongoose.models.Verification as VerificationModel) || mongoose.model<VerificationShape>("Verification", VerificationSchema);
