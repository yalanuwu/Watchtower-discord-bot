"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/commands/trending.ts
const discord_js_1 = require("discord.js");
const watchlistUtils_1 = require("../utils/watchlistUtils");
const WatchlistLog_1 = require("../models/WatchlistLog");
const logUtils_1 = require("../utils/logUtils");
const command = {
    data: new discord_js_1.SlashCommandBuilder()
        .setName("trending")
        .setDescription("View trending movies or TV shows.")
        .addStringOption(option => option.setName("type")
        .setDescription("Choose whether to view trending movies or TV shows.")
        .setRequired(true)
        .addChoices({ name: "Movie", value: "movie" }, { name: "TV Show", value: "tv" }))
        .addStringOption(option => option.setName("time_window")
        .setDescription("Trending period (for movies only)")
        .addChoices({ name: "Day", value: "day" }, { name: "Week", value: "week" })),
    async execute(interaction) {
        await interaction.deferReply();
        const type = interaction.options.getString("type", true);
        const timeWindow = interaction.options.getString("time_window") || "day";
        const url = `https://api.themoviedb.org/3/trending/${type}/${timeWindow}?api_key=${process.env.TMDB_API_KEY}&language=en-US`;
        const response = await fetch(url);
        if (!response.ok) {
            await interaction.editReply("⚠️ Failed to fetch trending results.");
            return;
        }
        const data = await response.json();
        const results = data.results.slice(0, 20);
        if (results.length === 0) {
            await interaction.editReply("📭 No trending results found.");
            return;
        }
        let currentIndex = 0;
        const generateEmbed = (index) => {
            const item = results[index];
            const overview = item.overview && item.overview.length > 200
                ? item.overview.slice(0, 200) + "..."
                : item.overview || "No description available.";
            return new discord_js_1.EmbedBuilder()
                .setTitle(item.title ?? item.name ?? "Untitled")
                .setDescription(`${overview}`)
                .addFields({ name: "Type", value: `${type.toUpperCase()}`, inline: true }, { name: "Release", value: `${item.release_date ?? item.first_air_date ?? "Unknown"}`, inline: true }, { name: "Rating", value: `${item.vote_average?.toFixed(1) ?? "N/A"} ⭐`, inline: true }, { name: "Popularity", value: `${Math.round(item.popularity ?? 0)}`, inline: true })
                .setImage(item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null)
                .setFooter({ text: `Result ${index + 1} of ${results.length}` })
                .setColor("Blue");
        };
        const generateButtons = (index) => {
            const paginationRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId("first").setLabel("⏮️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === 0), new discord_js_1.ButtonBuilder().setCustomId("prev").setLabel("◀️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === 0), new discord_js_1.ButtonBuilder().setCustomId("next").setLabel("▶️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === results.length - 1), new discord_js_1.ButtonBuilder().setCustomId("last").setLabel("⏭️").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(index === results.length - 1));
            const actionRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`add_personal_${results[index].id}`).setLabel("Add to Personal").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`add_server_${results[index].id}`).setLabel("Add to Server").setStyle(discord_js_1.ButtonStyle.Secondary).setDisabled(!interaction.guild));
            return [paginationRow, actionRow];
        };
        let message = await interaction.editReply({
            embeds: [generateEmbed(currentIndex)],
            components: generateButtons(currentIndex)
        });
        const collector = message.createMessageComponentCollector({
            componentType: discord_js_1.ComponentType.Button,
            time: 240000
        });
        collector.on("collect", async (btn) => {
            if (btn.user.id !== interaction.user.id) {
                await btn.reply({ content: "You cannot interact with this.", ephemeral: true });
                return;
            }
            if (["first", "prev", "next", "last"].includes(btn.customId)) {
                if (btn.customId === "first")
                    currentIndex = 0;
                else if (btn.customId === "prev")
                    currentIndex = Math.max(currentIndex - 1, 0);
                else if (btn.customId === "next")
                    currentIndex = Math.min(currentIndex + 1, results.length - 1);
                else if (btn.customId === "last")
                    currentIndex = results.length - 1;
                await btn.update({
                    embeds: [generateEmbed(currentIndex)],
                    components: generateButtons(currentIndex)
                });
                return;
            }
            if (btn.customId.startsWith("confirm_tv_") || btn.customId.startsWith("confirm_anime_")) {
                const selectedId = parseInt(btn.customId.split("_")[2]);
                const finalType = btn.customId.includes("anime") ? "anime" : "tv";
                const item = results.find(r => r.id === selectedId);
                const scope = "user"; // default to personal (we only ask type after personal/server selection)
                if (!item) {
                    await btn.update({ content: "⚠️ Something went wrong. Try again.", embeds: [], components: [] });
                    return;
                }
                const watchlist = await (0, watchlistUtils_1.getOrCreateUserWatchlist)(btn.user.id);
                if (watchlist.items.some((i) => i.tmdbId === item.id)) {
                    await btn.update({ content: `⚠️ **${item.title ?? item.name}** is already in your watchlist.`, embeds: [], components: [] });
                    return;
                }
                // Add to watchlist
                watchlist.items.push({
                    title: item.title ?? item.name ?? "Untitled",
                    tmdbId: item.id,
                    type: finalType,
                    status: "Planned",
                    releaseDate: item.release_date ?? item.first_air_date,
                    posterPath: item.poster_path,
                    addedBy: btn.user.id,
                    createdAt: new Date()
                });
                await watchlist.save();
                // Log
                await WatchlistLog_1.WatchlistLog.create({
                    watchlistId: watchlist._id,
                    action: "add",
                    itemId: item.id,
                    itemTitle: item.title ?? item.name ?? "Untitled",
                    updatedBy: btn.user.id,
                    updatedAt: new Date()
                });
                // Logging channel
                if (interaction.guildId) {
                    (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `📌 **<@${btn.user.id}>** added **${item.title ?? item.name}** to the ${scope} watchlist.`);
                }
                await btn.update({ content: `✅ Added **${item.title ?? item.name}** as **${finalType.toUpperCase()}** to your watchlist.`, embeds: [], components: [] });
                return;
            }
            if (btn.customId.startsWith("add_personal") || btn.customId.startsWith("add_server")) {
                const item = results[currentIndex];
                const scope = btn.customId.startsWith("add_personal") ? "user" : "server";
                // If TV, ask if Anime or TV
                let finalType = type;
                if (type === "tv") {
                    const choiceRow = new discord_js_1.ActionRowBuilder().addComponents(new discord_js_1.ButtonBuilder().setCustomId(`confirm_tv_${item.id}`).setLabel("TV Show").setStyle(discord_js_1.ButtonStyle.Primary), new discord_js_1.ButtonBuilder().setCustomId(`confirm_anime_${item.id}`).setLabel("Anime").setStyle(discord_js_1.ButtonStyle.Secondary));
                    await btn.update({
                        content: "Is this a TV Show or an Anime?",
                        embeds: [generateEmbed(currentIndex)],
                        components: [choiceRow]
                    });
                    return;
                }
                const watchlist = scope === "user"
                    ? await (0, watchlistUtils_1.getOrCreateUserWatchlist)(btn.user.id)
                    : await (0, watchlistUtils_1.getOrCreateServerWatchlist)(interaction.guild.id);
                if (watchlist.items.some((i) => i.tmdbId === item.id)) {
                    await btn.update({ content: `⚠️ **${item.title ?? item.name}** is already in the ${scope} watchlist.`, embeds: [], components: [] });
                    return;
                }
                watchlist.items.push({
                    title: item.title ?? item.name ?? "Untitled",
                    tmdbId: item.id,
                    type: finalType,
                    status: "Planned",
                    releaseDate: item.release_date ?? item.first_air_date,
                    posterPath: item.poster_path,
                    addedBy: btn.user.id,
                    createdAt: new Date()
                });
                await watchlist.save();
                // Log
                await WatchlistLog_1.WatchlistLog.create({
                    watchlistId: watchlist._id,
                    action: "add",
                    itemId: item.id,
                    itemTitle: item.title ?? item.name ?? "Untitled",
                    updatedBy: btn.user.id,
                    updatedAt: new Date()
                });
                // Logging channel
                if (interaction.guildId) {
                    (0, logUtils_1.sendLog)(interaction.client, interaction.guildId, `📌 **<@${btn.user.id}>** added **${item.title ?? item.name}** to the ${scope} watchlist.`);
                }
                await btn.update({ content: `✅ Added **${item.title ?? item.name}** to the ${scope} watchlist.`, embeds: [], components: [] });
            }
        });
        collector.on("end", async () => {
            await interaction.editReply({
                embeds: [generateEmbed(currentIndex)],
                components: [] // disable buttons
            });
        });
    }
};
exports.default = command;
