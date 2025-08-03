"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reminder = void 0;
const mongoose_1 = require("mongoose");
const ReminderSchema = new mongoose_1.Schema({
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
exports.Reminder = (0, mongoose_1.model)("Reminder", ReminderSchema);
