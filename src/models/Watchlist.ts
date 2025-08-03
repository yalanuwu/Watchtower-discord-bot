import { Schema, model, Document } from "mongoose";
import { Types } from "mongoose";

export interface IWatchlistItem {
  _id?: Types.ObjectId;
  title: string;
  type: "movie" | "tv" | "anime";
  status: "Planned" | "Watching" | "Completed";
  addedBy: string;       // Discord user ID of the person who added it
  tmdbId?: number;       // For fetching extra details from TMDB
  posterPath?: string;   // Poster URL (from TMDB)
  createdAt?: Date;
  releaseDate?: string; 
}

export interface IWatchlist extends Document {
  ownerId: string;       // Either a User ID (for personal lists) or Guild ID (for server lists)
  isServerList: boolean; // false = personal watchlist, true = server watchlist
  guildId?: string;      // Only used for server lists
  items: IWatchlistItem[];
}

const WatchlistItemSchema = new Schema<IWatchlistItem>({
  title: { type: String, required: true },
  type: { type: String, enum: ["movie", "tv", "anime"], required: true },
  status: { type: String, enum: ["Planned", "Watching", "Completed"], default: "Planned" },
  addedBy: { type: String, required: true },
  tmdbId: { type: Number },
  posterPath: { type: String },
  createdAt: { type: Date, default: Date.now },
  releaseDate: { type: String } 
});

const WatchlistSchema = new Schema<IWatchlist>({
  ownerId: { type: String, required: true },
  isServerList: { type: Boolean, default: false },
  guildId: { type: String },
  items: [WatchlistItemSchema]
});

export const Watchlist = model<IWatchlist>("Watchlist", WatchlistSchema);
