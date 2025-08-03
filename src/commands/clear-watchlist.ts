// src/commands/clear-watchlist.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { getOrCreateUserWatchlist, getOrCreateServerWatchlist } from "../utils/watchlistUtils";
import { WatchlistLog } from "../models/WatchlistLog";
import { SlashCommand } from "../types/ExtendedClient";
import { sendLog } from "../utils/logUtils";

const command: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("clear-watchlist")
    .setDescription("Clear your personal or this server's watchlist.")
    .addStringOption(option =>
      option.setName("scope")
        .setDescription("Which watchlist to clear?")
        .setRequired(true)
        .addChoices(
          { name: "Personal", value: "personal" },
          { name: "Server", value: "server" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const scope = interaction.options.getString("scope", true);

    if (scope === "personal") {
      const watchlist = await getOrCreateUserWatchlist(interaction.user.id);
      watchlist.items = [];
      await watchlist.save();

      // Log the action
      await WatchlistLog.create({
        watchlistId: watchlist._id,
        action: "clear",
        updatedBy: interaction.user.id,
        updatedAt: new Date()
      });

      if (interaction.guildId){
      await sendLog(
        interaction.client,
        interaction.guildId!,
        `🗑️ **<@${interaction.user.id}>** cleared the **${scope} watchlist**.`
      );}

      await interaction.reply({ content: "✅ Your personal watchlist has been cleared.", ephemeral: true });
    } else {
      if (!interaction.guild) {
        await interaction.reply({ content: "❌ This command must be used in a server.", ephemeral: true });
        return;
      }

      // Check if user has Admin or Moderator role
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const hasRole = member.permissions.has("Administrator") || member.roles.cache.some(role =>
        ["admin", "administrator", "mod", "moderator"].some(r => role.name.toLowerCase().includes(r))
      );

      if (!hasRole) {
        await interaction.reply({ content: "❌ Only Admins or Moderators can clear the server watchlist.", ephemeral: true });
        return;
      }

      const watchlist = await getOrCreateServerWatchlist(interaction.guild.id);
      watchlist.items = [];
      await watchlist.save();

      // Log the action
      await WatchlistLog.create({
        watchlistId: watchlist._id,
        action: "clear",
        updatedBy: interaction.user.id,
        updatedAt: new Date()
      });

      if (interaction.guildId){
      await sendLog(
        interaction.client,
        interaction.guildId!,
        `🗑️ **<@${interaction.user.id}>** cleared the **${scope} watchlist**.`
      );}

      await interaction.reply({ content: "✅ Server watchlist has been cleared." });
    }
  }
} as SlashCommand;

export default command;
