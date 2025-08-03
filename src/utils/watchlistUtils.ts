import { Watchlist } from "../models/Watchlist";

export const getOrCreateUserWatchlist = async (userId: string) => {
  return await Watchlist.findOneAndUpdate(
    { ownerId: userId, isServerList: false },
    { $setOnInsert: { items: [] } },
    { new: true, upsert: true }
  );
};

export const getOrCreateServerWatchlist = async (guildId: string) => {
  return await Watchlist.findOneAndUpdate(
    { ownerId: guildId, isServerList: true },
    { $setOnInsert: { guildId, items: [] } },
    { new: true, upsert: true }
  );
};
