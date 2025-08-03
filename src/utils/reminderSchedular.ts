import {
  TextChannel,
  DMChannel,
  NewsChannel,
  EmbedBuilder,
} from "discord.js";
import { Reminder } from "../models/Reminder";

const GRACE_PERIOD_HOURS = 48; // Don't notify if it's older than this

export async function processReminders(client: any) {
  const now = new Date();
  const graceDate = new Date(now.getTime() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);

  const reminders = await Reminder.find({
    notifyAt: { $lte: now, $gte: graceDate },
    notified: false,
  });

  // console.log("Inside reminderSchedular log");

  if (reminders.length > 0) {
    console.log(`🔔 Found ${reminders.length} due reminders. Processing...`);
  }

  for (const reminder of reminders) {
    try {
      const embed = new EmbedBuilder()
        .setTitle("🎬 Reminder!")
        .setDescription(
          `**${reminder.title}** releases on **${new Date(reminder.releaseDate).toDateString()}**`
        )
        .setColor("Blue");

      if (reminder.method === "dm") {
        const user = await client.users.fetch(reminder.userId);
        await user.send({ embeds: [embed] });
      } else if (reminder.method === "channel" && reminder.channelId) {
        const channel = await client.channels.fetch(reminder.channelId);

        // Type narrowing: only send if channel supports send()
        if (channel && (channel instanceof TextChannel || channel instanceof DMChannel || channel instanceof NewsChannel)) {
          await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] });
        }
      }

      reminder.notified = true;
      await reminder.save();
      console.log(`✅ Processed reminder: ${reminder.title} (${reminder._id})`);
    } catch (err) {
      console.error(`Failed to process reminder ${reminder._id}:`, err);
    }
  }
}
