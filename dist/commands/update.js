"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("update")
        .setDescription("Update the status of an item in your or the server's watchlist.")
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
            // Fetch watchlist
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
            // Filter items
            let items = watchlist.items;
            if (type !== "all") {
                items = items.filter((i) => i.type === type);
            }
            if (!items.length) {
                await interaction.editReply(`📭 No items found in ${scope === "user" ? "your" : "this server's"} watchlist${type !== "all" ? ` for ${type}` : ""}.`);
                return;
            }
            // Step 1: Let user select an item
            const itemMenu = new discord_js_1.StringSelectMenuBuilder()
                .setCustomId("select_item")
                .setPlaceholder("Select an item to update")
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(items.slice(0, 25).map((i) => ({
                label: i.title.length > 50 ? i.title.slice(0, 47) + "..." : i.title,
                description: `${i.type.toUpperCase()} • ${i.status}${i.releaseDate ? ` (${new Date(i.releaseDate).getFullYear()})` : ""}`,
                value: i.tmdbId.toString(),
            })));
            const itemRow = new discord_js_1.ActionRowBuilder().addComponents(itemMenu);
            const msg = await interaction.editReply({ content: "Select an item to update:", components: [itemRow] });
            // Step 2: Collector for item selection
            const selectCollector = msg.createMessageComponentCollector({
                componentType: discord_js_1.ComponentType.StringSelect,
                time: 60000,
            });
            selectCollector.on("collect", async (menuInteraction) => {
                if (menuInteraction.user.id !== interaction.user.id) {
                    await menuInteraction.reply({ content: "You cannot update this watchlist.", ephemeral: true });
                    return;
                }
                await menuInteraction.deferUpdate(); // acknowledge
                const selectedId = parseInt(menuInteraction.values[0]);
                const selectedItem = items.find((i) => i.tmdbId === selectedId);
                if (!selectedItem) {
                    await interaction.editReply({ content: "❌ Item not found.", components: [] });
                    return;
                }
                // Step 3: Send a NEW message for status selection (avoids "unknown interaction")
                const statusMenu = new discord_js_1.StringSelectMenuBuilder()
                    .setCustomId("select_status")
                    .setPlaceholder("Select a new status")
                    .addOptions({ label: "Planned", value: "Planned" }, { label: "Watching", value: "Watching" }, { label: "Completed", value: "Completed" });
                const statusRow = new discord_js_1.ActionRowBuilder().addComponents(statusMenu);
                const statusMsg = await interaction.followUp({
                    content: `Selected **${selectedItem.title}**. Now choose a new status:`,
                    components: [statusRow],
                    ephemeral: true,
                });
                // Step 4: Collector for status selection (on new message)
                const statusCollector = statusMsg.createMessageComponentCollector({
                    componentType: discord_js_1.ComponentType.StringSelect,
                    time: 60000,
                });
                statusCollector.on("collect", async (statusInteraction) => {
                    if (statusInteraction.user.id !== interaction.user.id) {
                        await statusInteraction.reply({ content: "You cannot change this status.", ephemeral: true });
                        return;
                    }
                    await statusInteraction.deferUpdate();
                    const newStatus = statusInteraction.values[0];
                    const oldStatus = selectedItem.status;
                    selectedItem.status = newStatus;
                    await watchlist.save();
                    // Log the update
                    await WatchlistLog_1.WatchlistLog.create({
                        watchlistId: watchlist._id,
                        action: "update",
                        itemId: selectedItem._id,
                        itemTitle: selectedItem.title,
                        itemType: selectedItem.type,
                        oldStatus,
                        newStatus,
                        updatedBy: interaction.user.id,
                        updatedAt: new Date(),
                    });
                    if (interaction.guildId) {
                        await (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `📌 **<@${interaction.user.id}>** updated **STATUS : ${oldStatus} to ${newStatus}** of **ITEM : ${selectedItem.title}** from ${scope} watchlist.`);
                    }
                    await statusInteraction.editReply({
                        content: `✅ Updated **${selectedItem.title}** from **${oldStatus}** to **${newStatus}**.`,
                        components: [],
                    });
                    statusCollector.stop();
                    selectCollector.stop();
                });
            });
            selectCollector.on("end", async () => {
                await interaction.editReply({ components: [] }).catch(() => { });
            });
        }
        catch (err) {
            console.error(err);
            await interaction.editReply("⚠️ Something went wrong while updating the item.");
        }
    },
};
exports.default = command;
