import mongoose, { Schema } from "mongoose";

export const ChatRoomSchema = new Schema(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true, unique: true, index: true },
    lostUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    foundUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ChatRoomSchema.index({ lostUserId: 1, createdAt: -1 });
ChatRoomSchema.index({ foundUserId: 1, createdAt: -1 });

export type ChatRoomShape = mongoose.InferSchemaType<typeof ChatRoomSchema>;
export type ChatRoomModel = mongoose.Model<ChatRoomShape>;

export const ChatRoom: ChatRoomModel =
  (mongoose.models.ChatRoom as ChatRoomModel) || mongoose.model<ChatRoomShape>("ChatRoom", ChatRoomSchema);

