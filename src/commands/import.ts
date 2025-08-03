import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { SlashCommand } from "../types/ExtendedClient";
import { getOrCreateUserWatchlist, getOrCreateServerWatchlist } from "../utils/watchlistUtils";
import { WatchlistLog } from "../models/WatchlistLog";
import { sendLog } from "../utils/logUtils";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("import")
    .setDescription("Import items into your or the server's watchlist from a JSON file.")
    .addStringOption(option =>
      option.setName("scope")
        .setDescription("Personal or server watchlist")
        .setRequired(true)
        .addChoices(
          { name: "Personal", value: "user" },
          { name: "Server", value: "server" },
        )
    )
    .addAttachmentOption(option =>
      option.setName("file")
        .setDescription("JSON file exported using /export")
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    const scope = interaction.options.getString("scope", true) as "user" | "server";
    const file = interaction.options.getAttachment("file", true);

    if (!file.contentType?.includes("application/json")) {
      return interaction.editReply("❌ Please upload a valid JSON file exported using /export.");
    }

    try {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error("Failed to fetch file.");
      const jsonText = await response.text();

      let data;
      try {
        data = JSON.parse(jsonText);
      } catch {
        return interaction.editReply("❌ Invalid JSON format in file.");
      }

      const isValidExportItem = (item: any): boolean =>
        typeof item.title === "string" &&
        typeof item.tmdbId === "number" &&
        typeof item.type === "string" &&
        typeof item.status === "string";

      if (!Array.isArray(data) || !data.every(isValidExportItem)) {
        return interaction.editReply("❌ Please upload a valid JSON file exported using /export.");
      }

      let watchlist;
      if (scope === "user") {
        watchlist = await getOrCreateUserWatchlist(interaction.user.id);
      } else {
        if (!interaction.guild) return interaction.editReply("❌ Server watchlist can only be used in a server.");
        watchlist = await getOrCreateServerWatchlist(interaction.guild.id);
      }

      const existingIds = new Set(watchlist.items.map((i: any) => i.tmdbId));
      const newItems = data
        .filter((i: any) => !existingIds.has(i.tmdbId))
        .map((i: any) => ({
          ...i,
          addedBy: interaction.user.id, // Required field
          addedAt: new Date(),         // Ensure it exists
        }));

      if (!newItems.length) {
        return interaction.editReply("📭 No new items to import (all are duplicates).");
      }

      watchlist.items.push(...newItems);
      await watchlist.save();

      await WatchlistLog.create({
        watchlistId: watchlist._id,
        action: "import",
        itemTitle: `Imported ${newItems.length} items`,
        itemType: 'multiple',
        updatedBy: interaction.user.id,
        updatedAt: new Date(),
        details: { count: newItems.length }
      });

      if (interaction.guildId){
      await sendLog(
        interaction.client,
        interaction.guildId!,
        `📩 **<@${interaction.user.id}>** imported in the **${scope}'s watchlist**.`
      );}

      await interaction.editReply(`✅ Successfully imported **${newItems.length}** new item(s) into the ${scope} watchlist.`);

    } catch (error) {
      console.error(error);
      await interaction.editReply("⚠️ Failed to import watchlist. Make sure the file is a valid JSON export.");
    }
  }
};

export default command;
