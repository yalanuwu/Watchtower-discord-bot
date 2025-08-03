"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/logs.ts
const discord_js_1 = require("discord.js");
const WatchlistLog_1 = require("../models/WatchlistLog");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("logs")
        .setDescription("View the change logs for your or the server's watchlist.")
        .addStringOption(option => option.setName("scope")
        .setDescription("Personal or server watchlist")
        .setRequired(true)
        .addChoices({ name: "Personal", value: "user" }, { name: "Server", value: "server" })),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const scope = interaction.options.get("scope")?.value;
        try {
            // Permissions check for server logs
            if (scope === "server") {
                if (!interaction.guild) {
                    await interaction.editReply("❌ Server logs can only be accessed in a server.");
                    return;
                }
                const member = interaction.member;
                const hasModeratorPerms = member.permissions.has(discord_js_1.PermissionFlagsBits.Administrator) ||
                    member.permissions.has(discord_js_1.PermissionFlagsBits.ManageGuild) ||
                    member.permissions.has(discord_js_1.PermissionFlagsBits.ManageMessages);
                if (!hasModeratorPerms) {
                    await interaction.editReply("❌ You don't have permission to view server logs. (Requires Admin or Moderator role)");
                    return;
                }
            }
            // Get watchlist
            let watchlist;
            if (scope === "user") {
                watchlist = await (0, watchlistUtils_1.getOrCreateUserWatchlist)(interaction.user.id);
            }
            else {
                watchlist = await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
            }
            // Fetch logs
            const logs = await WatchlistLog_1.WatchlistLog.find({ watchlistId: watchlist._id })
                .sort({ updatedAt: -1 })
                .limit(10)
                .populate("itemId");
            if (!logs.length) {
                await interaction.editReply(`📭 No logs found for ${scope === "user" ? "your" : "this server's"} watchlist.`);
                return;
            }
            // Build embed
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`${scope === "user" ? "Your" : "Server"} Watchlist Logs`)
                .setColor(0x00AE86)
                .setTimestamp();
            for (const log of logs) {
                // const item = typeof log.itemId === "object" && log.itemId !== null ? (log.itemId as any) : { title: "Unknown Item" };
                let logDesc = `By: <@${log.updatedBy}> on ${new Date(log.updatedAt).toLocaleString()}`;
                if (log.action === 'update') {
                    logDesc += `\nStatus: ${log.oldStatus} → ${log.newStatus}`;
                }
                embed.addFields({
                    name: `${log.action.toUpperCase()} - ${log.itemTitle || "Unknown Item"}`,
                    value: logDesc,
                });
            }
            await interaction.editReply({ embeds: [embed] });
        }
        catch (err) {
            console.error(err);
            await interaction.editReply("⚠️ Something went wrong while fetching logs.");
        }
    },
};
exports.default = command;
