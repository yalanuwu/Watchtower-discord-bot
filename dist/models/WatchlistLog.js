"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchlistLog = void 0;
const mongoose_1 = require("mongoose");
const WatchlistLogSchema = new mongoose_1.Schema({
    watchlistId: { type: String, required: true },
    action: { type: String, enum: ["update", "remove", "add", "undo_remove", "import", "export", "clear"], required: true },
    itemId: { type: String, required: false },
    itemTitle: { type: String, required: false }, // <-- NEW
    itemType: { type: String, required: false }, // <-- NEW
    oldStatus: String,
    newStatus: String,
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
});
exports.WatchlistLog = (0, mongoose_1.model)("WatchlistLog", WatchlistLogSchema);
