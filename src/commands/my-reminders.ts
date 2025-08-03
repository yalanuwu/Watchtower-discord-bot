// src/commands/my-reminders.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from "discord.js";
import { SlashCommand } from "../types/ExtendedClient";
import { Reminder } from "../models/Reminder";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("my-reminders")
    .setDescription("View your upcoming reminders."),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    // Fetch reminders for this user
    const reminders = await Reminder.find({ userId: interaction.user.id }).sort({ releaseDate: 1 });

    if (!reminders.length) {
      await interaction.editReply("📭 You don’t have any reminders set.");
      return;
    }

    let currentPage = 0;
    const pageSize = 5;
    const totalPages = Math.ceil(reminders.length / pageSize);

    const generateEmbed = (page: number) => {
      const start = page * pageSize;
      const pageReminders = reminders.slice(start, start + pageSize);

      const embed = new EmbedBuilder()
        .setTitle("Your Reminders")
        .setColor("Blue")
        .setFooter({ text: `Page ${page + 1} of ${totalPages}` });

      pageReminders.forEach(rem => {
        embed.addFields({
          name: rem.title,
          value: `**Releases:** ${new Date(rem.releaseDate).toDateString()}\n**Channel/Event:** ${rem.method}`,
        });
      });

      return embed;
    };

    const generateButtons = (page: number) =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("prev").setLabel("◀️ Prev").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId("next").setLabel("Next ▶️").setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
      );

    let message = await interaction.editReply({
      embeds: [generateEmbed(currentPage)],
      components: [generateButtons(currentPage)]
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000
    });

    collector.on("collect", async btn => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: "This isn’t your reminder list!", ephemeral: true });
        return;
      }

      if (btn.customId === "prev") currentPage = Math.max(currentPage - 1, 0);
      if (btn.customId === "next") currentPage = Math.min(currentPage + 1, totalPages - 1);

      await btn.update({
        embeds: [generateEmbed(currentPage)],
        components: [generateButtons(currentPage)]
      });
    });

    collector.on("end", async () => {
      await interaction.editReply({
        embeds: [generateEmbed(currentPage)],
        components: [] // disable buttons
      });
    });
  }
};

export default command;
