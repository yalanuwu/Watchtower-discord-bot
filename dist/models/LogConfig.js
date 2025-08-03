"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogConfig = void 0;
// src/models/LogConfig.ts
const mongoose_1 = require("mongoose");
const logConfigSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});
exports.LogConfig = (0, mongoose_1.model)("LogConfig", logConfigSchema);
