"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
// Temporary buffer for undo
const undoBuffer = new Map();
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("remove")
        .setDescription("Remove one or more items from your or the server's watchlist.")
        .addStringOption(option => option.setName("scope")
        .setDescription("Personal or server watchlist")
        .setRequired(true)
        .addChoices({ name: "Personal", value: "user" }, { name: "Server", value: "server" }))
        .addStringOption(option => option.setName("type")
        .setDescription("Filter by type")
        .addChoices({ name: "All", value: "all" }, { name: "Movie", value: "movie" }, { name: "TV Show", value: "tv" }, { name: "Anime", value: "anime" })),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const type = interaction.options.get("type")?.value || "all";
        const scope = interaction.options.get("scope")?.value;
        try {
            // Get watchlist
            let watchlist;
            if (scope === "user") {
                watchlist = await (0, watchlistUtils_1.getOrCreateUserWatchlist)(interaction.user.id);
            }
            else {
                if (!interaction.guild) {
                    await interaction.editReply("❌ Server watchlist can only be modified in a server.");
                    return;
                }
                watchlist = await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
            }
            let items = watchlist.items;
            if (type !== "all") {
                items = items.filter((i) => i.type === type);
            }
            if (!items.length) {
                await interaction.editReply(`📭 No items found in ${scope === "user" ? "your" : "this server's"} watchlist${type !== "all" ? ` for ${type}` : ""}.`);
                return;
            }
            // Build multi-select dropdown
            const selectMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId("select_item")
                .setPlaceholder("Select item(s) to remove")
                .setMinValues(1)
                .setMaxValues(Math.min(25, items.length))
                .addOptions(items.slice(0, 25).map((i) => ({
                label: i.title.length > 50 ? i.title.slice(0, 47) + "..." : i.title,
                description: `${i.type.toUpperCase()} • ${i.status}${i.releaseDate ? ` (${new Date(i.releaseDate).getFullYear()})` : ""}`,
                value: i.tmdbId.toString(),
            })));
            const row = new discord_js_1.ActionRowBuilder().addComponents(selectMenu);
            const msg = await interaction.editReply({ content: "Select item(s) to remove:", components: [row] });
            const collector = msg.createMessageComponentCollector({
                componentType: discord_js_1.ComponentType.StringSelect,
                time: 30000
            });
            collector.on("collect", async (menuInteraction) => {
                if (menuInteraction.user.id !== interaction.user.id) {
                    await menuInteraction.reply({ content: "You cannot select for this action.", ephemeral: true });
                    return;
                }
                const selectedIds = menuInteraction.values.map(v => parseInt(v));
                const selectedItems = items.filter((i) => selectedIds.includes(i.tmdbId));
                if (!selectedItems.length) {
                    await menuInteraction.update({ content: "❌ Items not found.", components: [] });
                    return;
                }
                // Ask for confirmation
                const confirmRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId("confirm_remove").setLabel(`Yes, remove ${selectedItems.length} item(s)`).setStyle(discord_js_1.ButtonStyle.Danger), new discord_js_1.ButtonBuilder().setCustomId("cancel_remove").setLabel("Cancel").setStyle(discord_js_1.ButtonStyle.Secondary));
                await menuInteraction.update({ content: `Are you sure you want to remove:\n**${selectedItems.map(i => i.title).join(", ")}**`, components: [confirmRow] });
                const btnCollector = msg.createMessageComponentCollector({
                    componentType: discord_js_1.ComponentType.Button,
                    time: 30000
                });
                btnCollector.on("collect", async (btnInteraction) => {
                    if (btnInteraction.user.id !== interaction.user.id) {
                        await btnInteraction.reply({ content: "You cannot confirm this action.", ephemeral: true });
                        return;
                    }
                    if (btnInteraction.customId === "confirm_remove") {
                        // Backup for undo
                        const backupKey = `${interaction.user.id}-${Date.now()}`;
                        undoBuffer.set(backupKey, { items: selectedItems, scope, watchlistId: scope === "user" ? interaction.user.id : interaction.guild.id });
                        // Remove from DB
                        watchlist.items = watchlist.items.filter((i) => !selectedIds.includes(i.tmdbId));
                        await watchlist.save();
                        // **Log removals (per item)**
                        for (const item of selectedItems) {
                            await WatchlistLog_1.WatchlistLog.create({
                                watchlistId: watchlist._id,
                                action: "remove",
                                itemId: item._id,
                                itemTitle: item.title,
                                itemType: item.type,
                                oldStatus: item.status,
                                updatedBy: interaction.user.id,
                                updatedAt: new Date(),
                            });
                            if (interaction.guildId) {
                                await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `🗑️ **${interaction.user.username}** removed the **Item: ${item.title}** from ${scope} watch-list.`);
                            }
                        }
                        // Undo button
                        const undoRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`undo_${backupKey}`).setLabel("Undo").setStyle(discord_js_1.ButtonStyle.Secondary));
                        await btnInteraction.update({ content: `✅ Removed **${selectedItems.length}** item(s): ${selectedItems.map(i => i.title).join(", ")}\n*(You can undo this within 30s)*`, components: [undoRow] });
                        // Auto-expire undo after 30s
                        setTimeout(() => undoBuffer.delete(backupKey), 30000);
                        // Listen for Undo
                        const undoCollector = msg.createMessageComponentCollector({
                            componentType: discord_js_1.ComponentType.Button,
                            time: 30000
                        });
                        undoCollector.on("collect", async (undoInteraction) => {
                            if (undoInteraction.user.id !== interaction.user.id) {
                                await undoInteraction.reply({ content: "You cannot undo this action.", ephemeral: true });
                                return;
                            }
                            if (undoInteraction.customId === `undo_${backupKey}`) {
                                const backup = undoBuffer.get(backupKey);
                                if (backup) {
                                    // Restore items
                                    let restoreList = backup.scope === "user" ? await (0, watchlistUtils_1.getOrCreateUserWatchlist)(backup.watchlistId) : await (0, watchlistUtils_1.getOrCreateServerWatchlist)(backup.watchlistId);
                                    restoreList.items.push(...backup.items);
                                    await restoreList.save();
                                    // **Log one undo action**
                                    await WatchlistLog_1.WatchlistLog.create({
                                        watchlistId: restoreList._id,
                                        action: "undo_remove",
                                        itemTitle: backup.items.map(i => i.title).join(", "),
                                        itemType: "multiple",
                                        updatedBy: interaction.user.id,
                                        updatedAt: new Date(),
                                    });
                                    if (interaction.guildId) {
                                        await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `↩️ **${interaction.user.username}** restored the **Item: ${backup.items.map(i => i.title).join(", ")}** from ${scope} watch-list.`);
                                    }
                                    undoBuffer.delete(backupKey);
                                    await undoInteraction.update({ content: `↩️ Undo successful! Restored **${backup.items.length}** item(s).`, components: [] });
                                }
                                else {
                                    await undoInteraction.update({ content: "❌ Undo expired.", components: [] });
                                }
                            }
                        });
                    }
                    else {
                        await btnInteraction.update({ content: "❌ Removal canceled.", components: [] });
                    }
                    btnCollector.stop();
                });
                collector.stop();
            });
        }
        catch (err) {
            console.error(err);
            await interaction.editReply("⚠️ Something went wrong while removing the item.");
        }
    },
};
exports.default = command;
