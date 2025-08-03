import { Schema, model, Document } from "mongoose";

export interface IWatchlistLog extends Document {
  watchlistId: string;       // Which watchlist this belongs to
  action: "update" | "remove" | "add" | "undo_remove" | "import" | "export" | "clear";
  itemId?: string;
  itemTitle?: string;
  itemType?: string;
  oldStatus?: string;
  newStatus?: string;
  updatedBy: string;         // Who performed the action
  updatedAt: Date;
}

const WatchlistLogSchema = new Schema<IWatchlistLog>({
  watchlistId: { type: String, required: true },
  action: { type: String, enum: ["update", "remove", "add", "undo_remove", "import", "export", "clear"], required: true },
  itemId: { type: String, required: false },
  itemTitle: { type: String, required: false },  // <-- NEW
  itemType: { type: String, required: false },   // <-- NEW
  oldStatus: String,
  newStatus: String,
  updatedBy: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
});

export const WatchlistLog = model<IWatchlistLog>("WatchlistLog", WatchlistLogSchema);
