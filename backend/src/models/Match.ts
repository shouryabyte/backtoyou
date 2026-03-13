import mongoose, { Schema } from "mongoose";

export type ConfidenceLevel = "HIGH_CONFIDENCE" | "AMBIGUOUS";

const ScoresSchema = new Schema(
  {
    textSimilarity: { type: Number, required: true },
    categoryScore: { type: Number, required: true },
    colorScore: { type: Number, required: true },
    locationScore: { type: Number, required: true },
    dateScore: { type: Number, required: true },
    ruleScore: { type: Number, required: true },
    finalScore: { type: Number, required: true }
  },
  { _id: false }
);

export const MatchSchema = new Schema(
  {
    lostItemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    foundItemId: { type: Schema.Types.ObjectId, ref: "Item", required: true, index: true },
    textSimilarity: { type: Number, required: true },
    ruleScore: { type: Number, required: true },
    finalScore: { type: Number, required: true, index: true },
    scores: { type: ScoresSchema },
    confidence: { type: String, enum: ["High", "Medium", "Low"], default: "Low", index: true },
    confidenceLevel: { type: String, enum: ["HIGH_CONFIDENCE", "AMBIGUOUS"], required: true, index: true },
    breakdown: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MatchSchema.index({ lostItemId: 1, foundItemId: 1 }, { unique: true });

export type MatchShape = mongoose.InferSchemaType<typeof MatchSchema>;
export type MatchModel = mongoose.Model<MatchShape>;

export const Match: MatchModel = (mongoose.models.Match as MatchModel) || mongoose.model<MatchShape>("Match", MatchSchema);
