// src/commands/remove-reminder.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
} from "discord.js";
import { Reminder } from "../models/Reminder";
import { SlashCommand } from "../types/ExtendedClient";

interface ReminderDoc {
  _id: string;
  title: string;
  notifyAt: Date;
  tmdbId: number;
}

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("remove-reminder")
    .setDescription("Remove one of your active reminders."),

  async execute(interaction: ChatInputCommandInteraction) {
    const reminders = await Reminder.find({ userId: interaction.user.id }).lean<ReminderDoc[]>();

    if (reminders.length === 0) {
      await interaction.reply({ content: "📭 You don't have any active reminders.", ephemeral: true });
      return;
    }

    // Build dropdown options
    const options = reminders.slice(0, 25).map(r => ({
      label: `${r.title} (${new Date(r.notifyAt).toLocaleDateString()})`,
      value: r._id.toString(),
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("remove_reminder_select")
      .setPlaceholder("Select a reminder to remove")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      content: "Select the reminder you want to remove:",
      components: [row],
      ephemeral: true,
    });

    // Collector for selection
    const collector = interaction.channel!.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120000,
    });

    let reminderRemoved: boolean = false;

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: "❌ This menu isn't for you.", ephemeral: true });
        return;
      }

      const reminderId = i.values[0];
      await Reminder.findByIdAndDelete(reminderId);

      await i.update({ content: "✅ Reminder removed successfully.", components: [] });
      reminderRemoved = true;
      collector.stop();
    });

    collector.on("end", async () => {
      if (!reminderRemoved) {
        await interaction.editReply({ 
            content: "⏳ Reminder removal timed out.", 
            components: [] 
        });
    }
    });
  },
};

export default command;
