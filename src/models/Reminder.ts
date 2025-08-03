import { Schema, model, Document } from "mongoose";

export interface IReminder extends Document {
  userId: string;
  guildId?: string;
  channelId?: string;
  tmdbId: number;
  title: string;
  releaseDate: string;
  notifyAt: Date;
  method: "dm" | "channel" | "event";
  notified: boolean;
}

const ReminderSchema = new Schema<IReminder>({
  userId: { type: String, required: true },
  guildId: String,
  channelId: String,
  tmdbId: { type: Number, required: true },
  title: { type: String, required: true },
  releaseDate: { type: String, required: true },
  notifyAt: { type: Date, required: true },
  method: { type: String, enum: ["dm", "channel", "event"], required: true },
  notified: { type: Boolean, default: false }
});

export const Reminder = model<IReminder>("Reminder", ReminderSchema);
