"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/clear-watchlist.ts
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("clear-watchlist")
        .setDescription("Clear your personal or this server's watchlist.")
        .addStringOption(option => option.setName("scope")
        .setDescription("Which watchlist to clear?")
        .setRequired(true)
        .addChoices({ name: "Personal", value: "personal" }, { name: "Server", value: "server" })),
    async execute(interaction) {
        const scope = interaction.options.getString("scope", true);
        if (scope === "personal") {
            const watchlist = await (0, watchlistUtils_1.getOrCreateUserWatchlist)(interaction.user.id);
            watchlist.items = [];
            await watchlist.save();
            // Log the action
            await WatchlistLog_1.WatchlistLog.create({
                watchlistId: watchlist._id,
                action: "clear",
                updatedBy: interaction.user.id,
                updatedAt: new Date()
            });
            if (interaction.guildId) {
                await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `🗑️ **<@${interaction.user.id}>** cleared the **${scope} watchlist**.`);
            }
            await interaction.reply({ content: "✅ Your personal watchlist has been cleared.", ephemeral: true });
        }
        else {
            if (!interaction.guild) {
                await interaction.reply({ content: "❌ This command must be used in a server.", ephemeral: true });
                return;
            }
            // Check if user has Admin or Moderator role
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasRole = member.permissions.has("Administrator") || member.roles.cache.some(role => ["admin", "administrator", "mod", "moderator"].some(r => role.name.toLowerCase().includes(r)));
            if (!hasRole) {
                await interaction.reply({ content: "❌ Only Admins or Moderators can clear the server watchlist.", ephemeral: true });
                return;
            }
            const watchlist = await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
            watchlist.items = [];
            await watchlist.save();
            // Log the action
            await WatchlistLog_1.WatchlistLog.create({
                watchlistId: watchlist._id,
                action: "clear",
                updatedBy: interaction.user.id,
                updatedAt: new Date()
            });
            if (interaction.guildId) {
                await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `🗑️ **<@${interaction.user.id}>** cleared the **${scope} watchlist**.`);
            }
            await interaction.reply({ content: "✅ Server watchlist has been cleared." });
        }
    }
};
exports.default = command;
