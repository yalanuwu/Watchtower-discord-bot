"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldReminders = cleanupOldReminders;
// utils/cleanupReminders.ts
const Reminder_1 = require("../models/Reminder");
async function cleanupOldReminders() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 5); // 5 days ago
    const result = await Reminder_1.Reminder.deleteMany({
        notified: true,
        notifyAt: { $lte: cutoff }
    });
    if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old reminders`);
    }
}
