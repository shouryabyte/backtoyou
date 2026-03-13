import mongoose, { Schema } from "mongoose";

export type ItemType = "LOST" | "FOUND";
export type ItemStatus = "ACTIVE" | "RETURNED" | "ARCHIVED";

const ImageSchema = new Schema(
  {
    url: { type: String, required: true },
    provider: { type: String, enum: ["local", "cloudinary"], default: "local" }
  },
  { _id: false }
);

export const ItemSchema = new Schema(
  {
    type: { type: String, enum: ["LOST", "FOUND"], required: true, index: true },
    status: { type: String, enum: ["ACTIVE", "RETURNED", "ARCHIVED"], default: "ACTIVE", index: true },
    title: { type: String, required: true, index: "text" },
    description: { type: String, default: "" },
    category: { type: String, required: true, index: true },
    color: { type: String, default: "" },
    location: { type: String, default: "", index: true },
    eventAt: { type: Date, required: true, index: true },
    images: { type: [ImageSchema], default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    publicDetails: { type: Schema.Types.Mixed, default: {} },
    privateDetails: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

ItemSchema.index({ type: 1, status: 1, createdAt: -1 });

export type ItemShape = mongoose.InferSchemaType<typeof ItemSchema>;
export type ItemModel = mongoose.Model<ItemShape>;

export const Item: ItemModel = (mongoose.models.Item as ItemModel) || mongoose.model<ItemShape>("Item", ItemSchema);
