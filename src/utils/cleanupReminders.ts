// utils/cleanupReminders.ts
import { Reminder } from "../models/Reminder";

export async function cleanupOldReminders() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 5); // 5 days ago

  const result = await Reminder.deleteMany({
    notified: true,
    notifyAt: { $lte: cutoff }
  });

  if (result.deletedCount > 0) {
    console.log(`🧹 Cleaned up ${result.deletedCount} old reminders`);
  }
}
