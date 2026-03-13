import mongoose, { Schema } from "mongoose";

export const FraudLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason: { type: String, required: true, index: true },
    meta: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FraudLogSchema.index({ userId: 1, createdAt: -1 });

export type FraudLogShape = mongoose.InferSchemaType<typeof FraudLogSchema>;
export type FraudLogModel = mongoose.Model<FraudLogShape>;

export const FraudLog: FraudLogModel =
  (mongoose.models.FraudLog as FraudLogModel) || mongoose.model<FraudLogShape>("FraudLog", FraudLogSchema);
