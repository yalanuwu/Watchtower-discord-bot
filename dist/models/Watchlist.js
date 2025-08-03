"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Watchlist = void 0;
const mongoose_1 = require("mongoose");
const WatchlistItemSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ["movie", "tv", "anime"], required: true },
    status: { type: String, enum: ["Planned", "Watching", "Completed"], default: "Planned" },
    addedBy: { type: String, required: true },
    tmdbId: { type: Number },
    posterPath: { type: String },
    createdAt: { type: Date, default: Date.now },
    releaseDate: { type: String }
});
const WatchlistSchema = new mongoose_1.Schema({
    ownerId: { type: String, required: true },
    isServerList: { type: Boolean, default: false },
    guildId: { type: String },
    items: [WatchlistItemSchema]
});
exports.Watchlist = (0, mongoose_1.model)("Watchlist", WatchlistSchema);
