// src/models/LogConfig.ts
import { Schema, model } from "mongoose";

const logConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true }
});

export const LogConfig = model("LogConfig", logConfigSchema);
