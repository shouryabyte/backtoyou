import mongoose, { Schema } from "mongoose";

export const MessageSchema = new Schema(
  {
    chatRoomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, required: true, maxlength: 2000 }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

MessageSchema.index({ chatRoomId: 1, createdAt: 1 });

export type MessageShape = mongoose.InferSchemaType<typeof MessageSchema>;
export type MessageModel = mongoose.Model<MessageShape>;

export const Message: MessageModel = (mongoose.models.Message as MessageModel) || mongoose.model<MessageShape>("Message", MessageSchema);

