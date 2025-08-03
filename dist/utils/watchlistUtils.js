"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateServerWatchlist = exports.getOrCreateUserWatchlist = void 0;
const Watchlist_1 = require("../models/Watchlist");
const getOrCreateUserWatchlist = async (userId) => {
    return await Watchlist_1.Watchlist.findOneAndUpdate({ ownerId: userId, isServerList: false }, { $setOnInsert: { items: [] } }, { new: true, upsert: true });
};
exports.getOrCreateUserWatchlist = getOrCreateUserWatchlist;
const getOrCreateServerWatchlist = async (guildId) => {
    return await Watchlist_1.Watchlist.findOneAndUpdate({ ownerId: guildId, isServerList: true }, { $setOnInsert: { guildId, items: [] } }, { new: true, upsert: true });
};
exports.getOrCreateServerWatchlist = getOrCreateServerWatchlist;
