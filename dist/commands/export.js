"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/export.ts
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("export")
        .setDescription("Export your or the server's watchlist as a JSON file.")
        .addStringOption(option => option.setName("scope")
        .setDescription("Personal or server watchlist")
        .setRequired(true)
        .addChoices({ name: "Personal", value: "user" }, { name: "Server", value: "server" })),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const scope = interaction.options.get("scope")?.value;
        try {
            // Fetch watchlist
            let watchlist;
            if (scope === "user") {
                watchlist = await (0, watchlistUtils_1.getOrCreateUserWatchlist)(interaction.user.id);
            }
            else {
                if (!interaction.guild) {
                    await interaction.editReply("❌ Server watchlist can only be exported in a server.");
                    return;
                }
                watchlist = await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
            }
            if (!watchlist.items.length) {
                await interaction.editReply(`📭 No items found in ${scope === "user" ? "your" : "this server's"} watchlist.`);
                return;
            }
            // Prepare clean data
            const exportData = watchlist.items.map((item) => ({
                title: item.title,
                tmdbId: item.tmdbId,
                type: item.type,
                status: item.status,
                releaseDate: item.releaseDate,
                posterPath: item.posterPath
            }));
            const jsonBuffer = Buffer.from(JSON.stringify(exportData, null, 2), "utf-8");
            const timestamp = new Date().toISOString().split("T")[0];
            const fileName = `watchlist_${scope}_${timestamp}.json`;
            const attachment = new discord_js_1.AttachmentBuilder(jsonBuffer, { name: fileName });
            await interaction.editReply({
                content: `📤 Here is the exported ${scope === "user" ? "personal" : "server"} watchlist.`,
                files: [attachment]
            });
            // **Log the export action**
            await WatchlistLog_1.WatchlistLog.create({
                watchlistId: watchlist._id,
                action: "export",
                itemTitle: `Exported ${watchlist.items.length} items`,
                itemType: "multiple",
                updatedBy: interaction.user.id,
                updatedAt: new Date(),
                details: {
                    itemCount: watchlist.items.length,
                    scope: scope
                }
            });
            if (interaction.guildId) {
                await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `📤 **${interaction.user.username}** exported the **${scope} watchlist**.`);
            }
        }
        catch (err) {
            console.error(err);
            await interaction.editReply("⚠️ Something went wrong while exporting the watchlist.");
        }
    },
};
exports.default = command;
